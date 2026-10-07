// Remembers where a visitor wanted to go (e.g. /checkout) while they log in, register or verify their email.
const KEY = 'beihub.next'
export const safeNext = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/admin') ? p : '')
export const rememberNext = (p) => {
  try {
    const s = safeNext(p)
    if (s) localStorage.setItem(KEY, s)
  } catch {
    /* ignore */
  }
}
export const takeNext = () => {
  try {
    const v = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    return safeNext(v)
  } catch {
    return ''
  }
}
export const peekNext = () => {
  try {
    return safeNext(localStorage.getItem(KEY))
  } catch {
    return ''
  }
}
