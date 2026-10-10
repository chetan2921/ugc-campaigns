const KEY = "token";

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function saveToken(token: string) {
  try { localStorage.setItem(KEY, token); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(KEY); } catch {}
}
