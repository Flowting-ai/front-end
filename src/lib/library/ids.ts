// Ids reach URLs and request paths, so the shape is checked at the route before anything uses it.
// Real ids are UUIDs; the pattern is looser only so sample ids ("f_acme") work in the mock.

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidFileId(value: string): boolean {
  return SAFE_ID.test(value);
}
