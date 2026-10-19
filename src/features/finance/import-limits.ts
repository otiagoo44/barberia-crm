// Base64 + mapping must fit below Vercel's 4.5 MB function payload limit.
export const MAX_IMPORT_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_JSON_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORT_BASE64_LENGTH =
  Math.ceil(MAX_IMPORT_UPLOAD_BYTES / 3) * 4;
