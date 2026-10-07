import { CONFIG_PROBLEM } from '../lib/config.js'

// Shown instead of the site when Supabase is not configured. BeiHub never falls back to
// browser-only data, because then every device would see a different version of the store.
export default function SetupRequired() {
  return (
    <main style={{ maxWidth: 640, margin: '8vh auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.55, color: '#10222B' }}>
      <h1 style={{ marginBottom: 8 }}>BeiHub needs its database connection</h1>
      <p><b>{CONFIG_PROBLEM}</b></p>
      <p>All store information (products, prices, contact details, orders) lives in Supabase so that every phone and computer sees the same data. Connect it once:</p>
      <ol>
        <li>In Supabase open <b>Project Settings &rarr; API</b> and copy the <b>Project URL</b> and the <b>anon public</b> key.</li>
        <li>Put them in a file called <code>.env</code> in the project folder (local) or in your hosting provider&apos;s <b>Environment Variables</b> (Vercel / Netlify):
          <pre style={{ background: '#f1f5f7', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{'VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-public-key'}</pre>
        </li>
        <li>Restart <code>npm run dev</code>, or redeploy the site. The values are read when the site is built.</li>
      </ol>
      <p style={{ color: '#5b6b73', fontSize: 14 }}>The README explains the one-time database setup (SQL files) step by step.</p>
    </main>
  )
}
