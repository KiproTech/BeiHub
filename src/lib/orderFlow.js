// Single source of truth for the order lifecycle on the front end.
// The database enforces the same rules in admin_set_order_status() (supabase/beihub_migration.sql).

export const ORDER_STATUSES = [
  { key: 'pending', label: 'Pending', short: 'Pending', tone: 'warn', customer: 'We received your order. Our team will contact you to confirm it.' },
  { key: 'confirmed', label: 'Confirmed', short: 'Confirmed', tone: 'info', customer: 'Your order is confirmed. Our team will share the next steps.' },
  { key: 'payment_pending', label: 'Payment pending', short: 'Payment pending', tone: 'warn', customer: 'A payment is required to continue. Our team will send you the payment instructions.' },
  { key: 'processing', label: 'Processing', short: 'Processing', tone: 'info', customer: 'Your order is being prepared.' },
  { key: 'ready_for_pickup', label: 'Ready for pickup', short: 'Ready for pickup', tone: 'good', customer: 'Your order is ready. You can collect it now.' },
  { key: 'waiting_for_delivery', label: 'Waiting for delivery', short: 'Waiting for delivery', tone: 'info', customer: 'Your order is ready and waiting for delivery.' },
  { key: 'completed', label: 'Completed', short: 'Completed', tone: 'good', customer: 'This order is complete. Thank you for shopping with us.' },
  { key: 'cancelled', label: 'Cancelled', short: 'Cancelled', tone: 'bad', customer: 'This order was cancelled.' },
]
export const statusInfo = (key) => ORDER_STATUSES.find((s) => s.key === key) || ORDER_STATUSES[0]

export const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['payment_pending', 'processing', 'cancelled'],
  payment_pending: ['processing', 'cancelled'],
  processing: ['ready_for_pickup', 'waiting_for_delivery', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'],
  waiting_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

// statuses an admin may choose next (pickup orders never go to "waiting for delivery" and vice versa)
export function allowedNext(order) {
  const pickup = order.fulfilment_method === 'pickup'
  return (TRANSITIONS[order.status] || []).filter((s) => !(s === 'ready_for_pickup' && !pickup) && !(s === 'waiting_for_delivery' && pickup))
}

export const PAYMENT_STATUSES = [
  { key: 'unpaid', label: 'Not paid yet', tone: 'warn' },
  { key: 'pending', label: 'Payment pending', tone: 'warn' },
  { key: 'confirmed', label: 'Payment confirmed', tone: 'good' },
]
export const paymentInfo = (key) => PAYMENT_STATUSES.find((s) => s.key === key) || PAYMENT_STATUSES[0]

export const canCustomerCancel = (order) => order.status === 'pending'

// Main steps shown in the customer progress tracker
export function trackerSteps(order) {
  const last = order.fulfilment_method === 'pickup' ? { key: 'ready_for_pickup', label: 'Ready for pickup' } : { key: 'waiting_for_delivery', label: 'Waiting for delivery' }
  return [
    { key: 'pending', label: 'Submitted' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'payment_pending', label: 'Payment' },
    { key: 'processing', label: 'Processing' },
    last,
    { key: 'completed', label: 'Completed' },
  ]
}
export function trackerIndex(order) {
  const steps = trackerSteps(order)
  const i = steps.findIndex((s) => s.key === order.status)
  if (i >= 0) return i
  // cancelled: show how far it got using the timeline
  const reached = (order.events || []).filter((e) => e.to_status && e.to_status !== 'cancelled').map((e) => steps.findIndex((s) => s.key === e.to_status))
  return Math.max(0, ...reached)
}

// Wording used by the demo backend (mirrors order_status_notice() in SQL)
export function noticeFor(status, order, reason) {
  const n = order.order_number
  const pct = order.deposit_percent
  const dep = Number(order.deposit_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    {
      confirmed: { type: 'order_confirmed', title: 'Order confirmed', message: `Your order ${n} has been confirmed by our team.` },
      payment_pending: { type: 'payment_required', title: 'Payment required', message: `Order ${n} needs a payment of up to ${pct}% (about KSh ${dep}) to proceed. Our team will send you the payment instructions.` },
      processing: { type: 'order_processing', title: 'Order is being processed', message: `Order ${n} is now being processed.` },
      ready_for_pickup: { type: 'order_ready', title: 'Order ready for pickup', message: `Order ${n} is ready for pickup.` },
      waiting_for_delivery: { type: 'order_ready', title: 'Order ready for delivery', message: `Order ${n} is ready and waiting for delivery.` },
      completed: { type: 'order_completed', title: 'Order completed', message: `Order ${n} is completed. Thank you for shopping with us.` },
      cancelled: { type: 'order_cancelled', title: 'Order cancelled', message: `Order ${n} was cancelled. Reason: ${reason || 'not given'}` },
    }[status] || { type: 'order_update', title: 'Order updated', message: `Order ${n} was updated.` }
  )
}

export const CONTACT_METHODS = [
  { key: 'phone', label: 'Phone call' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
]
