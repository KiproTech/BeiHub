import { money, variantTitle, waDigits, fmtDate } from './format.js'

export const waLink = (number, text) => `https://wa.me/${waDigits(number)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

// lines: [{ title, qty, unitPrice, lineTotal }]
export function buildOrderMessage({ settings, customer, lines, totals, orderNumber }) {
  const biz = settings?.business_name || 'BeiHub'
  const out = []
  out.push(`*${orderNumber ? 'Order ' + orderNumber : 'New order request'} - ${biz}*`)
  out.push('')
  if (customer?.customer_name) out.push(`Customer: ${customer.customer_name}`)
  if (customer?.phone) out.push(`Phone: ${customer.phone}`)
  const where = [customer?.delivery_location, customer?.town, customer?.county].filter(Boolean).join(', ')
  if (where) out.push(`Delivery: ${where}`)
  if (customer?.preferred_delivery_date) out.push(`Preferred date: ${fmtDate(customer.preferred_delivery_date)}`)
  out.push('', '*Items*')
  lines.forEach((l, i) => {
    out.push(`${i + 1}. ${l.title}`)
    out.push(`    ${l.qty} x ${money(l.unitPrice)} = ${money(l.lineTotal)}`)
  })
  out.push('', `Subtotal: ${money(totals.subtotal)}`)
  out.push(`Delivery: ${customer?.county ? money(totals.deliveryFee) : 'to be confirmed'}`)
  out.push(`*Order total: ${money(totals.total)}*`)
  out.push(`${settings?.deposit_percent ?? 50}% deposit: ${money(totals.deposit)}`)
  out.push(`Balance on delivery: ${money(totals.balance)}`)
  if (customer?.notes) out.push('', `Notes: ${customer.notes}`)
  out.push('', 'Please confirm availability and send the deposit details. Thank you.')
  return out.join('\n')
}

export function buildEnquiryMessage({ settings, product, variant, qty = 1 }) {
  const biz = settings?.business_name || 'BeiHub'
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}/product/${product.slug}${variant ? `?v=${variant.id}` : ''}` : ''
  const lines = [
    `Hello ${biz}, I would like to enquire about:`,
    '',
    `*${variantTitle(product, variant)}*`,
  ]
  if (variant) lines.push(`Price on website: ${money(variant.price)}`)
  lines.push(`Quantity: ${qty}`)
  if (url) lines.push(url)
  lines.push('', 'Is it available, and what would delivery cost?')
  return lines.join('\n')
}
