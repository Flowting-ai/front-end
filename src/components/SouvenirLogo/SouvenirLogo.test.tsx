import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SouvenirLogo } from "./index";
import { ThemedLlmIcon } from "../ThemedLlmIcon";
import { THEMING_ENABLED } from "@/lib/feature-flags";

describe("SouvenirLogo", () => {
  it("always renders the original mark for light", () => {
    const html = renderToStaticMarkup(<SouvenirLogo size={24} />);
    expect(html).toContain("souvenir-logo.svg");
    const gray = renderToStaticMarkup(<SouvenirLogo variant="gray" size={24} />);
    expect(gray).toContain("souvenir-logo-gray.svg");
  });

  it.runIf(THEMING_ENABLED)("also renders the white mark, swapped by CSS class", () => {
    const html = renderToStaticMarkup(<SouvenirLogo size={24} />);
    expect(html).toContain("souvenir-logo-white.svg");
    expect(html).toContain("kds-logo-light");
    expect(html).toContain("kds-logo-dark");
  });

  it.skipIf(THEMING_ENABLED)("renders a single plain image when theming is off", () => {
    const html = renderToStaticMarkup(<SouvenirLogo size={24} />);
    expect(html).not.toContain("souvenir-logo-white.svg");
    expect((html.match(/<img/g) ?? []).length).toBe(1);
  });

  it("exposes a caller's display to the dark rule", () => {
    const html = renderToStaticMarkup(<SouvenirLogo size={24} style={{ display: "inline-block" }} />);
    expect(html).toContain("display:inline-block");
  });
});

describe("ThemedLlmIcon", () => {
  it.runIf(THEMING_ENABLED)("renders colour and white variants", () => {
    const html = renderToStaticMarkup(<ThemedLlmIcon id="OpenAI" size={20} />);
    expect(html).toContain("kds-llm-color");
    expect(html).toContain("kds-llm-mono");
  });

  it("always renders the colour logo", () => {
    const html = renderToStaticMarkup(<ThemedLlmIcon id="OpenAI" size={20} />);
    expect(html).toContain("<img");
  });
});
