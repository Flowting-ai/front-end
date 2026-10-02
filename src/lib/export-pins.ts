import { toast } from "sonner"
import type { PinItem } from "@/context/pinboard-context"

// Security note (see docs v2/performance report/pinboard/07-pinboard-feature-report.md
// §10 for the full trace): this module used to build the exported document as
// an HTML *string* (interpolating pin title/content/category/tags/chat-name —
// all user- or model-generated text — into template literals with manual
// escapeHtml() calls) and hand that string to `container.innerHTML = ...`.
// Every interpolation point was in fact escaped correctly, so it was not
// exploitable as shipped — but the safety depended entirely on every future
// edit remembering to keep calling escapeHtml() on every new field, which is
// a fragile invariant for a static-analysis rule (`dangerous-html-sink`) to
// have to keep re-verifying by hand. Rebuilt below using real DOM-node
// construction (`createElement` + `textContent`) instead: user-controlled
// strings are assigned to `.textContent`, which the DOM never interprets as
// markup, so there is no escaping step to forget and no `innerHTML` sink left
// to reason about at all.

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/`(.+?)`/g, "$1")
    .trim()
}

/** Small helper: create an element, assign text via `.textContent` (never
 * `.innerHTML`) so the value can never be interpreted as markup, and apply a
 * plain style object. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: { text?: string; style?: Partial<CSSStyleDeclaration> },
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (opts?.text !== undefined) node.textContent = opts.text
  if (opts?.style) Object.assign(node.style, opts.style)
  return node
}

function buildPinCard(pin: PinItem, chatNameById: Map<string, string>): HTMLDivElement {
  const chatName = (pin.chatId ? chatNameById.get(pin.chatId) : undefined) ?? pin.chatName ?? ""

  const card = el("div", {
    style: {
      padding:       "12px 14px",
      border:        "1px solid #e1e1e1",
      borderRadius:  "10px",
      marginBottom:  "10px",
      breakInside:   "avoid",
    },
  })

  card.appendChild(el("div", {
    text:  stripMarkdown(pin.title || pin.content),
    style: { fontWeight: "600", fontSize: "14px", color: "#111", marginBottom: "4px" },
  }))
  card.appendChild(el("div", {
    text:  stripMarkdown(pin.content),
    style: { fontSize: "12px", color: "#222", whiteSpace: "pre-wrap" },
  }))
  card.appendChild(el("div", {
    text:  pin.category,
    style: { marginTop: "4px", fontSize: "11px", color: "#888" },
  }))
  if (chatName) {
    card.appendChild(el("div", {
      text:  `Chat: ${chatName}`,
      style: { marginTop: "4px", fontSize: "11px", color: "#666" },
    }))
  }
  if (pin.tags && pin.tags.length) {
    card.appendChild(el("div", {
      text:  `Tags: ${pin.tags.join(", ")}`,
      style: { marginTop: "6px", fontSize: "11px", color: "#444" },
    }))
  }

  return card
}

function buildDoc(pinCards: HTMLDivElement[], label: string, now: Date): HTMLDivElement {
  const doc = el("div", {
    style: { fontFamily: "Arial,sans-serif", width: "760px", padding: "24px", background: "#fff" },
  })
  doc.appendChild(el("div", {
    text:  "Pinboard Export",
    style: { fontSize: "22px", fontWeight: "bold", marginBottom: "6px", color: "#111" },
  }))
  doc.appendChild(el("div", {
    // `label` ("1 pin"/"N pins") and the date are computed internally, not
    // user data — safe either way, kept as textContent for consistency.
    text:  `Exported ${label} · ${now.toLocaleString()}`,
    style: { fontSize: "12px", color: "#555", marginBottom: "16px" },
  }))
  pinCards.forEach((card) => doc.appendChild(card))
  return doc
}

/**
 * Renders `docNode` off-screen and saves it as a real downloaded PDF (not a
 * print-dialog dependent popup — this generates actual PDF bytes via jsPDF +
 * html2canvas and triggers a browser download under `filename`).
 */
async function renderAndDownloadPdf(docNode: HTMLElement, filename: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ])

  const container = document.createElement("div")
  container.style.position = "fixed"
  container.style.left = "-10000px"
  container.style.top = "0"
  container.appendChild(docNode)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, { scale: 2, windowWidth: 808 })
    const imgData = canvas.toDataURL("image/png")

    const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = (canvas.height * pageWidth) / canvas.width

    // Paginate: slice the tall rendered image across as many A4-ish pages as needed.
    const pxPerPage = (pdf.internal.pageSize.getHeight() / pageWidth) * canvas.width
    let renderedHeight = 0
    let isFirstPage = true
    while (renderedHeight < canvas.height) {
      if (!isFirstPage) pdf.addPage()
      const sliceHeight = Math.min(pxPerPage, canvas.height - renderedHeight)
      pdf.addImage(
        imgData, "PNG",
        0, -renderedHeight * (pageWidth / canvas.width),
        pageWidth, pageHeight,
      )
      renderedHeight += sliceHeight
      isFirstPage = false
    }

    pdf.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Export a single pin as a downloaded PDF file.
 */
export function exportSinglePin(pin: PinItem, chatNameById: Map<string, string>): void {
  if (typeof window === "undefined") return
  const now = new Date()
  const filename = `pin-export-${now.toISOString().split("T")[0]}.pdf`
  const docNode = buildDoc([buildPinCard(pin, chatNameById)], "1 pin", now)

  toast.promise(renderAndDownloadPdf(docNode, filename), {
    loading: "Generating PDF…",
    success: `Downloaded ${filename}`,
    error: "Couldn't generate the PDF. Please try again.",
  })
}

/**
 * Export multiple pins (bulk export from pinboard header or organize mode) as
 * a single downloaded PDF file. When pinIds is provided, only those pins are
 * exported; otherwise all pins in the array.
 */
export function exportPins(
  allPins: PinItem[],
  chatNameById: Map<string, string>,
  pinIds?: string[],
): void {
  if (typeof window === "undefined") return

  const pins = pinIds && pinIds.length > 0
    ? allPins.filter(p => pinIds.includes(p.id))
    : allPins

  if (pins.length === 0) {
    toast("No pins to export", { description: "Add or select pins before exporting." })
    return
  }

  const now = new Date()
  const label = pins.length === 1 ? "1 pin" : `${pins.length} pins`
  const filename = `pins-export-${now.toISOString().split("T")[0]}.pdf`
  const docNode = buildDoc(pins.map(p => buildPinCard(p, chatNameById)), label, now)

  toast.promise(renderAndDownloadPdf(docNode, filename), {
    loading: "Generating PDF…",
    success: `Downloaded ${filename}`,
    error: "Couldn't generate the PDF. Please try again.",
  })
}
