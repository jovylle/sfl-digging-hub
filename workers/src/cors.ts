const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://d1g.uk",
  "https://beta.d1g.uk",
  "https://development.d1g.uk",
  "https://hub.d1g.uk",
  "https://beta.hub.d1g.uk",
];

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_ORIGINS;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

function isAllowedOrigin(origin: string, allowed: string[]): boolean {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(origin)) return true;
  if (/^http:\/\/localhost:\d+$/i.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true;
  return false;
}

export function corsHeaders(
  request: Request,
  allowed: string[],
): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(origin, allowed)
    ? origin
    : allowed[0] ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization, X-Edit-Token, X-Hub-Write-Secret, X-Session-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
