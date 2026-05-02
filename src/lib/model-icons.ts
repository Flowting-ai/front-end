const DEFAULT_MODEL_ICON = "/icons/logo/souvenir-logo.svg";

const ICON_BY_KEYWORD: Record<string, string> = {
  openai: "/icons/logo/open.svg",
  gpt: "/icons/logo/open.svg",
  anthropic: "/icons/logo/claude.svg",
  claude: "/icons/logo/claude.svg",
  google: "/icons/logo/gemini.svg",
  gemini: "/icons/logo/gemini.svg",
  mistral: "/icons/logo/mistral.svg",
  mixtral: "/icons/logo/mistral.svg",
  meta: "/icons/logo/meta.svg",
  llama: "/icons/logo/meta.svg",
  moonshot: "/icons/logo/kimi.svg",
  moonshotai: "/icons/logo/kimi.svg",
  kimi: "/icons/logo/kimi.svg",
  qwen: "/icons/logo/qwen.svg",
  deepseek: "/icons/logo/deepseek.svg",
  grok: "/icons/logo/grok.svg",
  "x-ai": "/icons/logo/grok.svg",
  xai: "/icons/logo/grok.svg",
};

export const getModelIcon = (
  companyName?: string | null,
  modelName?: string | null,
  providerHint?: string | null,
): string => {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const candidates = [
    companyName || "",
    modelName || "",
    providerHint || "",
    `${companyName || ""} ${modelName || ""}`.trim(),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (candidates.length === 0) return DEFAULT_MODEL_ICON;

  const keywords = Object.keys(ICON_BY_KEYWORD);
  const match = keywords.find((key) => {
    const normalizedKey = normalize(key);
    return candidates.some((candidate) => {
      const raw = candidate.toLowerCase();
      const normalized = normalize(candidate);
      return raw.includes(key) || normalized.includes(normalizedKey);
    });
  });

  return match ? ICON_BY_KEYWORD[match] : DEFAULT_MODEL_ICON;
};

export { DEFAULT_MODEL_ICON };
