import { describe, expect, it } from "vitest";
import { preprocessMarkdown } from "./markdown-utils";

describe("preprocessMarkdown", () => {
  it("converts separate \\(...\\) spans without swallowing the plain text between them", () => {
    const input =
      "\\(\\varphi(n)\\) counts the integers from \\(1\\) to \\(n\\) that share no common factor with \\(n\\) other than \\(1\\).";
    const output = preprocessMarkdown(input);

    // Each \(...\) became its own $...$ span — plain words in between must
    // survive untouched, not get absorbed into one bogus math run.
    expect(output).toContain("$\\varphi(n)$ counts the integers from $1$ to $n$ that share no common factor with $n$ other than $1$.");
    // No leaked HTML-entity dollar sign from the currency guard misfiring on
    // a freshly-converted math span.
    expect(output).not.toContain("&#36;");
  });

  it("still escapes genuine currency text so it isn't misread as math", () => {
    const input = "Plans run from $50-150/mo depending on the tier, and enterprise starts at $500+/mo.";
    const output = preprocessMarkdown(input);

    expect(output).toContain("&#36;50-150/mo");
    expect(output).toContain("&#36;500+/mo");
  });

  it("converts \\[...\\] into a display-math block on its own lines", () => {
    const input = "Then:\n\n\\[\n\\varphi(n)=n\\left(1-\\frac1{p_1}\\right)\n\\]\n\nand that's it.";
    const output = preprocessMarkdown(input);

    expect(output).toContain("$$\n\\varphi(n)=n\\left(1-\\frac1{p_1}\\right)\n$$");
  });

  it("leaves a bare single-token \\(...\\) math span intact even though its content alone wouldn't look like math", () => {
    const output = preprocessMarkdown("Let \\(x\\) be an integer.");
    expect(output).toBe("Let $x$ be an integer.");
  });
});
