import { toast } from "sonner"
import type { PinItem } from "@/context/pinboard-context"

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
      ? `<div style="margin-top:6px;font-size:11px;color:#444;">Tags: ${pin.tags.join(", ")}</div>`
      : ""
  const category = `<div style="margin-top:4px;font-size:11px;color:#888;">${pin.category}</div>`
  const chat = chatName
    ? `<div style="margin-top:4px;font-size:11px;color:#666;">Chat: ${chatName}</div>`
    : ""
  return `
    <div style="padding:12px 14px;border:1px solid #e1e1e1;border-radius:10px;margin-bottom:10px;break-inside:avoid;">
      <div style="font-weight:600;font-size:14px;color:#111;margin-bottom:4px;">${stripMarkdown(pin.title || pin.content)}</div>
      <div style="font-size:12px;color:#222;white-space:pre-wrap;">${stripMarkdown(pin.content)}</div>
      ${category}
      ${chat}
      ${tags}
    </div>`
}

function buildDocHtml(htmlPins: string, label: string, now: Date, filename: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Pins Export - ${filename}</title>
    <meta charset="UTF-8">
    <style>
      @page { margin: 18mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
      .toolbar {
        position: sticky; top: 0; background: white; border-bottom: 1px solid #ddd;
        padding: 12px 20px; display: flex; gap: 10px; align-items: center;
        z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .toolbar button {
        padding: 8px 16px; border: none; border-radius: 6px;
        font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;
      }
      .toolbar button:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      .print-btn { background: #1e1e1e; color: white; }
      .print-btn:hover { background: #333; }
      .toolbar-title { margin-left: 10px; font-size: 14px; color: #666; flex: 1; }
      .container { max-width: 900px; margin: 0 auto; padding: 20px; background: white; min-height: calc(100vh - 60px); }
      .header { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #111; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      @media print {
        body { background: white; }
        .toolbar { display: none; }
        .container { max-width: 100%; padding: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button class="print-btn" onclick="window.print()">
        <span style="margin-right:6px;">🖨</span> Print
      </button>
      <div class="toolbar-title">${label} · ${now.toLocaleString()}</div>
    </div>
    <div class="container">
      <div class="header">Pinboard Export</div>
      <div class="meta">Exported ${label} · ${now.toLocaleString()}</div>
      ${htmlPins}
    </div>
  </body>
</html>`
}

function openPrintWindow(docHtml: string): void {
  const printWindow = window.open("", "_blank", "width=1000,height=800")
  if (!printWindow) {
    toast.error("Popup blocked", { description: "Allow popups to export pins." })
    return
  }
  printWindow.document.open()
  printWindow.document.write(docHtml)
  printWindow.document.close()
  toast("Export window opened", { description: "Use the toolbar to print your pins." })
}

/**
 * Export a single pin to a print window.
 */
export function exportSinglePin(pin: PinItem, chatNameById: Map<string, string>): void {
  if (typeof window === "undefined") return
  const now = new Date()
  const filename = `pin-export-${now.toISOString().split("T")[0]}.pdf`
  const htmlPins = buildPinCard(pin, chatNameById)
  const docHtml = buildDocHtml(htmlPins, "1 pin", now, filename)
  try {
    openPrintWindow(docHtml)
  } catch (error) {
    console.error("Failed to open export window", error)
    toast.error("Export failed", { description: "Unable to open export window." })
  }
}

/**
 * Export multiple pins (bulk export from pinboard header or organize mode).
 * When pinIds is provided, only those pins are exported; otherwise all pins in the array.
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
  const htmlPins = pins.map(p => buildPinCard(p, chatNameById)).join("")
  const docHtml = buildDocHtml(htmlPins, label, now, filename)

  try {
    openPrintWindow(docHtml)
  } catch (error) {
    console.error("Failed to open export window", error)
    toast.error("Export failed", { description: "Unable to open export window." })
  }
}
