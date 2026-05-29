const IS_BETA =
  typeof window !== "undefined" && window.location.hostname.startsWith("beta.");

export const D1G_BASE_URL = IS_BETA ? "https://beta.d1g.uk" : "https://d1g.uk";
export const D1G_LABEL = IS_BETA ? "beta.d1g.uk" : "d1g.uk";
