const DEFAULT_MODEL_ICON = "/default-icon.svg";

const COMPANY_ICON_MAP: Record<string, string> = {
  openai: "/open.svg",
  anthropic: "/claude.svg",
  google: "/gemini.svg",
  "mistral ai": "/mistral.svg",
};

export const getModelIcon = (companyName?: string | null) => {
  if (!companyName) return DEFAULT_MODEL_ICON;
  const normalized = companyName.trim().toLowerCase();
  return COMPANY_ICON_MAP[normalized] ?? DEFAULT_MODEL_ICON;
};

export { DEFAULT_MODEL_ICON };
