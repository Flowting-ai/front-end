// Ids reach URLs and request paths, so the shape is checked at the route before anything uses it.
// File ids are UUIDs.

const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidFileId(value: string): boolean {
  return SAFE_ID.test(value);
}
