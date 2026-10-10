const POST_URL = /^https?:\/\/(?:www\.)?instagram\.com\/(p|reels?|tv)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/;

/** Same rule as the API, so creators see a problem while typing, not after submitting. */
export function parseInstagramUrl(text: string): { kind: string; shortcode: string } | null {
  const m = text.trim().match(POST_URL);
  return m ? { kind: m[1], shortcode: m[2] } : null;
}
