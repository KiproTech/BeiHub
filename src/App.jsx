import { lazy, Suspense, useEffect } from 'react'
import { Router, Routes, useLocation } from './lib/router.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { ListProvider } from './context/ListContext.jsx'
import { Footer, FloatingListBar, Header } from './components/Layout.jsx'
import { Spinner } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import Product from './pages/Product.jsx'
import OrderList from './pages/OrderList.jsx'
import Checkout from './pages/Checkout.jsx'
import Confirmation from './pages/Confirmation.jsx'
import NotFound from './pages/NotFound.jsx'

const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))

const routes = [
  { path: '/', render: () => <Home /> },
  { path: '/shop', render: () => <Shop /> },
  { path: '/product/:slug', render: (p) => <Product key={p.slug} slug={p.slug} /> },
  { path: '/order-list', render: () => <OrderList /> },
  { path: '/checkout', render: () => <Checkout /> },
  { path: '/order-confirmation', render: () => <Confirmation /> },
]

function PublicSite() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [pathname, hash])
  return (
    <div className="site">
      <a href="#main" className="skip">Skip to content</a>
      <Header />
      <main id="main">
        <Routes routes={routes} fallback={<NotFound />} />
      </main>
      <Footer />
      <FloatingListBar />
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return (
      <Suspense fallback={<Spinner label="Loading admin" />}>
        <AdminApp />
      </Suspense>
    )
  return <PublicSite />
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <ListProvider>
              <Shell />
            </ListProvider>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  )
}
