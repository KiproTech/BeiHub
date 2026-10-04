import { useEffect, useState } from 'react'
import { Link, Routes, useLocation, useNavigate } from '../../lib/router.jsx'
import { Icon, LogoMark } from '../../components/Icons.jsx'
import { Spinner } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useStore } from '../../context/StoreContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { DEMO_ADMIN, IS_DEMO } from '../../lib/config.js'
import { AdminProvider, useAdmin } from './AdminContext.jsx'
import Dashboard from './Dashboard.jsx'
import Products from './Products.jsx'
import ProductEditor from './ProductEditor.jsx'
import Categories from './Categories.jsx'
import Orders, { OrderDetail } from './Orders.jsx'
import Customers from './Customers.jsx'
import Delivery from './Delivery.jsx'
import Settings from './Settings.jsx'
import '../../styles/admin.css'

const NAV = [
  { to: '/admin', icon: 'dash', label: 'Dashboard', exact: true },
  { to: '/admin/products', icon: 'box', label: 'Products' },
  { to: '/admin/categories', icon: 'grid', label: 'Categories' },
  { to: '/admin/orders', icon: 'list', label: 'Orders' },
  { to: '/admin/customers', icon: 'users', label: 'Customers' },
  { to: '/admin/delivery', icon: 'truck', label: 'Delivery' },
  { to: '/admin/settings', icon: 'settings', label: 'Settings' },
]

function Login() {
  const { signIn, user, signOut } = useAuth()
  const [email, setEmail] = useState(IS_DEMO ? DEMO_ADMIN.email : '')
  const [password, setPassword] = useState(IS_DEMO ? DEMO_ADMIN.password : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><LogoMark size={46} /><div><b>BeiHub</b><span>Admin sign in</span></div></div>
        {user && user.role !== 'admin' ? (
          <>
            <div className="notice notice-bad">You are signed in as {user.email}, but this account is not an admin. Ask the owner to give you admin access.</div>
            <button type="button" className="btn btn-outline btn-block" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            {IS_DEMO && <div className="notice notice-warn">Demo mode. Use <b>{DEMO_ADMIN.email}</b> / <b>{DEMO_ADMIN.password}</b> (already filled in).</div>}
            {error && <div className="notice notice-bad" role="alert">{error}</div>}
            <label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
          </>
        )}
        <Link to="/" className="login-back">Back to the shop</Link>
      </form>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { settings } = useStore()
  const { loading, error, reload, orders } = useAdmin()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  const newOrders = orders.filter((o) => o.status === 'pending').length

  const routes = [
    { path: '/admin', render: () => <Dashboard /> },
    { path: '/admin/products', render: () => <Products /> },
    { path: '/admin/products/new', render: () => <ProductEditor key="new" /> },
    { path: '/admin/products/:id', render: (p) => <ProductEditor key={p.id} id={p.id} /> },
    { path: '/admin/categories', render: () => <Categories /> },
    { path: '/admin/orders', render: () => <Orders /> },
    { path: '/admin/orders/:id', render: (p) => <OrderDetail key={p.id} id={p.id} /> },
    { path: '/admin/customers', render: () => <Customers /> },
    { path: '/admin/delivery', render: () => <Delivery /> },
    { path: '/admin/settings', render: () => <Settings /> },
  ]

  return (
    <div className="admin">
      <header className="admin-top">
        <button className="icon-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <b>{settings.business_name} Admin</b>
        <Link to="/" className="btn btn-sm btn-outline">View shop</Link>
      </header>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
      <aside className={`admin-side ${open ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <LogoMark size={36} />
          <div><b>{settings.business_name}</b><span>Admin</span></div>
          <button className="icon-btn admin-close" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav>
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + '/')
            return (
              <Link key={n.to} to={n.to} className={`admin-link ${active ? 'is-active' : ''}`}>
                <Icon name={n.icon} size={20} /> {n.label}
                {n.to === '/admin/orders' && newOrders > 0 && <span className="badge-n">{newOrders}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="admin-foot">
          <Link to="/" className="admin-link"><Icon name="eye" size={20} /> View shop</Link>
          <button className="admin-link" onClick={async () => { await signOut(); navigate('/admin') }}><Icon name="logout" size={20} /> Sign out</button>
          <small>{user?.email}</small>
        </div>
      </aside>
      <main className="admin-main">
        {error && <div className="notice notice-bad">{error} <button className="btn btn-sm btn-outline" onClick={() => reload()}>Retry</button></div>}
        {loading ? <Spinner /> : <Routes routes={routes} fallback={<div className="notice notice-warn">Page not found.</div>} />}
      </main>
    </div>
  )
}

export default function AdminApp() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user || user.role !== 'admin') return <Login />
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  )
}
