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
  if (code === '23503' || /foreign key|violates/i.test(msg)) {
    if (/categor/i.test(msg)) return 'This category still has products. Move or delete its products first.'
    return 'This item is still in use elsewhere and cannot be removed.'
  }
  if (code === '42501' || err?.status === 403 || /row-level security|not authorised|permission denied/i.test(msg))
    return 'You do not have permission to do that. Sign in with an admin account.'
  if (/jwt|token/i.test(msg) && /expired|invalid/i.test(msg)) return 'Your session expired. Please sign in again.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Could not reach the server. Check your internet connection and try again.'
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  return msg
}
