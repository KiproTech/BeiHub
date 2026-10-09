import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { Spinner } from '../../components/ui.jsx'
import { Field } from './parts.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { friendlyError } from '../../lib/errors.js'

// Opened from the invitation e-mail. Supabase has already signed this tab in with the one-time link (which also
// verified the e-mail address). The database then checks the invitation token AND that the verified address is
// the one that was invited, before it makes this account an administrator.
export default function AcceptInvite() {
  const { user, loading, refresh, signOut } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [info, setInfo] = useState(null)
  const [problem, setProblem] = useState('')
  const [f, setF] = useState({ full_name: '', phone: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  useEffect(() => {
    if (loading) return
    if (!token) { setProblem('This invitation link is incomplete. Open the link from your invitation email again.'); return }
    if (!user) { setProblem('Your sign-in link has expired or was already used. Ask the administrator to re-send the invitation.'); return }
    if (user.role === 'admin' || user.role === 'super_admin') { setProblem('This account is already an administrator.'); return }
    api.invitationPreview(token)
      .then((p) => { setInfo(p); setF((x) => ({ ...x, full_name: p.full_name || '', phone: p.phone || '' })) })
      .catch((e) => setProblem(friendlyError(e)))
  }, [loading, user, token])

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (f.password.length < 8) return setFormError('The password must be at least 8 characters.')
    if (f.password !== f.confirm) return setFormError('The two passwords do not match.')
    if (f.full_name.trim().length < 2) return setFormError('Enter your full name.')
    setBusy(true)
    try {
      await api.acceptInvitation({ token, full_name: f.full_name.trim(), phone: f.phone.trim(), password: f.password })
      await refresh()
      navigate('/admin', { replace: true })
    } catch (err) {
      setFormError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand"><div><b>Administrator</b><span>Invitation</span></div></div>
        {loading || (!info && !problem) ? <Spinner label="Checking your invitation" /> : problem ? (
          <>
            <div className="notice notice-bad" role="alert"><Icon name="alert" size={18} /> <span>{problem}</span></div>
            <p><Link to="/">Back to the website</Link>{user && <> &middot; <button className="linklike" onClick={signOut}>Sign out</button></>}</p>
          </>
        ) : (
          <form onSubmit={submit} className="stack">
            <p>You have been invited to become an administrator. Confirm your details and choose a password.</p>
            {formError && <div className="notice notice-bad" role="alert"><Icon name="alert" size={18} /> <span>{formError}</span></div>}
            <Field label="Email address" hint="Verified by the link you used."><input value={info.email} disabled /></Field>
            <Field label="Full name"><input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
            <Field label="Phone number"><input required type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
            <Field label="Password" hint="At least 8 characters."><input required type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
            <Field label="Confirm password"><input required type="password" minLength={8} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait...' : 'Accept invitation'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
