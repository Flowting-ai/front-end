'use client'

/**
 * Client-side text extraction for files uploaded to Brain chat.
 *
 * The brain backend does not process FormData file uploads the same way
 * /chats/create does, so we read file content in the browser and inject
 * it as <document> blocks into the message text.
 *
 * Supported:
 *   PDF           — pdfjs-dist  (full text layer extraction)
 *   DOCX/PPTX/XLSX — ZIP+XML    (DecompressionStream + DOMParser)
 *   Text/code/CSV/JSON/HTML/etc — FileReader.readAsText
 *
 * Unsupported (binary without parseable text): raw images.
 */

// ── File type classifiers ─────────────────────────────────────────────────────

const TEXT_MIME = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'text/html', 'text/xml', 'application/xml', 'text/javascript',
  'application/javascript', 'text/css', 'text/x-python', 'text/x-java',
])
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm',
  'yaml', 'yml', 'log', 'js', 'ts', 'tsx', 'jsx', 'py', 'rb',
  'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'sh', 'bash',
  'sql', 'r', 'scala', 'kt', 'swift', 'php', 'css', 'scss',
  'env', 'toml', 'ini', 'cfg', 'conf',
])

function ext(file: File) { return file.name.split('.').pop()?.toLowerCase() ?? '' }

export function isExtractable(file: File): boolean {
  if (file.type === 'application/pdf') return true
  if (isOfficeFile(file)) return true
  if (file.type && (TEXT_MIME.has(file.type) || file.type.startsWith('text/'))) return true
  return TEXT_EXT.has(ext(file))
}

function isOfficeFile(file: File): boolean {
  const e = ext(file)
  return ['docx', 'pptx', 'xlsx', 'odt', 'ods', 'odp'].includes(e)
}

// ── Main entrypoint ───────────────────────────────────────────────────────────

/**
 * Extract readable text from a file. Returns empty string if extraction fails
 * (caller treats the file as binary and sends via FormData instead).
 */
export async function extractText(file: File): Promise<string> {
  try {
    if (file.type === 'application/pdf') return await extractPdf(file)
    if (isOfficeFile(file))              return await extractOfficeZip(file)
    return await extractPlainText(file)
  } catch {
    return ''
  }
}

// ── Plain text ────────────────────────────────────────────────────────────────

function extractPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = e => resolve((e.target?.result as string) ?? '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsText(file)
  })
}

// ── PDF via pdfjs-dist ────────────────────────────────────────────────────────

async function extractPdf(file: File): Promise<string> {
  // Dynamic import so the ~800 KB bundle only loads when a PDF is uploaded.
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const data   = await file.arrayBuffer()
  const task   = pdfjsLib.getDocument({ data, useSystemFonts: true })
  const pdf    = await task.promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text    = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    if (text.trim()) pages.push(text)
  }

  await pdf.destroy()
  return pages.join('\n\n')
}

// ── Office ZIP+XML (DOCX / PPTX / XLSX) ──────────────────────────────────────
// Office Open XML formats are ZIP archives containing XML files.
// We parse the ZIP directory manually and decompress the content file
// with the browser's built-in DecompressionStream, then strip XML tags.

async function extractOfficeZip(file: File): Promise<string> {
  const e = ext(file)
  const targetPath = e === 'docx' ? 'word/document.xml'
    : e === 'pptx' ? null   // PPTX has slide1.xml, slide2.xml, …
    : e === 'xlsx' ? 'xl/sharedStrings.xml'
    : null

  const buf     = await file.arrayBuffer()
  const bytes   = new Uint8Array(buf)
  const entries = parseZipDirectory(bytes)

  // PPTX: extract all slide XML files
  const paths = targetPath
    ? entries.filter(e => e.path === targetPath)
    : entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.path))
              .sort((a, b) => a.path.localeCompare(b.path))

  const xmlParts: string[] = []
  for (const entry of paths) {
    const xml = await decompressEntry(bytes, entry)
    xmlParts.push(xml)
  }

  return xmlParts.map(stripXml).join('\n\n').replace(/\s+/g, ' ').trim()
}

// ── ZIP directory parser ──────────────────────────────────────────────────────

interface ZipEntry {
  path:       string
  offset:     number  // byte offset to local file header
  compressed: number  // compressed size
  method:     number  // 0=stored, 8=deflate
}

function parseZipDirectory(bytes: Uint8Array): ZipEntry[] {
  const view    = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: ZipEntry[] = []

  // Walk local file headers (signature 0x04034b50 = PK\x03\x04)
  let i = 0
  while (i < bytes.length - 4) {
    if (view.getUint32(i, true) !== 0x04034b50) { i++; continue }

    const method     = view.getUint16(i + 8,  true)
    const compressed = view.getUint32(i + 18, true)
    const fnLen      = view.getUint16(i + 26, true)
    const extraLen   = view.getUint16(i + 28, true)
    const path       = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + fnLen))
    const dataOffset = i + 30 + fnLen + extraLen

    entries.push({ path, offset: dataOffset, compressed, method })
    i = dataOffset + compressed
  }

  return entries
}

async function decompressEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const slice = bytes.slice(entry.offset, entry.offset + entry.compressed)

  if (entry.method === 0) {
    // Stored (no compression)
    return new TextDecoder().decode(slice)
  }

  // DEFLATE (method 8) — use browser's native DecompressionStream
  const ds     = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(slice)
  writer.close()

  const chunks: Uint8Array[] = []
  const reader = ds.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const total  = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) { result.set(c, pos); pos += c.length }

  return new TextDecoder().decode(result)
}

function stripXml(xml: string): string {
  // Remove XML tags and decode common entities
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
