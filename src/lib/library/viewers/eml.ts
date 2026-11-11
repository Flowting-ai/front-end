// A small MIME reader for the file page's email preview: the headers people look for and the best
// body (HTML when there is one, else plain text), with base64 / quoted-printable and the charset
// decoded. Not a full RFC 5322 parser: nested multiparts are walked, attachments are only listed.

export type ParsedEmail = {
  headers: { from: string; to: string; cc: string; date: string; subject: string };
  html: string | null;
  text: string | null;
  attachments: string[];
};

type Part = { headers: Map<string, string>; body: string };

function splitHeaders(raw: string): Part {
  const normalized = raw.replace(/\r\n/g, "\n");
  // A part may have no headers at all: it then starts with the blank line, and all of it is body.
  if (normalized.startsWith("\n")) return { headers: new Map(), body: normalized.slice(1) };
  const end = normalized.indexOf("\n\n");
  const head = end < 0 ? normalized : normalized.slice(0, end);
  const body = end < 0 ? "" : normalized.slice(end + 2);
  const headers = new Map<string, string>();
  let current = "";
  for (const line of head.split("\n")) {
    // A folded header continues on lines that start with whitespace.
    if (/^[ \t]/.test(line) && current) {
      headers.set(current, `${headers.get(current)} ${line.trim()}`);
      continue;
    }
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    current = line.slice(0, colon).trim().toLowerCase();
    headers.set(current, line.slice(colon + 1).trim());
  }
  return { headers, body };
}

function param(header: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i").exec(header);
  return match ? (match[1] ?? match[2]) : null;
}

function bytesOf(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

function decodeCharset(bytes: Uint8Array, charset: string | null): string {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeBody(body: string, encoding: string | undefined, charset: string | null): string {
  const kind = (encoding ?? "").toLowerCase();
  if (kind === "base64") {
    try {
      return decodeCharset(bytesOf(atob(body.replace(/\s+/g, ""))), charset);
    } catch {
      return body;
    }
  }
  if (kind === "quoted-printable") {
    const binary = body.replace(/=\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    return decodeCharset(bytesOf(binary), charset);
  }
  // 7bit / 8bit: the file was read as UTF-8 already.
  return body;
}

/** RFC 2047 encoded words in headers (=?utf-8?B?...?= and =?utf-8?Q?...?=). */
export function decodeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_, charset: string, kind: string, text: string) => {
    try {
      const binary = kind.toUpperCase() === "B"
        ? atob(text)
        : text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (__, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      return decodeCharset(bytesOf(binary), charset);
    } catch {
      return text;
    }
  });
}

function walk(part: Part, out: ParsedEmail, depth = 0): void {
  const type = part.headers.get("content-type") ?? "text/plain";
  const mime = type.split(";")[0].trim().toLowerCase();
  const disposition = part.headers.get("content-disposition") ?? "";
  const filename = param(disposition, "filename") ?? param(type, "name");
  if (/^attachment/i.test(disposition) || (filename && !mime.startsWith("multipart/"))) {
    out.attachments.push(decodeWords(filename ?? "attachment"));
    return;
  }
  if (mime.startsWith("multipart/") && depth < 8) {
    const boundary = param(type, "boundary");
    if (!boundary) return;
    const pieces = part.body.split(new RegExp(`^--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?[ \\t]*$`, "m"));
    // The text before the first boundary and after the last one is not a part.
    for (const piece of pieces.slice(1)) {
      // The line break before a boundary belongs to the boundary, not to the part.
      const trimmed = piece.replace(/^\n/, "").replace(/\n$/, "");
      if (trimmed.trim()) walk(splitHeaders(trimmed), out, depth + 1);
    }
    return;
  }
  const decoded = decodeBody(part.body, part.headers.get("content-transfer-encoding"), param(type, "charset"));
  if (mime === "text/html" && out.html === null) out.html = decoded;
  else if (mime === "text/plain" && out.text === null) out.text = decoded;
}

export function parseEmail(raw: string): ParsedEmail {
  const root = splitHeaders(raw);
  const header = (name: string) => decodeWords(root.headers.get(name) ?? "");
  const out: ParsedEmail = {
    headers: { from: header("from"), to: header("to"), cc: header("cc"), date: header("date"), subject: header("subject") },
    html: null,
    text: null,
    attachments: [],
  };
  walk(root, out);
  return out;
}
