import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// A tiny History-API router (no external dependency).
const RouterCtx = createContext(null)

const read = () => ({ pathname: window.location.pathname.replace(/\/+$/, '') || '/', search: window.location.search, hash: window.location.hash })

export function Router({ children }) {
  const [loc, setLoc] = useState(read)

  useEffect(() => {
    const onPop = () => setLoc(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, { replace = false, scroll = true } = {}) => {
    const url = new URL(to, window.location.origin)
    const next = url.pathname + url.search + url.hash
    if (next === window.location.pathname + window.location.search + window.location.hash) return
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next)
    const samePath = url.pathname === window.location.pathname
    setLoc({ pathname: url.pathname.replace(/\/+$/, '') || '/', search: url.search, hash: url.hash })
    if (scroll && !samePath) window.scrollTo(0, 0)
  }, [])

  const value = useMemo(() => ({ ...loc, navigate }), [loc, navigate])
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>
}

export const useRouter = () => useContext(RouterCtx)
export const useNavigate = () => useContext(RouterCtx).navigate
export const useLocation = () => {
  const { pathname, search, hash } = useContext(RouterCtx)
  return { pathname, search, hash }
}

export function useSearchParams() {
  const { search, navigate, pathname } = useContext(RouterCtx)
  const params = useMemo(() => new URLSearchParams(search), [search])
  const setParams = useCallback(
    (next, opts = { replace: true }) => {
      const p = new URLSearchParams()
      Object.entries(next).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v))
      })
      const qs = p.toString()
      navigate(pathname + (qs ? `?${qs}` : ''), { replace: opts.replace, scroll: false })
    },
    [navigate, pathname],
  )
  return [params, setParams]
}

export function Link({ to, children, replace, onClick, target, ...rest }) {
  const { navigate } = useContext(RouterCtx)
  const external = /^(https?:|mailto:|tel:)/.test(to)
  const handle = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || external || target === '_blank' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to, { replace })
  }
  return (
    <a href={to} onClick={handle} target={target} {...rest}>
      {children}
    </a>
  )
}

// Match "/product/:slug" style patterns
export function matchPath(pattern, pathname) {
  const a = pattern.split('/').filter(Boolean)
  const b = pathname.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

export function Routes({ routes, fallback }) {
  const { pathname } = useContext(RouterCtx)
  for (const r of routes) {
    const params = matchPath(r.path, pathname)
    if (params) return r.render(params)
  }
  return fallback
}
