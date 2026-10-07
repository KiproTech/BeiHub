import { lazy, Suspense, useEffect } from 'react'
import { Router, Routes, useLocation, useNavigate } from './lib/router.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { ListProvider } from './context/ListContext.jsx'
import { Footer, FloatingListBar, Header } from './components/Layout.jsx'
import { Spinner } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Products from './pages/Products.jsx'
import Categories from './pages/Categories.jsx'
import { About, Contact } from './pages/Info.jsx'
import Product from './pages/Product.jsx'
import OrderList from './pages/OrderList.jsx'
import Checkout from './pages/Checkout.jsx'
import Confirmation from './pages/Confirmation.jsx'
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from './pages/Auth.jsx'
import { MyOrders, OrderDetail, NotificationsPage, ProfilePage } from './pages/Account.jsx'
import NotFound from './pages/NotFound.jsx'

const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))

const routes = [
  { path: '/', render: () => <Home /> },
  { path: '/products', render: () => <Products /> },
  { path: '/shop', render: () => <LegacyProducts /> },
  { path: '/categories', render: () => <Categories /> },
  { path: '/about', render: () => <About /> },
  { path: '/contact', render: () => <Contact /> },
  { path: '/product/:slug', render: (p) => <Product key={p.slug} slug={p.slug} /> },
  { path: '/order-list', render: () => <OrderList /> },
  { path: '/checkout', render: () => <Checkout /> },
  { path: '/order-confirmation', render: () => <Confirmation /> },
  { path: '/shops', render: () => <LegacyProducts /> },
  { path: '/login', render: () => <Login /> },
  { path: '/register', render: () => <Register /> },
  { path: '/verify-email', render: () => <VerifyEmail /> },
  { path: '/forgot-password', render: () => <ForgotPassword /> },
  { path: '/reset-password', render: () => <ResetPassword /> },
  { path: '/account', render: () => <MyOrders /> },
  { path: '/account/orders', render: () => <MyOrders /> },
  { path: '/account/orders/:id', render: (p) => <OrderDetail key={p.id} id={p.id} /> },
  { path: '/account/notifications', render: () => <NotificationsPage /> },
  { path: '/account/profile', render: () => <ProfilePage /> },
]

// old bookmarks (/shop, /shops) land on the product list
function LegacyProducts() {
  const navigate = useNavigate()
  const { search } = useLocation()
  useEffect(() => navigate(`/products${search}`, { replace: true }), [navigate, search])
  return <Spinner />
}

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
            <NotificationProvider>
              <ListProvider>
                <Shell />
              </ListProvider>
            </NotificationProvider>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  )
}
