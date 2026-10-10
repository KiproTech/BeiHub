import { Link, useLocation } from '../lib/router.jsx'
import { Icon, LogoMark, WhatsAppIcon } from './Icons.jsx'
import SearchBox from './SearchBox.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useList } from '../context/ListContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { money } from '../lib/format.js'
import { waLink } from '../lib/whatsapp.js'
import { safeUrl } from '../lib/safeUrl.js'

export function Brand({ light, compact }) {
  const { settings, media } = useStore()
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={`${settings.business_name} home`}>
      {(media.logo?.url || settings.logo_url) ? <img src={media.logo?.url || settings.logo_url} alt="" className="brand-logo" /> : <LogoMark size={compact ? 34 : 40} />}
      <span className="brand-name">{settings.business_name}</span>
    </Link>
  )
}

const NAV = [
  { to: '/', label: 'Home', match: (p) => p === '/' },
  { to: '/products', label: 'Products', match: (p) => p === '/products' || p.startsWith('/product/') },
  { to: '/categories', label: 'Categories', match: (p) => p === '/categories' },
  { to: '/account/orders', label: 'My Orders', match: (p) => p.startsWith('/account') },
  { to: '/about', label: 'About', match: (p) => p === '/about' },
  { to: '/contact', label: 'Contact', match: (p) => p === '/contact' },
]

export function Header() {
  const { settings } = useStore()
  const { count, totals } = useList()
  const { user } = useAuth()
  const { unread } = useNotifications()
  const { pathname, search } = useLocation()
  const q = new URLSearchParams(search)
  const wa = settings.whatsapp
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap topbar-in">
          <span className="topbar-msg">{settings.deposit_percent != null && <><Icon name="wallet" size={16} /> Deposit of up to {settings.deposit_percent}% may be required to confirm orders</>}</span>
          <span className="topbar-links">
            {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, '')}`}><Icon name="phone" size={15} /> {settings.phone}</a>}
            {wa && <a href={waLink(wa, 'Hello, I would like to ask about a product.')} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp</a>}
          </span>
        </div>
      </div>
      <div className="mainbar">
        <div className="wrap mainbar-in">
          <Brand compact />
          <SearchBox initial={pathname === '/products' ? q.get('q') || '' : ''} className="mainbar-search" placeholder="Search products..." />
          <nav className="acctnav" aria-label="Account">
            {user ? (
              <>
                <Link to="/account/notifications" className="acctlink" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Icon name="bell" size={20} />{unread > 0 && <span className="listbtn-count acct-badge">{unread}</span>}</Link>
                <Link to={['admin', 'super_admin'].includes(user.role) ? '/admin' : '/account/orders'} className="acctlink"><Icon name="user" size={20} /><span>{['admin', 'super_admin'].includes(user.role) ? 'Admin' : 'My orders'}</span></Link>
              </>
            ) : (
              <Link to="/login" className="acctlink"><Icon name="user" size={20} /><span>Log in</span></Link>
            )}
          </nav>
          <Link to="/order-list" className="listbtn" aria-label={`Order List, ${count} items`}>
            <Icon name="list" size={22} />
            <span className="listbtn-text">Order List</span>
            {count > 0 && <span className="listbtn-count">{count}</span>}
            {count > 0 && <span className="listbtn-total">{money(totals.subtotal)}</span>}
          </Link>
        </div>
      </div>
      <nav className="sitenav" aria-label="Main">
        <div className="wrap sitenav-in">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`sitenav-link ${n.match(pathname) ? 'is-active' : ''}`}>{n.label}</Link>
          ))}
        </div>
      </nav>
    </header>
  )
}

const SOCIALS = [['facebook_url', 'Facebook'], ['instagram_url', 'Instagram'], ['twitter_url', 'X (Twitter)'], ['tiktok_url', 'TikTok'], ['youtube_url', 'YouTube']]

export function Footer() {
  const { settings, categories, media } = useStore()
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Brand light />
          {media.about?.url && <img className="footer-about-img" src={media.about.url} alt={media.about.alt || ''} loading="lazy" />}
          <p>{settings.about}</p>
          {settings.deposit_percent != null && <p className="footer-terms"><Icon name="wallet" size={16} /> A deposit of up to {settings.deposit_percent}% may be required to confirm your order. We contact you with payment instructions.</p>}
        </div>
        <div>
          <h4>Products</h4>
          <ul>
            <li><Link to="/products">All products</Link></li>
            <li><Link to="/categories">All categories</Link></li>
            {categories.slice(0, 7).map((c) => <li key={c.id}><Link to={`/products?category=${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><Link to="/#how-it-works">How ordering works</Link></li>
            <li><Link to="/#payment">Payment terms</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
            <li><Link to="/order-list">Your Order List</Link></li>
            <li><Link to="/account/orders">My orders</Link></li>
            <li><Link to="/admin">Staff login</Link></li>
          </ul>
        </div>
        <div id="footer-contact">
          <h4>Contact</h4>
          <ul className="footer-contact">
            {settings.phone && <li><Icon name="phone" size={16} /><a href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a></li>}
            {settings.whatsapp && <li><WhatsAppIcon size={16} /><a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer">WhatsApp us</a></li>}
            {settings.email && <li><Icon name="mail" size={16} /><a href={`mailto:${settings.email}`}>{settings.email}</a></li>}
            {settings.address && <li><Icon name="pin" size={16} /><span>{settings.address}</span></li>}
            {settings.business_hours && <li><Icon name="clock" size={16} /><span>{settings.business_hours}</span></li>}
            {settings.delivery_info && <li><Icon name="truck" size={16} /><span>{settings.delivery_info}</span></li>}
            {settings.support_phone && <li><Icon name="headset" size={16} /><span>Support: <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`}>{settings.support_phone}</a>{settings.support_hours ? ` (${settings.support_hours})` : ''}</span></li>}
            {settings.support_email && <li><Icon name="mail" size={16} /><span>Support: <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a></span></li>}
            {settings.other_contact_info && <li><Icon name="alert" size={16} /><span>{settings.other_contact_info}</span></li>}
            {safeUrl(settings.google_maps_url) && <li><Icon name="pin" size={16} /><a href={safeUrl(settings.google_maps_url)} target="_blank" rel="noreferrer">Find us on the map</a></li>}
            {SOCIALS.map(([k, label]) => safeUrl(settings[k]) && <li key={k}><Icon name="eye" size={16} /><a href={safeUrl(settings[k])} target="_blank" rel="noreferrer">{label}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>&copy; {new Date().getFullYear()} {settings.business_name}. All prices in Kenya Shillings (KSh).</span>
        <span>No online payment. Our team confirms every order.</span>
      </div>
    </footer>
  )
}

export function FloatingListBar() {
  const { count, totals } = useList()
  const { pathname } = useLocation()
  if (!count || ['/order-list', '/checkout', '/order-confirmation', '/login', '/register'].includes(pathname) || pathname.startsWith('/admin')) return null
  return (
    <Link to="/order-list" className="floatbar">
      <span className="floatbar-l"><Icon name="list" size={20} /> View Order List <b>({count})</b></span>
      <span className="floatbar-r">{money(totals.subtotal)}</span>
    </Link>
  )
}
