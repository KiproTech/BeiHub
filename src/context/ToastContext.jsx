import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const Ctx = createContext(null)
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const id = useRef(0)
  const dismiss = useCallback((i) => setItems((x) => x.filter((t) => t.id !== i)), [])
  const push = useCallback(
    (message, tone = 'info') => {
      const i = ++id.current
      setItems((x) => [...x.slice(-2), { id: i, message, tone }])
      setTimeout(() => dismiss(i), tone === 'error' ? 6500 : 3200)
    },
    [dismiss],
  )
  const api = useMemo(() => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') }), [push])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
