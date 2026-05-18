const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://d1g.uk",
  "https://beta.d1g.uk",
  "https://development.d1g.uk",
];

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_ORIGINS;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function corsHeaders(
  request: Request,
  allowed: string[],
): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Edit-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
