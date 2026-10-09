import { useEffect, useState } from 'react'
import { Link, Routes, useLocation, useNavigate } from '../../lib/router.jsx'
import { Icon, LogoMark } from '../../components/Icons.jsx'
import { Spinner } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useStore } from '../../context/StoreContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { AdminProvider, useAdmin } from './AdminContext.jsx'
import Dashboard from './Dashboard.jsx'
import Products from './Products.jsx'
import ProductEditor from './ProductEditor.jsx'
import Categories from './Categories.jsx'
import Orders, { OrderDetail } from './Orders.jsx'
import Customers from './Customers.jsx'
import Delivery from './Delivery.jsx'
import Settings from './Settings.jsx'
import Media from './Media.jsx'
import Audit from './Audit.jsx'
import Administrators from './Administrators.jsx'
import AcceptInvite from './AcceptInvite.jsx'
import '../../styles/admin.css'

// `any` = the permissions that open a section (the person needs at least one). Only the menu and the screens
// depend on this; the database enforces the same rules on every request.
const ORDERS_VIEW = ['MANAGE_ORDERS', 'UPDATE_ORDER_STATUS', 'CANCEL_ORDERS', 'MANAGE_CUSTOMERS', 'VIEW_REPORTS']
const PRODUCTS = ['MANAGE_PRODUCTS', 'MANAGE_PRODUCT_PRICES', 'MANAGE_PRODUCT_IMAGES']
const NAV = [
  { to: '/admin', icon: 'dash', label: 'Dashboard', exact: true },
  { to: '/admin/orders', icon: 'list', label: 'Orders', any: ORDERS_VIEW },
  { to: '/admin/products', icon: 'box', label: 'Products', any: PRODUCTS },
  { to: '/admin/categories', icon: 'grid', label: 'Categories', any: ['MANAGE_PRODUCTS'] },
  { to: '/admin/customers', icon: 'users', label: 'Customers', any: ['MANAGE_CUSTOMERS'] },
  { to: '/admin/delivery', icon: 'truck', label: 'Delivery', any: ['MANAGE_BUSINESS_SETTINGS'] },
  { to: '/admin/media', icon: 'image', label: 'Media', any: ['MANAGE_MEDIA'] },
  { to: '/admin/settings', icon: 'settings', label: 'Business Settings', any: ['MANAGE_BUSINESS_SETTINGS'] },
  { to: '/admin/audit', icon: 'history', label: 'Audit Logs', any: ['VIEW_AUDIT_LOGS'] },
  { to: '/admin/administrators', icon: 'shield', label: 'Administrators', any: ['MANAGE_ADMINS'], superArea: true },
]
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', customer: 'Customer' }

function NoAccess() {
  return (
    <div className="notice notice-warn" role="alert">
      <Icon name="lock" size={18} /> <span>Your account does not have permission to open this section. Ask the Super Admin if you need access.</span>
    </div>
  )
}
function Gate({ any, children }) {
  const { canAny } = useAuth()
  return canAny(any) ? children : <NoAccess />
}

function Login() {
  const { signIn, user, signOut, isStaff } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        <div className="login-brand"><LogoMark size={46} /><div><b>Admin</b><span>Sign in</span></div></div>
        {user && !isStaff ? (
          <>
            <div className="notice notice-bad">{user.suspended ? `The administrator account ${user.email} is suspended. Contact the Super Admin.` : `You are signed in as ${user.email}, but this account is not an administrator. Ask the Super Admin to invite you.`}</div>
            <button type="button" className="btn btn-outline btn-block" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            {error && <div className="notice notice-bad" role="alert">{error}</div>}
            <label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
          </>
        )}
        <Link to="/" className="login-back">Back to the website</Link>
      </form>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut, canAny } = useAuth()
  const { settings } = useStore()
  const { loading, error, reload, orders } = useAdmin()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  const newOrders = orders.filter((o) => o.status === 'pending').length

  const g = (any, el) => <Gate any={any}>{el}</Gate>
  const routes = [
    { path: '/admin', render: () => <Dashboard /> },
    { path: '/admin/products', render: () => g(PRODUCTS, <Products />) },
    { path: '/admin/products/new', render: () => g(['MANAGE_PRODUCTS'], <ProductEditor key="new" />) },
    { path: '/admin/products/:id', render: (p) => g(PRODUCTS, <ProductEditor key={p.id} id={p.id} />) },
    { path: '/admin/categories', render: () => g(['MANAGE_PRODUCTS'], <Categories />) },
    { path: '/admin/media', render: () => g(['MANAGE_MEDIA'], <Media />) },
    { path: '/admin/audit', render: () => g(['VIEW_AUDIT_LOGS'], <Audit />) },
    { path: '/admin/orders', render: () => g(ORDERS_VIEW, <Orders />) },
    { path: '/admin/orders/:id', render: (p) => g(ORDERS_VIEW, <OrderDetail key={p.id} id={p.id} />) },
    { path: '/admin/customers', render: () => g(['MANAGE_CUSTOMERS'], <Customers />) },
    { path: '/admin/delivery', render: () => g(['MANAGE_BUSINESS_SETTINGS'], <Delivery />) },
    { path: '/admin/settings', render: () => g(['MANAGE_BUSINESS_SETTINGS'], <Settings />) },
    { path: '/admin/administrators', render: () => g(['MANAGE_ADMINS'], <Administrators />) },
  ]

  return (
    <div className="admin">
      <header className="admin-top">
        <button className="icon-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <b>{settings.business_name} Admin</b>
        <span className="whoami">{ROLE_LABEL[user?.role]}</span>
        <Link to="/" className="btn btn-sm btn-outline">View website</Link>
      </header>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
      <aside className={`admin-side ${open ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <LogoMark size={36} />
          <div><b>{settings.business_name}</b><span>Admin</span></div>
          <button className="icon-btn admin-close" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav>
          {NAV.filter((n) => !n.any || canAny(n.any)).map((n) => {
            const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + '/')
            return (
              <Link key={n.to} to={n.to} className={`admin-link ${active ? 'is-active' : ''}`} title={n.superArea ? 'Super Admin area' : undefined}>
                <Icon name={n.icon} size={20} /> {n.label}
                {n.to === '/admin/orders' && newOrders > 0 && <span className="badge-n">{newOrders}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="admin-foot">
          <Link to="/" className="admin-link"><Icon name="eye" size={20} /> View website</Link>
          <button className="admin-link" onClick={async () => { await signOut(); navigate('/admin') }}><Icon name="logout" size={20} /> Sign out</button>
          <small>Signed in as <b>{user?.full_name || user?.email}</b><br />{ROLE_LABEL[user?.role]} &middot; {user?.email}</small>
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
  const { user, loading, isStaff } = useAuth()
  const { pathname } = useLocation()
  if (pathname === '/admin/accept-invite') return <AcceptInvite />   // reached from the invitation e-mail, before the person is an admin
  if (loading) return <Spinner />
  if (!user || !isStaff) return <Login />
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  )
}
