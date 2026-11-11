import { describe, expect, it } from "vitest";
import { decodeWords, parseEmail } from "./eml";

const multipart = [
  "From: =?utf-8?B?SsO8cmdlbg==?= <j@example.com>",
  "To: team@example.com",
  "Subject: Quarterly",
  "  numbers",
  "Date: Mon, 5 Oct 2026 10:00:00 +0000",
  'Content-Type: multipart/mixed; boundary="outer"',
  "",
  "preamble",
  "--outer",
  'Content-Type: multipart/alternative; boundary="inner"',
  "",
  "--inner",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Caf=C3=A9 numbers are =",
  "up.",
  "--inner",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  btoa("<p>Hello <b>team</b></p>"),
  "--inner--",
  "--outer",
  'Content-Type: application/pdf; name="report.pdf"',
  'Content-Disposition: attachment; filename="report.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0=",
  "--outer--",
].join("\r\n");

describe("parseEmail", () => {
  it("reads headers, both bodies and the attachment list", () => {
    const email = parseEmail(multipart);
    expect(email.headers).toEqual({ from: "Jürgen <j@example.com>", to: "team@example.com", cc: "", date: "Mon, 5 Oct 2026 10:00:00 +0000", subject: "Quarterly numbers" });
    expect(email.text).toBe("Café numbers are up.");
    expect(email.html).toBe("<p>Hello <b>team</b></p>");
    expect(email.attachments).toEqual(["report.pdf"]);
  });

  it("treats a message with no content type as plain text", () => {
    const email = parseEmail("Subject: Hi\n\nJust text.\n");
    expect(email.text).toBe("Just text.\n");
    expect(email.html).toBeNull();
  });

  it("reads a part with no headers as plain text, first paragraph included", () => {
    const email = parseEmail(['Content-Type: multipart/mixed; boundary="b"', "", "--b", "", "First paragraph.", "", "Second.", "--b--"].join("\n"));
    expect(email.text).toBe("First paragraph.\n\nSecond.");
  });

  it("decodes Q encoded words", () => {
    expect(decodeWords("=?utf-8?Q?R=C3=A9sum=C3=A9_ready?=")).toBe("Résumé ready");
  });
});
