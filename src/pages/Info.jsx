import { Link } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { Spinner } from '../components/ui.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { waLink } from '../lib/whatsapp.js'
import { safeUrl } from '../lib/safeUrl.js'

const SOCIALS = [['facebook_url', 'Facebook'], ['instagram_url', 'Instagram'], ['twitter_url', 'X (Twitter)'], ['tiktok_url', 'TikTok'], ['youtube_url', 'YouTube']]
const tel = (n) => `tel:${String(n).replace(/\s/g, '')}`
const mapHref = (s) => safeUrl(s.google_maps_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.address, s.county].filter(Boolean).join(', '))}`

// Both pages show ONLY what the admin saved in Business Settings (Supabase). Nothing is hardcoded.
export function About() {
  const { settings, media, loaded } = useStore()
  if (!loaded) return <Spinner />
  return (
    <div className="wrap section infopage">
      <h1>About {settings.business_name}</h1>
      {settings.tagline && <p className="lead">{settings.tagline}</p>}
      {media.about?.url && <img className="about-img" src={media.about.url} alt={media.about.alt || ''} />}
      <div className="prose">
        {(settings.about || `${settings.business_name} is one store: we sell products and deliver them to you.`).split('\n').filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
      </div>
      <div className="infogrid">
        <div className="infocard"><h3><Icon name="list" size={20} /> How to order</h3><p>Browse products, add them to your Order List, log in and confirm your contact details. Your order starts as Pending and our team contacts you.</p></div>
        <div className="infocard"><h3><Icon name="truck" size={20} /> Delivery</h3><p>{settings.delivery_info || 'We deliver to your location. The delivery fee is shown before you submit your order.'}</p></div>
        {settings.deposit_percent != null && <div className="infocard"><h3><Icon name="wallet" size={20} /> Payment</h3><p>A deposit of up to {settings.deposit_percent}% may be required to confirm your order.</p>{settings.payment_instructions && <p className="muted">{settings.payment_instructions}</p>}</div>}
      </div>
      <Link to="/products" className="btn btn-primary btn-lg">Browse products</Link> <Link to="/contact" className="btn btn-outline btn-lg">Contact us</Link>
    </div>
  )
}

export function Contact() {
  const { settings: s, loaded } = useStore()
  if (!loaded) return <Spinner />
  const socials = SOCIALS.filter(([k]) => safeUrl(s[k]))
  return (
    <div className="wrap section infopage">
      <h1>Contact {s.business_name}</h1>
      <p className="muted">Questions about a product, stock, your order or delivery? Reach us here.</p>
      <div className="contact-cta">
        {s.whatsapp && <a className="btn btn-wa btn-lg" target="_blank" rel="noreferrer" href={waLink(s.whatsapp, `Hello ${s.business_name}, I need help.`)}><WhatsAppIcon size={20} /> Chat on WhatsApp</a>}
        {s.phone && <a className="btn btn-dark btn-lg" href={tel(s.phone)}><Icon name="phone" size={20} /> Call {s.phone}</a>}
      </div>
      <div className="infogrid">
        {(s.phone || s.whatsapp || s.email) && (
          <div className="infocard"><h3>Reach us</h3>
            {s.phone && <p><Icon name="phone" size={16} /> <a href={tel(s.phone)}>{s.phone}</a></p>}
            {s.whatsapp && <p><WhatsAppIcon size={16} /> +{s.whatsapp}</p>}
            {s.email && <p><Icon name="mail" size={16} /> <a href={`mailto:${s.email}`}>{s.email}</a></p>}
          </div>
        )}
        {(s.address || s.business_hours) && (
          <div className="infocard"><h3>Visit / hours</h3>
            {s.address && <p><Icon name="pin" size={16} /> {s.address}{s.county ? `, ${s.county}` : ''}</p>}
            {s.business_hours && <p><Icon name="clock" size={16} /> {s.business_hours}</p>}
            {(s.address || safeUrl(s.google_maps_url)) && <p><a href={mapHref(s)} target="_blank" rel="noreferrer">Find us on the map</a></p>}
          </div>
        )}
        {s.delivery_info && <div className="infocard"><h3><Icon name="truck" size={20} /> Delivery</h3><p>{s.delivery_info}</p></div>}
        {(s.support_phone || s.support_email || s.support_hours || s.other_contact_info) && (
          <div className="infocard"><h3><Icon name="headset" size={20} /> Customer support</h3>
            {s.support_phone && <p><a href={tel(s.support_phone)}>{s.support_phone}</a></p>}
            {s.support_email && <p><a href={`mailto:${s.support_email}`}>{s.support_email}</a></p>}
            {s.support_hours && <p>{s.support_hours}</p>}
            {s.other_contact_info && <p className="muted">{s.other_contact_info}</p>}
          </div>
        )}
        {socials.length > 0 && <div className="infocard"><h3>Follow us</h3>{socials.map(([k, l]) => <p key={k}><a href={safeUrl(s[k])} target="_blank" rel="noreferrer">{l}</a></p>)}</div>}
      </div>
    </div>
  )
}
