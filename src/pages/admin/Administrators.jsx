import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { ConfirmDialog, Modal, Spinner } from '../../components/ui.jsx'
import { Card, Field, PageHead } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { useLiveRefresh } from '../../lib/realtime.js'

// Super Admin > Administrators.
// Every rule shown here (who may be changed, which permissions may be granted ...) is enforced by the database;
// this screen only hides what you could not do anyway and shows the database's error if you try.
const when = (v) => (v ? fmtDate(v) : 'Never')
const STATUS = {
  active: ['good', 'Active'], suspended: ['bad', 'Suspended'], unverified: ['warn', 'Email not verified'],
  pending: ['warn', 'Pending'], accepted: ['good', 'Accepted'], expired: ['bad', 'Expired'], revoked: ['bad', 'Revoked'],
}
const Pill = ({ k }) => <span className={`pill pill-${STATUS[k][0]}`}>{STATUS[k][1]}</span>
const adminStatus = (a) => (a.is_suspended ? 'suspended' : a.email_verified ? 'active' : 'unverified')

function PermissionPicker({ catalogue, value, onChange, grantable }) {
  const toggle = (code) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])
  const usable = catalogue.filter((c) => grantable(c))
  return (
    <div className="permpicker">
      <div className="permpicker-tools">
        <button type="button" className="btn btn-sm btn-outline" onClick={() => onChange([...new Set([...value.filter((c) => !grantable(catalogue.find((x) => x.code === c) || {})), ...usable.filter((c) => !c.restricted).map((c) => c.code)])])}>Select all</button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => onChange(value.filter((c) => !usable.some((u) => u.code === c)))}>Clear</button>
      </div>
      {catalogue.map((c) => {
        const can = grantable(c)
        return (
          <label key={c.code} className={`permrow ${can ? '' : 'is-disabled'}`}>
            <input type="checkbox" checked={value.includes(c.code)} disabled={!can} onChange={() => toggle(c.code)} />
            <span><b>{c.label}</b>{c.restricted && <span className="pill pill-warn" style={{ marginLeft: 8 }}>Super Admin only</span>}<br /><span className="muted small">{c.description}</span></span>
          </label>
        )
      })}
    </div>
  )
}

export default function Administrators() {
  const { run } = useAdmin()
  const { user, isSuperAdmin, can } = useAuth()
  const [tab, setTab] = useState('admins')
  const [admins, setAdmins] = useState(null)
  const [invites, setInvites] = useState([])
  const [catalogue, setCatalogue] = useState([])
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, i, c] = await Promise.all([api.listAdmins(), api.listInvitations(), api.listPermissions()])
      setAdmins(a); setInvites(i); setCatalogue(c); setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh([{ table: 'admin_permissions' }, { table: 'profiles' }], load)

  const pending = invites.filter((i) => i.status === 'pending').length
  const labelOf = useMemo(() => Object.fromEntries(catalogue.map((c) => [c.code, c.label])), [catalogue])
  // what the signed-in person may hand out (the database checks again)
  const grantable = (c) => isSuperAdmin || (!c.restricted && can(c.code))
  const close = () => { setDialog(null) }
  const act = async (fn, ok) => {
    setBusy(true)
    const r = await run(fn, ok)
    setBusy(false)
    if (r) { close(); load() }
    return r
  }

  if (error) return <div className="notice notice-bad" role="alert">{error}</div>
  if (!admins) return <Spinner label="Loading administrators" />

  return (
    <>
      <PageHead title="Administrators" sub="Who can sign in to the admin area, and exactly what each person may do.">
        <button className="btn btn-primary" onClick={() => setDialog({ kind: 'invite' })}><Icon name="plus" size={18} /> Invite admin</button>
      </PageHead>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'admins'} className={tab === 'admins' ? 'is-active' : ''} onClick={() => setTab('admins')}>Administrators <span className="badge-n">{admins.length}</span></button>
        <button role="tab" aria-selected={tab === 'invites'} className={tab === 'invites' ? 'is-active' : ''} onClick={() => setTab('invites')}>Invitations <span className="badge-n">{pending}</span></button>
      </div>

      {tab === 'admins' ? (
        <Card>
          <div className="table-scroll">
            <table className="table table-stack">
              <thead><tr><th>Admin</th><th>Email</th><th>Status</th><th>Role</th><th>Permissions</th><th>Last login</th><th>Actions</th></tr></thead>
              <tbody>
                {admins.map((a) => {
                  const isOwner = a.role === 'super_admin'
                  const self = a.id === user.id
                  return (
                    <tr key={a.id}>
                      <td data-label="Admin"><b>{a.full_name || '(no name)'}</b>{self && <span className="muted"> (you)</span>}<br /><span className="muted small">{a.phone || 'no phone'}</span></td>
                      <td data-label="Email">{a.email}</td>
                      <td data-label="Status"><Pill k={adminStatus(a)} />{a.suspended_reason && <div className="muted small">{a.suspended_reason}</div>}</td>
                      <td data-label="Role">{isOwner ? <span className="pill pill-info">Super Admin</span> : 'Admin'}</td>
                      <td data-label="Permissions">{isOwner ? 'Everything' : a.permissions.length ? <span title={a.permissions.map((c) => labelOf[c] || c).join(', ')}>{a.permissions.length} of {catalogue.length}</span> : <span className="muted">None</span>}</td>
                      <td data-label="Last login">{when(a.last_login_at)}</td>
                      <td data-label="Actions">
                        {isOwner || self ? <span className="muted small">{isOwner ? 'Protected' : 'This is you'}</span> : (
                          <div className="admin-actions">
                            <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'view', a })}>View</button>
                            <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'perms', a, value: a.permissions })}>Permissions</button>
                            {a.is_suspended
                              ? <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'reactivate', a })}>Reactivate</button>
                              : <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'suspend', a, reason: '' })}>Suspend</button>}
                            <button className="btn btn-sm btn-outline vcard-del" onClick={() => setDialog({ kind: 'revoke', a })}>Revoke</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card sub="An invitation e-mail contains a one-time link that expires after 7 days. Re-sending gives a new link and cancels the old one.">
          {!invites.length ? <p className="muted">No invitations yet.</p> : (
            <div className="table-scroll">
              <table className="table table-stack">
                <thead><tr><th>Invitee</th><th>Status</th><th>Permissions</th><th>Invited by</th><th>Invited</th><th>Expires / accepted</th><th>Actions</th></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td data-label="Invitee"><b>{i.full_name}</b><br /><span className="muted small">{i.email}{i.phone ? ` · ${i.phone}` : ''}</span></td>
                      <td data-label="Status"><Pill k={i.status} /></td>
                      <td data-label="Permissions">{i.permissions.length}</td>
                      <td data-label="Invited by">{i.invited_by_name || 'Unknown'}</td>
                      <td data-label="Invited">{when(i.invited_at)}{i.send_count > 1 && <div className="muted small">sent {i.send_count} times</div>}</td>
                      <td data-label="Expires / accepted">{i.status === 'accepted' ? when(i.accepted_at) : i.status === 'revoked' ? when(i.revoked_at) : when(i.expires_at)}</td>
                      <td data-label="Actions">
                        {['pending', 'expired'].includes(i.status) ? (
                          <div className="admin-actions">
                            <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => act(async () => { const r = await api.resendInvitation(i.id); if (!r.emailSent) throw new Error(`The new link was created but the email could not be sent: ${r.emailError}`) }, `Invitation re-sent to ${i.email}`)}>Resend</button>
                            <button className="btn btn-sm btn-outline vcard-del" disabled={busy} onClick={() => act(() => api.revokeInvitation(i.id), 'Invitation revoked')}>Revoke</button>
                          </div>
                        ) : <span className="muted small">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {isSuperAdmin && admins.some((a) => a.role === 'admin' && !a.is_suspended && a.email_verified) && (
        <Card title="Transfer ownership" sub="Danger zone. Only one Super Admin can exist. After a transfer you become a normal administrator and lose the ability to manage other administrators.">
          <button className="btn btn-outline vcard-del" onClick={() => setDialog({ kind: 'transfer', to: '', confirm: '' })}>Transfer Super Admin ownership...</button>
        </Card>
      )}

      {dialog?.kind === 'invite' && <InviteDialog catalogue={catalogue} grantable={grantable} onClose={close} busy={busy} onSubmit={(f) => act(async () => {
        const r = await api.inviteAdmin(f)
        if (!r.emailSent) throw new Error(`The invitation was created but the email could not be sent (${r.emailError}). Open Invitations and press Resend, or check your Supabase email settings.`)
      }, `Invitation sent to ${f.email}`)} />}

      {dialog?.kind === 'perms' && (
        <ConfirmDialog title={`Permissions for ${dialog.a.full_name || dialog.a.email}`} confirmLabel="Save permissions" busy={busy} onClose={close}
          onConfirm={() => act(() => api.setAdminPermissions(dialog.a.id, dialog.value), 'Permissions updated. They apply immediately.')}>
          <PermissionPicker catalogue={catalogue} value={dialog.value} onChange={(v) => setDialog({ ...dialog, value: v })} grantable={grantable} />
        </ConfirmDialog>
      )}
      {dialog?.kind === 'suspend' && (
        <ConfirmDialog title={`Suspend ${dialog.a.full_name || dialog.a.email}?`} confirmLabel="Suspend" tone="danger" busy={busy} disabled={dialog.reason.trim().length < 3} onClose={close}
          onConfirm={() => act(() => api.setAdminSuspended(dialog.a.id, true, dialog.reason), 'Administrator suspended')}>
          <p>They lose all admin access straight away, even if they are signed in. You can reactivate them later.</p>
          <Field label="Reason (required)"><input value={dialog.reason} maxLength={200} autoFocus onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} /></Field>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'reactivate' && (
        <ConfirmDialog title={`Reactivate ${dialog.a.full_name || dialog.a.email}?`} confirmLabel="Reactivate" busy={busy} onClose={close}
          onConfirm={() => act(() => api.setAdminSuspended(dialog.a.id, false), 'Administrator reactivated')}>
          <p>Their previous permissions apply again.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'revoke' && (
        <ConfirmDialog title={`Remove admin access from ${dialog.a.full_name || dialog.a.email}?`} confirmLabel="Remove admin access" tone="danger" busy={busy} onClose={close}
          onConfirm={() => act(() => api.revokeAdmin(dialog.a.id), 'Admin access removed')}>
          <p>The account stays, as a normal customer account, and all permissions are deleted. To give access back, send a new invitation.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'transfer' && (
        <ConfirmDialog title="Transfer Super Admin ownership" confirmLabel="Transfer ownership" tone="danger" busy={busy} disabled={!dialog.to || !dialog.confirm} onClose={close}
          onConfirm={() => act(async () => { await api.transferOwnership(dialog.to, dialog.confirm); window.location.reload() }, 'Ownership transferred')}>
          <div className="notice notice-warn"><Icon name="alert" size={18} /> This cannot be undone by you. The new owner would have to transfer it back.</div>
          <Field label="New owner (an active, verified administrator)">
            <select value={dialog.to} onChange={(e) => setDialog({ ...dialog, to: e.target.value })}>
              <option value="">Select administrator</option>
              {admins.filter((a) => a.role === 'admin' && !a.is_suspended && a.email_verified).map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email} ({a.email})</option>)}
            </select>
          </Field>
          <Field label="Type the new owner's email address to confirm"><input value={dialog.confirm} onChange={(e) => setDialog({ ...dialog, confirm: e.target.value })} autoComplete="off" /></Field>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'view' && <ActivityDialog a={dialog.a} labelOf={labelOf} onClose={close} />}
    </>
  )
}

function InviteDialog({ catalogue, grantable, onClose, onSubmit, busy }) {
  const [f, setF] = useState({ full_name: '', phone: '', email: '', permissions: [] })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const valid = f.full_name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) && /^\+?[0-9][0-9 ()-]{5,24}$/.test(f.phone.trim())
  return (
    <ConfirmDialog title="Invite an administrator" confirmLabel="Send invitation" busy={busy} disabled={!valid} onClose={onClose}
      onConfirm={() => onSubmit({ ...f, full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim() })}>
      <p className="muted">They receive an email with a secure, one-time link (valid for 7 days). They must verify their email and choose a password before they become an administrator.</p>
      <div className="aform">
        <Field label="Full name"><input value={f.full_name} onChange={set('full_name')} autoFocus /></Field>
        <Field label="Phone number"><input type="tel" value={f.phone} onChange={set('phone')} placeholder="0712 345 678" /></Field>
        <Field label="Email address" className="span2"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Role" className="span2" hint="Administrator. There is only ever one Super Admin."><input value="Administrator" disabled /></Field>
      </div>
      <h3 style={{ margin: '14px 0 6px' }}>Permissions</h3>
      <PermissionPicker catalogue={catalogue} value={f.permissions} onChange={(v) => setF((x) => ({ ...x, permissions: v }))} grantable={grantable} />
    </ConfirmDialog>
  )
}

function ActivityDialog({ a, labelOf, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.listAuditFor(a.id).then(setRows).catch((e) => setErr(e.message)) }, [a.id])
  return (
    <Modal title={a.full_name || a.email} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}>
      <dl className="kv">
        <div><dt>Email</dt><dd>{a.email} {a.email_verified ? '(verified)' : '(not verified)'}</dd></div>
        <div><dt>Phone</dt><dd>{a.phone || '-'}</dd></div>
        <div><dt>Status</dt><dd>{STATUS[adminStatus(a)][1]}</dd></div>
        <div><dt>Admin since</dt><dd>{when(a.admin_since)}</dd></div>
        <div><dt>Invited by</dt><dd>{a.invited_by_name || '-'}</dd></div>
        <div><dt>Last login</dt><dd>{when(a.last_login_at)}</dd></div>
        <div><dt>Last logout</dt><dd>{when(a.last_logout_at)}</dd></div>
        <div><dt>Permissions</dt><dd>{a.permissions.length ? a.permissions.map((c) => labelOf[c] || c).join(', ') : 'None'}</dd></div>
      </dl>
      <h3>Recent activity</h3>
      {err ? <p className="muted">{err}</p> : !rows ? <Spinner /> : !rows.length ? <p className="muted">No recorded actions yet.</p> : (
        <ul className="rowlist">
          {rows.map((r) => <li key={r.id}><b>{r.description || r.action}</b><br /><span className="muted small">{when(r.created_at)} · {r.action}</span></li>)}
        </ul>
      )}
    </Modal>
  )
}
