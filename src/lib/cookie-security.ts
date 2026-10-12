export function secureCookies() {
  if (process.env.NODE_ENV !== "production") return false;
  const local = ["localhost", "127.0.0.1"].includes(
    new URL(process.env.APP_URL ?? "https://invalid.example").hostname,
  );
  return !(local && process.env.COOKIE_SECURE === "false");
}
