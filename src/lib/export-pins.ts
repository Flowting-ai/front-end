import { toast } from "sonner"
import type { PinItem } from "@/context/pinboard-context"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

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

function buildPinCard(pin: PinItem, chatNameById: Map<string, string>): string {
  const chatName = (pin.chatId ? chatNameById.get(pin.chatId) : undefined) ?? pin.chatName ?? ""
  const tags =
    pin.tags && pin.tags.length
      ? `<div style="margin-top:6px;font-size:11px;color:#444;">Tags: ${pin.tags.map(escapeHtml).join(", ")}</div>`
      : ""
  const category = `<div style="margin-top:4px;font-size:11px;color:#888;">${escapeHtml(pin.category)}</div>`
  const chat = chatName
    ? `<div style="margin-top:4px;font-size:11px;color:#666;">Chat: ${escapeHtml(chatName)}</div>`
    : ""
  return `
    <div style="padding:12px 14px;border:1px solid #e1e1e1;border-radius:10px;margin-bottom:10px;break-inside:avoid;">
      <div style="font-weight:600;font-size:14px;color:#111;margin-bottom:4px;">${escapeHtml(stripMarkdown(pin.title || pin.content))}</div>
      <div style="font-size:12px;color:#222;white-space:pre-wrap;">${escapeHtml(stripMarkdown(pin.content))}</div>
      ${category}
      ${chat}
      ${tags}
    </div>`
}

function buildDocHtml(htmlPins: string, label: string, now: Date): string {
  return `
    <div style="font-family:Arial,sans-serif;width:760px;padding:24px;background:#fff;">
      <div style="font-size:22px;font-weight:bold;margin-bottom:6px;color:#111;">Pinboard Export</div>
      <div style="font-size:12px;color:#555;margin-bottom:16px;">Exported ${label} · ${now.toLocaleString()}</div>
      ${htmlPins}
    </div>`
}

/**
 * Renders `docHtml` off-screen and saves it as a real downloaded PDF (not a
 * print-dialog dependent popup — this generates actual PDF bytes via jsPDF +
 * html2canvas and triggers a browser download under `filename`).
 */
async function renderAndDownloadPdf(docHtml: string, filename: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ])

  const container = document.createElement("div")
  container.style.position = "fixed"
  container.style.left = "-10000px"
  container.style.top = "0"
  container.innerHTML = docHtml
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
  const docHtml = buildDocHtml(buildPinCard(pin, chatNameById), "1 pin", now)

  toast.promise(renderAndDownloadPdf(docHtml, filename), {
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
  const docHtml = buildDocHtml(pins.map(p => buildPinCard(p, chatNameById)).join(""), label, now)

  toast.promise(renderAndDownloadPdf(docHtml, filename), {
    loading: "Generating PDF…",
    success: `Downloaded ${filename}`,
    error: "Couldn't generate the PDF. Please try again.",
  })
}
