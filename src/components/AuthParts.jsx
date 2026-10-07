import { useState } from 'react'
import { Link } from '../lib/router.jsx'
import { Icon } from './Icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { friendlyError } from '../lib/errors.js'

// Clear warning for a signed-in customer whose email is not verified yet. Browsing stays open.
export function VerifyBanner({ compact }) {
  const { user, resendVerification, checkVerified } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!user || user.email_verified || user.role === 'admin') return null
  const resend = async () => {
    setBusy(true)
    try {
      await resendVerification(user.email)
      toast.success('Verification email sent. Please check your inbox and spam folder.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  const check = async () => {
    setBusy(true)
    try {
      if (await checkVerified()) toast.success('Email verified. Thank you!')
      else toast.info('Not verified yet. Open the link in the email we sent you.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="notice notice-warn verify-banner" role="alert">
      <Icon name="mail" size={18} />
      <span>
        <b>Verify your email to place orders.</b>{!compact && <> We sent a link to <b>{user.email}</b>. You can keep browsing, but orders cannot be submitted until your email is verified.</>}
      </span>
      <span className="btnrow">
        <button className="btn btn-sm btn-outline" onClick={check} disabled={busy}>I have verified</button>
        <button className="btn btn-sm btn-primary" onClick={resend} disabled={busy}>Resend email</button>
      </span>
    </div>
  )
}

// Wraps account pages: visitors are sent to log in and then brought back.
export function LoginPrompt({ next, title = 'Please log in', children }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <div className="wrap section">
      <div className="authcard">
        <div className="authcard-icon"><Icon name="lock" size={26} /></div>
        <h1>{title}</h1>
        <p className="muted">{children || 'Log in or create a free account to continue. You can keep browsing without one.'}</p>
        <div className="btnrow btnrow-center">
          <Link to={`/login${q}`} className="btn btn-primary">Log in</Link>
          <Link to={`/register${q}`} className="btn btn-outline">Create account</Link>
        </div>
      </div>
    </div>
  )
}
