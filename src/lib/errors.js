// Turn database / network errors into plain language for the person using the site.
export function friendlyError(err) {
  const msg = String(err?.message || err || 'Something went wrong.')
  const code = err?.code
  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/sku/i.test(msg)) return 'That SKU is already used by another variant.'
    if (/slug/i.test(msg)) return 'That web address (slug) is already used. Change the name or slug.'
    if (/label|product_id/i.test(msg)) return 'This product already has a variant with that name.'
    return 'That value is already in use. Please choose a different one.'
  }
  if (/SETTINGS_CONFLICT/.test(msg)) return 'Someone else changed one of these settings while you were editing. Nothing was overwritten. Press "Load latest", check the values and save again.'
  if (/row-level security|not authorised|permission denied/i.test(msg)) return 'You do not have permission to do that.'
  if (code === '23503' || /foreign key/i.test(msg)) {
    if (/categor/i.test(msg)) return 'This category still has products. Move or delete its products first.'
    return 'This item is still in use elsewhere and cannot be removed.'
  }
  if (/jwt|token/i.test(msg) && /expired|invalid/i.test(msg)) return 'Your session expired. Please sign in again.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Could not reach the server. Check your internet connection and try again.'
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/Email not confirmed/i.test(msg)) return 'Your email address is not verified yet. Open the verification email we sent you, or request a new one.'
  if (/User already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try logging in instead.'
  if (/Password should be at least|weak/i.test(msg)) return 'Choose a stronger password (at least 8 characters).'
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  if (/same password/i.test(msg)) return 'Choose a password different from your old one.'
  if (/Auth session missing|session.*missing/i.test(msg)) return 'This link has expired. Please request a new one.'
  return msg
}
