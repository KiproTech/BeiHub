import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '../lib/router.jsx'
import { Icon } from '../components/Icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { friendlyError } from '../lib/errors.js'
import { peekNext, rememberNext, safeNext, takeNext } from '../lib/nextPath.js'

function Shell({ title, sub, children, foot }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="wrap section">
      <div className="authcard">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
        {foot && <div className="authcard-foot">{foot}</div>}
      </div>
    </div>
  )
}

const Field = ({ label, hint, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
  </label>
)

export function Login() {
  const { signIn, resendVerification, user, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const next = safeNext(params.get('next')) || peekNext()
  const [f, setF] = useState({ email: params.get('email') || '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unverified, setUnverified] = useState(false)

  useEffect(() => {
    if (next) rememberNext(next)
  }, [next])
  useEffect(() => {
    if (!loading && user) navigate(user.role === 'admin' && !next ? '/admin' : takeNext() || next || '/account/orders', { replace: true })
  }, [user, loading, next, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setUnverified(false)
    setBusy(true)
    try {
      await signIn(f.email, f.password)
    } catch (err) {
      setError(friendlyError(err))
      setUnverified(/not confirmed|not verified/i.test(String(err?.message)))
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    try {
      await resendVerification(f.email)
      toast.success('Verification email sent. Check your inbox and spam folder.')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <Shell
      title="Log in"
      sub={next === '/checkout' || next === '/order-list' ? 'Log in to place your order. Your Order List is saved.' : 'Welcome back. Log in to place orders and track them.'}
      foot={<>New here? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></>}
    >
      {params.get('expired') && <div className="notice notice-warn">That email link has expired or was already used. Log in, or request a new verification email below.</div>}
      <form onSubmit={submit} className="stack">
        <Field label="Email address"><input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {error && <div className="notice notice-bad" role="alert"><span>{error}</span>{unverified && f.email && <button type="button" className="btn btn-sm btn-primary" onClick={resend}>Resend verification email</button>}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        <Link to="/forgot-password" className="center small">Forgot your password?</Link>
      </form>
    </Shell>
  )
}

export function Register() {
  const { signUp, user, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next')) || peekNext()
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (next) rememberNext(next)
  }, [next])
  useEffect(() => {
    if (!loading && user) navigate(next || '/account/orders', { replace: true })
  }, [user, loading, next, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (f.password.length < 8) return setError('Choose a password with at least 8 characters.')
    if (f.password !== f.confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      const r = await signUp(f.email, f.password, { full_name: f.full_name.trim(), phone: f.phone.trim() })
      if (r.needsVerification) navigate(`/verify-email?email=${encodeURIComponent(f.email.trim())}${r.alreadyRegistered ? '&existing=1' : ''}`)
      else navigate(next || '/account/orders')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Create your account" sub="Free and quick. You only need an account to place and track orders - browsing stays open to everyone." foot={<>Already registered? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Log in</Link></>}>
      <form onSubmit={submit} className="stack">
        <Field label="Full name"><input required autoComplete="name" value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Phone number" hint="We call or message this number to confirm your orders."><input type="tel" required autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="0712 345 678" /></Field>
        <Field label="Email address" hint="We send a verification link to this address."><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters."><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field label="Confirm password"><input type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
    </Shell>
  )
}

export function VerifyEmail() {
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const { resendVerification } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const resend = async () => {
    setBusy(true)
    try {
      await resendVerification(email)
      toast.success('Verification email sent again.')
      setCooldown(30)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell title="Check your email" foot={<Link to="/login">Back to log in</Link>}>
      <div className="authcard-icon"><Icon name="mail" size={28} /></div>
      <p>
        {params.get('existing') ? <>If <b>{email}</b> is not registered yet, we have sent it a verification link. If you already have an account, just log in.</> : <>We sent a verification link to <b>{email || 'your email address'}</b>. Click it to activate your account, then log in.</>}
      </p>
      <p className="muted small">You must verify your email before you can place an order. Can't find it? Check your spam folder.</p>
      {email && <button className="btn btn-outline btn-block" onClick={resend} disabled={busy || cooldown > 0}>{cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend verification email'}</button>}
    </Shell>
  )
}

export function ForgotPassword() {
  const { recoverPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await recoverPassword(email)
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell title="Reset your password" sub="Enter your email and we will send you a link to choose a new password." foot={<Link to="/login">Back to log in</Link>}>
      {sent ? (
        <>
          <div className="notice notice-good" role="status">If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox and spam folder.</div>
        </>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label="Email address"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <div className="notice notice-bad" role="alert">{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  )
}

export function ResetPassword() {
  const { user, loading, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <Shell title="Reset your password"><p className="muted">One moment...</p></Shell>
  if (!user)
    return (
      <Shell title="Link expired" sub="This reset link has expired or was already used." foot={<Link to="/login">Back to log in</Link>}>
        <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </Shell>
    )

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (f.password.length < 8) return setError('Choose a password with at least 8 characters.')
    if (f.password !== f.confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      await updatePassword(f.password)
      toast.success('Password changed. Please log in with your new password.')
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Choose a new password" sub={`For ${user.email}`}>
      <form onSubmit={submit} className="stack">
        <Field label="New password" hint="At least 8 characters."><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Confirm new password"><input type="password" required minLength={8} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
      </form>
    </Shell>
  )
}
