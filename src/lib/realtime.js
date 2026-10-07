// Supabase Realtime, used ONLY as a "something changed, fetch it again" signal.
//
//   * The database is always the source of truth. An event never carries data that the UI uses;
//     it just makes the page re-read the rows from Supabase.
//   * If Realtime is blocked, slow or down, nothing breaks: useLiveRefresh() also refreshes
//     on a timer and whenever the tab regains focus.
//   * Row Level Security applies to Realtime: a customer only receives events for rows they may SELECT.
//   * The library is loaded on demand (dynamic import) so it does not slow down the first page.
import { useEffect, useRef } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { getAccessToken } from './supabase.js'

let clientPromise = null

function getClient() {
  if (!clientPromise) {
    clientPromise = import('@supabase/realtime-js').then(({ RealtimeClient }) => {
      const endpoint = `${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1`
      return new RealtimeClient(endpoint, {
        params: { apikey: SUPABASE_ANON_KEY, eventsPerSecond: 5 },
        // called on every (re)connect: always the current session token, never a stale copy
        accessToken: async () => (await getAccessToken()) || SUPABASE_ANON_KEY,
      })
    })
  }
  return clientPromise
}

let channelSeq = 0

// specs: [{ table: 'orders', filter?: 'user_id=eq.<uuid>' }]
// Returns a function that stops listening. onEvent(table) and onStatus(isConnected) are optional.
export async function subscribeChanges(specs, onEvent, onStatus) {
  const client = await getClient()
  const channel = client.channel(`beihub-live-${++channelSeq}`)
  specs.forEach(({ table, filter }) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => onEvent?.(table))
  })
  channel.subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))
  return () => {
    try {
      client.removeChannel(channel)
    } catch {
      /* already closed */
    }
  }
}

const DEBOUNCE_MS = 500        // many rows changing at once (e.g. reordering) -> one refresh
const MIN_GAP_MS = 4000        // never refresh more often than this because of focus / timers
const POLL_OFFLINE_MS = 30000  // Realtime not connected: ask the database every 30 s
const POLL_ONLINE_MS = 300000  // Realtime connected: 5 min safety net only

// Re-run `refresh()` whenever a watched table changes (Realtime), the tab is shown again,
// or - as a fallback - on a timer. `refresh` must read from Supabase and replace the UI state.
export function useLiveRefresh(specs, refresh, { enabled = true } = {}) {
  const fn = useRef(refresh)
  fn.current = refresh
  const key = JSON.stringify(specs)

  useEffect(() => {
    if (!enabled) return undefined
    let stopped = false
    let connected = false
    let off = () => {}
    let debounce = null
    let lastRun = Date.now()

    const run = () => {
      lastRun = Date.now()
      fn.current()
    }
    const onEvent = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => !stopped && run(), DEBOUNCE_MS)
    }
    const visible = () => document.visibilityState === 'visible'
    const onFocus = () => {
      if (visible() && Date.now() - lastRun > MIN_GAP_MS) run()
    }
    const tick = setInterval(() => {
      if (!visible()) return
      const gap = connected ? POLL_ONLINE_MS : POLL_OFFLINE_MS
      if (Date.now() - lastRun >= gap) run()
    }, 5000)

    subscribeChanges(JSON.parse(key), onEvent, (ok) => {
      const was = connected
      connected = ok
      if (ok && !was) onFocus() // (re)connected: catch up on anything missed while offline
    })
      .then((stop) => {
        if (stopped) stop()
        else off = stop
      })
      .catch(() => {
        /* Realtime unavailable: the timer + focus refresh keep the page current */
      })

    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      stopped = true
      clearTimeout(debounce)
      clearInterval(tick)
      off()
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [key, enabled])
}
