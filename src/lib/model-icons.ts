const ID_BY_KEYWORD: Record<string, string> = {
  openai: "OpenAI",
  gpt: "OpenAI",
  anthropic: "Claude",
  claude: "Claude",
  google: "Gemini",
  gemini: "Gemini",
  mistral: "Mistral",
  mixtral: "Mistral",
  meta: "Meta",
  llama: "Meta",
  moonshot: "Moonshot",
  moonshotai: "Moonshot",
  kimi: "Kimi",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  grok: "Grok",
  "x-ai": "XAI",
  xai: "XAI",
};

export const getModelLlmId = (
  companyName?: string | null,
  modelName?: string | null,
  providerHint?: string | null,
): string | null => {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const candidates = [
    companyName || "",
    modelName || "",
    providerHint || "",
    `${companyName || ""} ${modelName || ""}`.trim(),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (candidates.length === 0) return null;

  const keywords = Object.keys(ID_BY_KEYWORD);
  const match = keywords.find((key) => {
    const normalizedKey = normalize(key);
    return candidates.some((candidate) => {
      const raw = candidate.toLowerCase();
      const normalized = normalize(candidate);
      return raw.includes(key) || normalized.includes(normalizedKey);
    });
  });

  return match ? ID_BY_KEYWORD[match] : null;
};
