// Tiny SVG helpers used by the sample-artwork generator.
// Everything here is original vector artwork drawn for BeiHub.

const n = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)

function attrs(o = {}) {
  const { fill = 'none', stroke, sw, op, tf, filter, dash, cap, extra = '' } = o
  let s = ` fill="${fill}"`
  if (stroke) s += ` stroke="${stroke}" stroke-width="${n(sw ?? 1)}"`
  if (cap) s += ` stroke-linecap="${cap}"`
  if (dash) s += ` stroke-dasharray="${dash}"`
  if (op !== undefined) s += ` opacity="${op}"`
  if (tf) s += ` transform="${tf}"`
  if (filter) s += ` filter="url(#${filter})"`
  return s + (extra ? ' ' + extra : '')
}

export const rect = (x, y, w, h, o = {}) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${o.r ? ` rx="${n(o.r)}"` : ''}${attrs(o)}/>`
export const ell = (cx, cy, rx, ry, o = {}) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"${attrs(o)}/>`
export const circ = (cx, cy, r, o = {}) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrs(o)}/>`
export const path = (d, o = {}) => `<path d="${d}"${attrs(o)}/>`
export const poly = (pts, o = {}) =>
  `<polygon points="${pts.map((p) => p.map(n).join(',')).join(' ')}"${attrs(o)}/>`
export const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"${attrs({ stroke: '#000', ...o })}/>`
export const g = (inner, tf, o = {}) => `<g${tf ? ` transform="${tf}"` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''}>${Array.isArray(inner) ? inner.join('') : inner}</g>`
export const text = (x, y, s, o = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-family="Arial, Helvetica, sans-serif" font-weight="${o.weight ?? 700}" font-size="${o.size ?? 14}" text-anchor="${o.anchor ?? 'middle'}" fill="${o.fill ?? '#fff'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.tf ? ` transform="${o.tf}"` : ''}>${s}</text>`
export const shadow = (cx, cy, rx, ry = rx * 0.14) => ell(cx, cy, rx, ry, { fill: 'url(#gShadow)' })
// glossy highlight overlay
export const sheen = (x, y, w, h, r = 0, op = 0.5) => rect(x, y, w, h, { r, fill: 'url(#gSheen)', op })

const stops = (arr) => arr.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')
const lin = (id, arr, v = false, extra = '') =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}"${extra}>${stops(arr)}</linearGradient>`

export const defs = `<defs>
${lin('gWhite', [[0, '#ffffff'], [0.55, '#eef2f4'], [1, '#c9d2d8']])}
${lin('gWhiteV', [[0, '#ffffff'], [1, '#d9e0e4']], true)}
${lin('gSteel', [[0, '#8e999f'], [0.28, '#eef2f4'], [0.6, '#bcc6cb'], [1, '#76828a']])}
${lin('gSteelV', [[0, '#f4f7f8'], [0.5, '#c4cdd2'], [1, '#8f9ba2']], true)}
${lin('gDark', [[0, '#12181b'], [0.35, '#3b464c'], [0.7, '#1d2428'], [1, '#0b0f11']])}
${lin('gDarkV', [[0, '#3a454b'], [1, '#12181b']], true)}
${lin('gGlass', [[0, '#1d7aa8'], [1, '#0b2c4a']], false, ' gradientTransform="rotate(35)"')}
${lin('gSun', [[0, '#ffd978'], [0.42, '#f58a3c'], [0.75, '#a43a6a'], [1, '#2b2a6e']], true)}
${lin('gSolar', [[0, '#1f4aa0'], [1, '#0a1d49']], false, ' gradientTransform="rotate(60)"')}
${lin('gRed', [[0, '#ef5b45'], [1, '#a5271b']], true)}
${lin('gRedH', [[0, '#8f1f15'], [0.4, '#ec5a44'], [1, '#8f1f15']])}
${lin('gBlue', [[0, '#3b86e6'], [1, '#14468f']], true)}
${lin('gBlueH', [[0, '#123f86'], [0.4, '#3f8af0'], [1, '#123f86']])}
${lin('gGreen', [[0, '#35b873'], [1, '#17794a']], true)}
${lin('gGold', [[0, '#f8dc86'], [0.5, '#caa044'], [1, '#8d6a1b']], true)}
${lin('gOrange', [[0, '#ffb43c'], [1, '#e07d00']], true)}
${lin('gTankBlack', [[0, '#0b0f11'], [0.38, '#444f55'], [0.7, '#182024'], [1, '#050708']])}
${lin('gTankBlue', [[0, '#0d3a7a'], [0.38, '#3d86e4'], [0.7, '#14509f'], [1, '#082a5a']])}
${lin('gTankGreen', [[0, '#0f4a2e'], [0.38, '#3fb577'], [0.7, '#15733f'], [1, '#093a22']])}
${lin('gTankTop', [[0, '#5a666d'], [1, '#2a3238']], true)}
${lin('gSheen', [[0, '#ffffff', 0.9], [1, '#ffffff', 0]], true)}
${lin('gShadeR', [[0, '#000', 0], [1, '#000', 0.2]])}
${lin('gShadeL', [[0, '#000', 0.16], [1, '#000', 0]])}
<radialGradient id="gShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#0b2430" stop-opacity="0.38"/><stop offset="1" stop-color="#0b2430" stop-opacity="0"/></radialGradient>
<radialGradient id="gCone" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#4b585f"/><stop offset="0.45" stop-color="#1b2226"/><stop offset="1" stop-color="#070a0b"/></radialGradient>
<radialGradient id="gLens" cx="0.4" cy="0.38" r="0.7"><stop offset="0" stop-color="#6fd3ff"/><stop offset="0.35" stop-color="#17426b"/><stop offset="1" stop-color="#050b14"/></radialGradient>
<radialGradient id="gGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3ff0ff" stop-opacity="0.9"/><stop offset="1" stop-color="#3ff0ff" stop-opacity="0"/></radialGradient>
<pattern id="pMesh" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#1a2125"/><circle cx="3.5" cy="3.5" r="1.8" fill="#4a565d"/></pattern>
<pattern id="pCells" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="none" stroke="#7aa2e8" stroke-width="1.2" stroke-opacity=".55"/></pattern>
<pattern id="pKeys" width="22" height="16" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="18" height="12" rx="2.5" fill="#c4ccd1"/></pattern>
<pattern id="pVent" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="none"/><rect y="2" width="8" height="3" fill="#000" fill-opacity=".22"/></pattern>
</defs>`

export function frame(inner, { bg = ['#EAF1F3', '#D3E2E7'], zoom = null, ground = true, dark = false } = {}) {
  const [c1, c2] = dark ? ['#16313a', '#0b1c23'] : bg
  let body = inner
  if (zoom) {
    const [fx, fy, s] = zoom
    body = `<g transform="translate(${n(400 - fx * s)} ${n(300 - fy * s)}) scale(${s})">${inner}</g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img">
${defs}
<defs><linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#bgGrad)"/>
${ground && !zoom ? `<ellipse cx="400" cy="548" rx="420" ry="46" fill="#fff" opacity="${dark ? 0.05 : 0.5}"/>` : ''}
${body}
</svg>`
}
