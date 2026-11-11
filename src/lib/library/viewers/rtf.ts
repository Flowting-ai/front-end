// RTF to safe HTML for the file page, for RTF the server could not lay out: a fragment with no
// {\rtf1 header (what pandoc writes without --standalone) or a failed conversion. Covers what
// documents actually use: character formatting, fonts and colours, paragraph alignment and indents,
// line and page breaks, tables, Unicode and code-page escapes. Pictures, fields' code, headers and
// footers are skipped. Every piece of text is escaped; the output carries only inline styles.

const DEFAULT_FONT_HALF_POINTS = 24;

/** Whether the text is a complete RTF document (as opposed to a body fragment or plain text). */
export function isRtfDocument(text: string): boolean {
  return /^﻿?\s*\{\\rtf/.test(text);
}

/** Wraps an RTF body fragment in a minimal document, so it reads as RTF. */
export function wrapRtfFragment(text: string): string {
  return isRtfDocument(text) ? text : `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}{\\f1 Courier New;}}${text}}`;
}

type Char = {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean; sup: boolean; sub: boolean;
  size: number; font: number; color: number; highlight: number;
};
type Para = { align: "left" | "center" | "right" | "justify"; left: number; first: number; right: number; before: number; after: number; inTable: boolean };
type State = { char: Char; para: Para; skip: boolean; uc: number };
type Run = { text: string; char: Char };
type Paragraph = { para: Para; runs: Run[] };
type Block = { kind: "p"; paragraph: Paragraph } | { kind: "table"; rows: Paragraph[][][] } | { kind: "page" };

const plainChar = (): Char => ({ bold: false, italic: false, underline: false, strike: false, sup: false, sub: false, size: DEFAULT_FONT_HALF_POINTS, font: -1, color: 0, highlight: 0 });
const plainPara = (): Para => ({ align: "left", left: 0, first: 0, right: 0, before: 0, after: 0, inTable: false });

// Groups whose content is never shown. Font and colour tables are read separately.
const SKIP = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "headerl", "headerr", "headerf",
  "footer", "footerl", "footerr", "footerf", "footnote", "fldinst", "listtable", "listoverridetable",
  "generator", "themedata", "colorschememapping", "latentstyles", "datastore", "xmlnstbl", "rsidtbl",
  "pgdsctbl", "filetbl", "revtbl", "pn", "nonshppict", "shp", "bkmkstart", "bkmkend", "xe", "tc",
]);

const SYMBOLS: Record<string, string> = {
  bullet: "•", emdash: "—", endash: "–", lquote: "‘", rquote: "’",
  ldblquote: "“", rdblquote: "”", emspace: " ", enspace: " ", qmspace: " ", tab: "\t",
};

const decoder = (() => {
  try {
    return new TextDecoder("windows-1252");
  } catch {
    return new TextDecoder("utf-8");
  }
})();

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The content of the first `{\name ...}` group, braces matched. */
function groupBody(rtf: string, name: string): string {
  const start = rtf.indexOf(`{\\${name}`);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < rtf.length; i += 1) {
    if (rtf[i] === "\\") { i += 1; continue; }
    if (rtf[i] === "{") depth += 1;
    else if (rtf[i] === "}" && (depth -= 1) === 0) return rtf.slice(start + name.length + 2, i);
  }
  return "";
}

function readFonts(rtf: string): Map<number, string> {
  const fonts = new Map<number, string>();
  // Each entry: \fN, then control words (family, charset, pitch), then the name up to ";".
  for (const match of groupBody(rtf, "fonttbl").matchAll(/\\f(\d+)((?:\\[a-z]+-?\d* ?)*)([^;\\{}]*);/g)) {
    // Only the characters font names use: a name goes into a style attribute, so quotes, colons and
    // brackets (which could add CSS such as background:url()) never get there.
    const name = match[3].replace(/[^\w \-.]/g, "").trim();
    if (name) fonts.set(Number(match[1]), name);
  }
  return fonts;
}

function readColors(rtf: string): string[] {
  const body = groupBody(rtf, "colortbl");
  if (!body) return [];
  return body.split(";").slice(0, -1).map((entry) => {
    const r = /\\red(\d+)/.exec(entry), g = /\\green(\d+)/.exec(entry), b = /\\blue(\d+)/.exec(entry);
    return r && g && b ? `rgb(${r[1]}, ${g[1]}, ${b[1]})` : "";
  });
}

/** Parses RTF into blocks (paragraphs, tables, page breaks). */
function parse(rtf: string): Block[] {
  const blocks: Block[] = [];
  let state: State = { char: plainChar(), para: plainPara(), skip: false, uc: 1 };
  const stack: State[] = [];
  let runs: Run[] = [];
  let text = "";
  // Table being built: rows of cells of paragraphs.
  let rows: Paragraph[][][] | null = null;
  let row: Paragraph[][] = [];
  let cell: Paragraph[] = [];
  let skipFallback = 0;
  let pendingBytes: number[] = [];

  const flushBytes = () => {
    if (pendingBytes.length) {
      text += decoder.decode(new Uint8Array(pendingBytes));
      pendingBytes = [];
    }
  };
  const flushText = () => {
    flushBytes();
    if (text) {
      runs.push({ text, char: { ...state.char } });
      text = "";
    }
  };
  const closeTable = () => {
    if (!rows) return;
    if (cell.length) row.push(cell);
    if (row.length) rows.push(row);
    blocks.push({ kind: "table", rows });
    rows = null;
    row = [];
    cell = [];
  };
  const endParagraph = () => {
    flushText();
    const paragraph: Paragraph = { para: { ...state.para }, runs };
    runs = [];
    if (state.para.inTable) {
      rows ??= [];
      cell.push(paragraph);
    } else {
      closeTable();
      blocks.push({ kind: "p", paragraph });
    }
  };
  const emit = (value: string) => {
    if (state.skip) return;
    if (skipFallback > 0) {
      skipFallback -= 1;
      return;
    }
    flushBytes();
    text += value;
  };

  let i = 0;
  // A destination's first control word decides whether the group is skipped.
  let groupStart = false;
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === "{") {
      flushText();
      stack.push(state);
      state = { char: { ...state.char }, para: { ...state.para }, skip: state.skip, uc: state.uc };
      groupStart = true;
      i += 1;
      continue;
    }
    if (ch === "}") {
      flushText();
      state = stack.pop() ?? state;
      // A \u's fallback characters end with its group: text after the group is never skipped.
      skipFallback = 0;
      groupStart = false;
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch !== "\\") {
      emit(ch);
      groupStart = false;
      i += 1;
      continue;
    }
    // A control symbol or word.
    const next = rtf[i + 1];
    if (next === undefined) break;
    if (next === "'") {
      const byte = parseInt(rtf.slice(i + 2, i + 4), 16);
      if (!state.skip) {
        if (skipFallback > 0) skipFallback -= 1;
        else if (!Number.isNaN(byte)) pendingBytes.push(byte);
      }
      i += 4;
      groupStart = false;
      continue;
    }
    if (next === "*") {
      // An ignorable destination: skipped unless it is one we read.
      if (groupStart) state.skip = true;
      i += 2;
      continue;
    }
    if (!/[a-zA-Z]/.test(next)) {
      i += 2;
      groupStart = false;
      if (next === "\\" || next === "{" || next === "}") emit(next);
      else if (next === "~") emit(" ");
      else if (next === "_") emit("‑");
      else if (next === "\n" || next === "\r") endParagraph();
      continue;
    }
    const match = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
    if (!match) {
      i += 1;
      continue;
    }
    i += 1 + match[0].length;
    const word = match[1];
    const param = match[2] === undefined ? null : Number(match[2]);
    const on = param === null || param !== 0;
    const wasStart = groupStart;
    groupStart = false;

    if (wasStart && SKIP.has(word)) {
      state.skip = true;
      continue;
    }
    if (word === "fldrslt") {
      state.skip = false;
      continue;
    }
    if (state.skip) continue;

    switch (word) {
      case "par": endParagraph(); break;
      case "line": emit("\n"); break;
      case "page": endParagraph(); closeTable(); blocks.push({ kind: "page" }); break;
      case "sect": endParagraph(); break;
      case "pard": flushText(); state.para = { ...plainPara(), inTable: false }; break;
      case "plain": flushText(); state.char = plainChar(); break;
      case "b": flushText(); state.char.bold = on; break;
      case "i": flushText(); state.char.italic = on; break;
      case "ul": flushText(); state.char.underline = on; break;
      case "ulnone": flushText(); state.char.underline = false; break;
      case "strike": flushText(); state.char.strike = on; break;
      case "super": flushText(); state.char.sup = on; state.char.sub = false; break;
      case "sub": flushText(); state.char.sub = on; state.char.sup = false; break;
      case "nosupersub": flushText(); state.char.sup = false; state.char.sub = false; break;
      case "fs": flushText(); state.char.size = param ?? DEFAULT_FONT_HALF_POINTS; break;
      case "f": flushText(); state.char.font = param ?? 0; break;
      case "cf": flushText(); state.char.color = param ?? 0; break;
      case "highlight": case "cb": case "chcbpat": flushText(); state.char.highlight = param ?? 0; break;
      case "ql": state.para.align = "left"; break;
      case "qc": state.para.align = "center"; break;
      case "qr": state.para.align = "right"; break;
      case "qj": state.para.align = "justify"; break;
      case "li": state.para.left = param ?? 0; break;
      case "ri": state.para.right = param ?? 0; break;
      case "fi": state.para.first = param ?? 0; break;
      case "sb": state.para.before = param ?? 0; break;
      case "sa": state.para.after = param ?? 0; break;
      case "intbl": state.para.inTable = true; break;
      case "trowd": flushText(); break;
      // A cell's last paragraph usually ends with \par already; only text still open becomes one more.
      // \cell ends a cell even when its paragraph never said \intbl (some writers omit it), so the
      // text it closes belongs to the table.
      case "cell": flushText(); state.para.inTable = true; if (runs.length) endParagraph(); rows ??= []; row.push(cell); cell = []; break;
      case "row": flushText(); rows ??= []; if (cell.length) row.push(cell); rows.push(row); row = []; cell = []; break;
      case "uc": state.uc = param ?? 1; break;
      case "u": {
        const code = param === null ? 63 : param < 0 ? param + 65536 : param;
        emit(String.fromCharCode(code));
        // The next `uc` characters are a fallback for readers without Unicode.
        skipFallback = state.uc;
        break;
      }
      default:
        if (word in SYMBOLS) emit(SYMBOLS[word]);
    }
  }
  flushText();
  if (runs.length) endParagraph();
  closeTable();
  return blocks;
}

const twipsToPt = (twips: number) => `${Math.round((twips / 20) * 10) / 10}pt`;

function renderRuns(runs: Run[], fonts: Map<number, string>, colors: string[]): string {
  return runs.map(({ text, char }) => {
    const style: string[] = [];
    if (char.bold) style.push("font-weight:700");
    if (char.italic) style.push("font-style:italic");
    const lines = [char.underline && "underline", char.strike && "line-through"].filter(Boolean);
    if (lines.length) style.push(`text-decoration:${lines.join(" ")}`);
    if (char.size !== DEFAULT_FONT_HALF_POINTS) style.push(`font-size:${char.size / 2}pt`);
    const font = fonts.get(char.font);
    if (font) style.push(`font-family:'${font}',${/courier|mono|consol/i.test(font) ? "monospace" : "serif"}`);
    if (char.color && colors[char.color]) style.push(`color:${colors[char.color]}`);
    if (char.highlight && colors[char.highlight]) style.push(`background:${colors[char.highlight]}`);
    const content = escapeHtml(text).replace(/\n/g, "<br>");
    const tag = char.sup ? "sup" : char.sub ? "sub" : "span";
    return style.length || tag !== "span" ? `<${tag}${style.length ? ` style="${style.join(";")}"` : ""}>${content}</${tag}>` : content;
  }).join("");
}

function renderParagraph({ para, runs }: Paragraph, fonts: Map<number, string>, colors: string[]): string {
  const style = [`text-align:${para.align}`];
  if (para.left) style.push(`margin-left:${twipsToPt(para.left)}`);
  if (para.right) style.push(`margin-right:${twipsToPt(para.right)}`);
  if (para.first) style.push(`text-indent:${twipsToPt(para.first)}`);
  if (para.before) style.push(`margin-top:${twipsToPt(para.before)}`);
  if (para.after) style.push(`margin-bottom:${twipsToPt(para.after)}`);
  const content = renderRuns(runs, fonts, colors);
  return `<p style="${style.join(";")}">${content || "<br>"}</p>`;
}

/** RTF (a document or a fragment) as an HTML body: escaped text, inline styles only. */
export function rtfToHtml(source: string): string {
  const rtf = wrapRtfFragment(source);
  const fonts = readFonts(rtf);
  const colors = readColors(rtf);
  return parse(rtf).map((block) => {
    if (block.kind === "page") return '<hr class="rtf-page">';
    if (block.kind === "p") return renderParagraph(block.paragraph, fonts, colors);
    const body = block.rows.map((cells) => `<tr>${cells.map((paragraphs) => `<td>${paragraphs.map((p) => renderParagraph(p, fonts, colors)).join("")}</td>`).join("")}</tr>`).join("");
    return `<table class="rtf-table">${body}</table>`;
    // No separator: the body keeps white space (code indentation), so a newline here would show.
  }).join("");
}

/** Base styles for the rendered document (Times-like body, tables with borders, page breaks). */
export const RTF_STYLES = [
  "body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.35;white-space:pre-wrap;tab-size:4}",
  "p{margin:0}",
  // Words break inside a cell only when one cannot fit at all, so narrow columns keep whole words.
  ".rtf-table{border-collapse:collapse;margin:8pt 0;white-space:normal;overflow-wrap:normal}",
  ".rtf-table td{border:1px solid #bbb;padding:4pt 8pt;vertical-align:top;overflow-wrap:break-word}",
  ".rtf-page{border:none;border-top:1px dashed #ccc;margin:24pt 0}",
].join("");
