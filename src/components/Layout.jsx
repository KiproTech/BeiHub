import { Link, useLocation } from '../lib/router.jsx'
import { Icon, LogoMark, WhatsAppIcon } from './Icons.jsx'
import SearchBox from './SearchBox.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useList } from '../context/ListContext.jsx'
import { money } from '../lib/format.js'
import { waLink } from '../lib/whatsapp.js'
import { IS_DEMO } from '../lib/config.js'

export function Brand({ light, compact }) {
  const { settings } = useStore()
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label={`${settings.business_name} home`}>
      {settings.logo_url ? <img src={settings.logo_url} alt="" className="brand-logo" /> : <LogoMark size={compact ? 34 : 40} />}
      <span className="brand-name">{settings.business_name}</span>
    </Link>
  )
}

export function Header() {
  const { settings, categories } = useStore()
  const { count, totals } = useList()
  const { pathname, search } = useLocation()
  const q = new URLSearchParams(search)
  const activeCat = pathname === '/shop' ? q.get('category') : null
  const wa = settings.whatsapp
  return (
    <header className="site-header">
      {IS_DEMO && (
        <div className="demo-banner">Demo mode: sample data stored in this browser only. Add your Supabase keys to go live.</div>
      )}
      <div className="topbar">
        <div className="wrap topbar-in">
          <span className="topbar-msg"><Icon name="wallet" size={16} /> 50% deposit to confirm, 50% on delivery</span>
          <span className="topbar-links">
            {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, '')}`}><Icon name="phone" size={15} /> {settings.phone}</a>}
            {wa && <a href={waLink(wa, 'Hello, I would like to ask about a product.')} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp</a>}
          </span>
        </div>
      </div>
      <div className="mainbar">
        <div className="wrap mainbar-in">
          <Brand compact />
          <SearchBox initial={pathname === '/shop' ? q.get('q') || '' : ''} className="mainbar-search" placeholder="Search tanks, TVs, solar, CCTV..." />
          <Link to="/order-list" className="listbtn" aria-label={`Order List, ${count} items`}>
            <Icon name="list" size={22} />
            <span className="listbtn-text">Order List</span>
            {count > 0 && <span className="listbtn-count">{count}</span>}
            {count > 0 && <span className="listbtn-total">{money(totals.subtotal)}</span>}
          </Link>
        </div>
      </div>
      <nav className="catnav" aria-label="Categories">
        <div className="wrap catnav-in">
          <Link to="/shop" className={`catnav-link ${pathname === '/shop' && !activeCat ? 'is-active' : ''}`}>All products</Link>
          {categories.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`} className={`catnav-link ${activeCat === c.slug ? 'is-active' : ''}`}>{c.name}</Link>
          ))}
        </div>
      </nav>
    </header>
  )
}

export function Footer() {
  const { settings, categories } = useStore()
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Brand light />
          <p>{settings.about}</p>
          <p className="footer-terms"><Icon name="wallet" size={16} /> Pay {settings.deposit_percent}% deposit to confirm your order and the balance on delivery.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><Link to="/shop">All products</Link></li>
            {categories.slice(0, 7).map((c) => <li key={c.id}><Link to={`/shop?category=${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><Link to="/#how-it-works">How ordering works</Link></li>
            <li><Link to="/#payment">Payment terms</Link></li>
            <li><Link to="/#contact">Contact us</Link></li>
            <li><Link to="/order-list">Your Order List</Link></li>
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
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>&copy; {new Date().getFullYear()} {settings.business_name}. All prices in Kenya Shillings (KSh).</span>
        <span>No online payment. Orders are confirmed by our team.</span>
      </div>
    </footer>
  )
}

export function FloatingListBar() {
  const { count, totals } = useList()
  const { pathname } = useLocation()
  if (!count || ['/order-list', '/checkout', '/order-confirmation'].includes(pathname) || pathname.startsWith('/admin')) return null
  return (
    <Link to="/order-list" className="floatbar">
      <span className="floatbar-l"><Icon name="list" size={20} /> View Order List <b>({count})</b></span>
      <span className="floatbar-r">{money(totals.subtotal)}</span>
    </Link>
  )
}
