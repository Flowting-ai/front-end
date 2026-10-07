import { describe, expect, it } from "vitest";
import { preprocessMarkdown, readCodeBlock, withoutNode } from "./markdown-preprocess";

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

  it("rewrites an escaped dollar inside inline and display math so it can't end the span", () => {
    expect(preprocessMarkdown("Total: $\\$5 + x$ each.")).toBe("Total: $\\text{\\textdollar}5 + x$ each.");
    expect(preprocessMarkdown("$$\ny = \\$3\n$$")).toBe("$$\ny = \\text{\\textdollar}3\n$$");
    expect(preprocessMarkdown("Price: \\(\\$5\\)")).toBe("Price: $\\text{\\textdollar}5$");
  });

  it("leaves escaped dollars outside math and inside code alone", () => {
    expect(preprocessMarkdown("It costs \\$5 and \\$7.")).toBe("It costs \\$5 and \\$7.");
    expect(preprocessMarkdown("Code: `$a \\$ b$`")).toBe("Code: `$a \\$ b$`");
    expect(preprocessMarkdown("```\n$x = \\$1$\n```")).toBe("```\n$x = \\$1$\n```");
  });

  it("leaves ~~~ fences and indented code blocks alone", () => {
    expect(preprocessMarkdown("~~~bash\necho \\$HOME $x \\$y$\n~~~")).toBe("~~~bash\necho \\$HOME $x \\$y$\n~~~");
    expect(preprocessMarkdown("Run:\n\n    echo $a \\$b$\n\nThen $\\$1$.")).toBe(
      "Run:\n\n    echo $a \\$b$\n\nThen $\\text{\\textdollar}1$.",
    );
    // Indented text under a list item is list content, so math there is still fixed.
    expect(preprocessMarkdown("- item\n\n    $\\$5$")).toBe("- item\n\n    $\\text{\\textdollar}5$");
  });

  it("keeps currency and heading fixes out of ~~~ fences and list-item fences", () => {
    expect(preprocessMarkdown("~~~\nprice $5 and $6\n###define\n~~~")).toBe("~~~\nprice $5 and $6\n###define\n~~~");
    expect(preprocessMarkdown("1. Code:\n2. ```\n   $5 and $6\n   ```")).toBe("1. Code:\n2. ```\n   $5 and $6\n   ```");
    expect(preprocessMarkdown("Costs $5 and $6.")).toBe("Costs &#36;5 and &#36;6.");
  });
});

describe("readCodeBlock", () => {
  const pre = (className: unknown, text?: string) => ({
    type: "element",
    tagName: "pre",
    children: [{
      type: "element",
      tagName: "code",
      properties: className === undefined ? {} : { className },
      children: text === undefined ? [] : [{ type: "text", value: text }],
    }],
  });

  it("keeps the language class verbatim", () => {
    expect(readCodeBlock(pre(["language-c++"], "int x;\n"))).toEqual({ language: "c++", value: "int x;" });
    expect(readCodeBlock(pre(["language-objective-c"], "@end"))).toEqual({ language: "objective-c", value: "@end" });
  });

  it("returns an empty value (never 'undefined') for an empty block without a language", () => {
    expect(readCodeBlock(pre(undefined))).toEqual({ language: undefined, value: "" });
  });
});

describe("withoutNode", () => {
  it("drops react-markdown's node prop and keeps the rest", () => {
    expect(withoutNode({ node: { type: "element" }, id: "a", className: "b" })).toEqual({ id: "a", className: "b" });
  });
});
