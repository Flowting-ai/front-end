const DEFAULT_MODEL_ICON = "/default-icon.svg";

const ICON_BY_KEYWORD: Record<string, string> = {
  openai: "/open.svg",
  gpt: "/open.svg",
  anthropic: "/claude.svg",
  claude: "/claude.svg",
  google: "/gemini.svg",
  gemini: "/gemini.svg",
  mistral: "/mistral.svg",
  mixtral: "/mistral.svg",
  qwen: "/Qwen.svg",
};

export const getModelIcon = (
  companyName?: string | null,
  modelName?: string | null
) => {
  const haystack = `${companyName || ""} ${modelName || ""}`
    .toLowerCase()
    .trim();
  if (!haystack) return DEFAULT_MODEL_ICON;

  const match = Object.keys(ICON_BY_KEYWORD).find((key) =>
    haystack.includes(key)
  );

  if (match) {
    return ICON_BY_KEYWORD[match];
  }

  return DEFAULT_MODEL_ICON;
};

export { DEFAULT_MODEL_ICON };
