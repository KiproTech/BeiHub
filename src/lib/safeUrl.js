// Only plain web links are ever rendered as hrefs (defence in depth: the database also validates them).
export const safeUrl = (u) => (/^https?:\/\/\S+$/i.test(String(u || '').trim()) ? String(u).trim() : null)
