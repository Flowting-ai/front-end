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
  meta: "/meta.svg",
  llama: "/meta.svg",
  moonshot: "/kimi.svg",
  "moonshotai": "/kimi.svg",
  kimi: "/kimi.svg",
  qwen: "/Qwen.svg",
};

export const getModelIcon = (
  companyName?: string | null,
  modelName?: string | null,
  providerHint?: string | null
) => {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const keywords = Object.keys(ICON_BY_KEYWORD);
  const candidates = [
    companyName || "",
    modelName || "",
    providerHint || "",
    `${companyName || ""} ${modelName || ""}`.trim(),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  if (candidates.length === 0) return DEFAULT_MODEL_ICON;

  const match = keywords.find((key) => {
    const normalizedKey = normalize(key);
    return candidates.some((candidate) => {
      // Ensure candidate is a string
      if (typeof candidate !== 'string') return false;
      const raw = candidate.toLowerCase();
      const normalized = normalize(candidate);
      return raw.includes(key) || normalized.includes(normalizedKey);
    });
  });

  if (match) {
    return ICON_BY_KEYWORD[match];
  }

  return DEFAULT_MODEL_ICON;
};

export { DEFAULT_MODEL_ICON };
