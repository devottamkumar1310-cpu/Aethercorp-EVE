const rawUrl = process.env.NEXT_PUBLIC_API_URL || "";
if (!rawUrl && typeof window !== "undefined") {
  console.warn(
    "[EVE Config] NEXT_PUBLIC_API_URL is missing. Falling back to localhost (http://127.0.0.1:8000). " +
    "This will fail in production/Vercel unless local forwarding is active."
  );
}

export const API_BASE_URL =
  (rawUrl || "http://127.0.0.1:8000")
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");

if (typeof window !== "undefined") {
  console.log(`[EVE Config] API Base URL resolved to: ${API_BASE_URL}`);
}