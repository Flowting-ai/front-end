const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.trim().replace(/^urn:uuid:/i, "").toLowerCase();
  return isValidUUID(stripped) ? stripped : null;
}
