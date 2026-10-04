import { rect, ell, circ, path, poly, line, g, text, shadow, sheen } from './shapes.mjs'

/* ---------- COMPUTERS ---------- */
export function laptop() {
  const o = [shadow(400, 505, 330, 14)]
  o.push(rect(215, 130, 370, 260, { r: 14, fill: 'url(#gSteelV)' }))
  o.push(rect(224, 139, 352, 242, { r: 8, fill: '#0c1216' }))
  o.push(rect(230, 145, 340, 230, { r: 4, fill: 'url(#gSun)' }))
  o.push(path('M230 375 L230 300 L300 250 L360 295 L430 240 L500 300 L570 270 L570 375 Z', { fill: '#1b1a4b', op: 0.9 }))
  o.push(circ(480, 215, 28, { fill: '#ffe9a8' }))
  o.push(rect(250, 330, 300, 28, { r: 14, fill: '#fff', op: 0.18 }))
  ;[0, 1, 2, 3].forEach((i) => o.push(circle2(268 + i * 40, 344, 8, ['#e5173f', '#1ea5ff', '#26c281', '#f5a623'][i])))
  o.push(poly([[230, 145], [450, 145], [350, 375], [230, 375]], { fill: '#fff', op: 0.07 }))
  // base
  o.push(poly([[165, 396], [635, 396], [690, 452], [110, 452]], { fill: 'url(#gSteelV)' }))
  o.push(path('M110 452 L690 452 L690 462 Q690 470 680 470 L120 470 Q110 470 110 462 Z', { fill: '#8d99a0' }))
  o.push('<clipPath id="kbc"><polygon points="190,404 610,404 650,444 150,444"/></clipPath>')
  o.push(g(rect(150, 404, 500, 40, { fill: 'url(#pKeys)' }), null).replace('<g>', '<g clip-path="url(#kbc)">'))
  o.push(poly([[190, 404], [610, 404], [650, 444], [150, 444]], { fill: 'url(#gShadeL)' }))
  o.push(poly([[345, 452], [455, 452], [462, 462], [338, 462]], { fill: '#b2bdc3', stroke: '#8d99a0', sw: 1 }))
  o.push(path('M330 396 L470 396 Q472 402 462 402 L338 402 Q328 402 330 396Z', { fill: '#7c898f' }))
  return o.join('')
}
const circle2 = (x, y, r, fill) => circ(x, y, r, { fill })

export function desktop() {
  const o = [shadow(400, 510, 340, 14)]
  // tower
  o.push(rect(130, 170, 160, 335, { r: 12, fill: 'url(#gDark)' }))
  o.push(rect(142, 184, 136, 270, { r: 8, fill: '#0b1519' }))
  ;[0, 1, 2].forEach((i) => {
    const cy = 232 + i * 82
    o.push(circ(210, cy, 40, { fill: 'url(#gGlow)' }), circ(210, cy, 30, { stroke: '#3fe0ff', sw: 3 }), circ(210, cy, 8, { fill: '#3fe0ff' }))
    for (let k = 0; k < 4; k++) o.push(path(`M210 ${cy} L${210 + 24 * Math.cos((k * Math.PI) / 2 + 0.5)} ${cy + 24 * Math.sin((k * Math.PI) / 2 + 0.5)}`, { stroke: '#3fe0ff', sw: 5, cap: 'round', op: 0.8 }))
  })
  o.push(circ(210, 478, 9, { fill: '#26c281' }) + rect(150, 470, 36, 6, { r: 3, fill: '#333f45' }))
  o.push(poly([[142, 184], [200, 184], [150, 454], [142, 454]], { fill: '#fff', op: 0.05 }))
  // monitor
  o.push(rect(335, 150, 345, 215, { r: 8, fill: 'url(#gDarkV)' }))
  o.push(rect(342, 157, 331, 201, { r: 3, fill: 'url(#gGlass)' }))
  o.push(rect(362, 178, 120, 70, { r: 5, fill: '#fff', op: 0.9 }) + rect(372, 190, 90, 8, { r: 3, fill: '#1ea5ff' }) + rect(372, 206, 70, 6, { r: 3, fill: '#9fb1ba' }) + rect(372, 220, 80, 6, { r: 3, fill: '#9fb1ba' }))
  o.push(rect(500, 178, 150, 160, { r: 5, fill: '#0a2f4d', op: 0.8 }) + path('M510 320 L545 270 L575 295 L610 235 L640 320 Z', { fill: '#26c281', op: 0.85 }))
  o.push(poly([[342, 157], [520, 157], [440, 358], [342, 358]], { fill: '#fff', op: 0.07 }))
  o.push(rect(490, 365, 28, 52, { fill: 'url(#gDark)' }) + rect(445, 415, 118, 12, { r: 6, fill: 'url(#gDark)' }))
  // keyboard + mouse
  o.push(poly([[345, 470], [650, 470], [670, 505], [325, 505]], { fill: 'url(#gDarkV)' }))
  o.push('<clipPath id="kbd"><polygon points="352,474 643,474 658,500 337,500"/></clipPath>')
  o.push('<g clip-path="url(#kbd)">' + rect(330, 470, 340, 40, { fill: 'url(#pMesh)' }) + '</g>')
  o.push(rect(695, 470, 28, 40, { r: 14, fill: 'url(#gDarkV)' }) + line(709, 470, 709, 486, { stroke: '#8d999f', sw: 1.5 }))
  return o.join('')
}

export function monitor() {
  const o = [shadow(400, 505, 300, 12)]
  o.push(path('M395 380 L405 380 L420 470 L380 470 Z', { fill: 'url(#gSteelV)' }))
  o.push(ell(400, 482, 130, 18, { fill: 'url(#gSteelV)' }) + ell(400, 478, 130, 16, { fill: '#e9eef0' }))
  o.push(rect(120, 100, 560, 290, { r: 10, fill: 'url(#gDarkV)' }))
  o.push(rect(128, 108, 544, 274, { r: 4, fill: '#0b1318' }))
  o.push(rect(130, 110, 540, 270, { r: 3, fill: 'url(#gGlass)' }))
  o.push(circ(560, 170, 90, { fill: '#7b5bff', op: 0.45 }) + circ(250, 300, 110, { fill: '#26c9d8', op: 0.4 }) + circ(420, 240, 70, { fill: '#ff6a88', op: 0.4 }))
  o.push(path('M130 340 C220 280 300 360 400 300 C500 240 580 320 670 270 L670 380 L130 380 Z', { fill: '#0b2c4a', op: 0.75 }))
  o.push(poly([[130, 110], [430, 110], [320, 380], [130, 380]], { fill: '#fff', op: 0.07 }))
  o.push(circ(400, 392, 2.5, { fill: '#26c281' }))
  return o.join('')
}

/* ---------- CCTV ---------- */
export function bulletCam({ s = 1, tx = 0, ty = 0 } = {}) {
  const inner = [
    shadow(0, 150, 220, 12),
    rect(-30, -10, 30, 150, { r: 8, fill: 'url(#gSteelV)' }),
    rect(-10, 52, 90, 18, { r: 8, fill: 'url(#gSteelV)' }),
    rect(-250, -80, 440, 130, { r: 40, fill: 'url(#gWhite)' }),
    rect(-250, -80, 440, 130, { r: 40, fill: 'url(#gShadeR)' }),
    path('M-262 -92 L120 -92 Q150 -92 150 -70 L-262 -70 Z', { fill: 'url(#gWhiteV)', stroke: '#b4bec4', sw: 2 }),
    ell(-254, -15, 34, 62, { fill: '#10171a' }),
    ell(-254, -15, 26, 50, { fill: 'url(#gLens)' }),
    ell(-262, -30, 8, 14, { fill: '#fff', op: 0.55 }),
    circ(-130, -42, 5, { fill: '#e5173f' }),
    rect(160, -20, 40, 26, { r: 8, fill: '#3b464c' }),
    path('M200 -8 C250 -8 250 60 300 80', { stroke: '#222c31', sw: 8, cap: 'round' }),
    sheen(-240, -76, 380, 30, 24, 0.5),
  ].join('')
  return g(inner, `translate(${400 + tx} ${300 + ty}) scale(${s}) rotate(-6)`)
}

export function domeCam({ s = 1, tx = 0, ty = 0 } = {}) {
  const inner = [
    shadow(0, 118, 160, 12),
    ell(0, 70, 150, 40, { fill: 'url(#gWhiteV)', stroke: '#b4bec4', sw: 2 }),
    path('M-130 66 A130 130 0 0 1 130 66 Z', { fill: 'url(#gWhite)' }),
    path('M-100 66 A100 100 0 0 1 100 66 Z', { fill: 'url(#gDark)' }),
    circ(0, 36, 40, { fill: '#0b1114' }), circ(0, 36, 30, { fill: 'url(#gLens)' }), circ(-10, 26, 8, { fill: '#fff', op: 0.5 }),
    path('M-100 66 A100 100 0 0 1 -30 -20 L-60 66 Z', { fill: '#fff', op: 0.18 }),
    ell(0, 76, 150, 40, { stroke: '#fff', sw: 2, op: 0.4 }),
  ].join('')
  return g(inner, `translate(${400 + tx} ${300 + ty}) scale(${s})`)
}

export function cctvKit() {
  const o = [shadow(400, 520, 340, 14)]
  // cables
  o.push(path('M210 250 C190 380 300 380 330 440', { stroke: '#1d2428', sw: 6, cap: 'round' }))
  o.push(path('M590 250 C610 380 500 380 470 440', { stroke: '#1d2428', sw: 6, cap: 'round' }))
  o.push(path('M400 210 C400 330 400 370 400 420', { stroke: '#1d2428', sw: 6, cap: 'round' }))
  o.push(bulletCam({ s: 0.34, tx: -190, ty: -75 }))
  o.push(bulletCam({ s: 0.34, tx: 190, ty: -75 }))
  o.push(domeCam({ s: 0.42, tx: 0, ty: -150 }))
  // DVR
  o.push(poly([[245, 440], [555, 440], [585, 418], [275, 418]], { fill: '#46535a' }))
  o.push(rect(245, 440, 310, 62, { r: 6, fill: 'url(#gDarkV)' }))
  o.push(rect(260, 454, 120, 30, { r: 4, fill: '#07151c' }) + text(320, 475, 'CH 1-4', { size: 15, fill: '#6fe0ff', weight: 700 }))
  ;[0, 1, 2].forEach((i) => o.push(circ(430 + i * 24, 469, 4.5, { fill: ['#26c281', '#26c281', '#f5a623'][i] })))
  o.push(circ(525, 469, 10, { fill: 'url(#gSteel)' }))
  // power adapter + hdd
  o.push(rect(620, 440, 90, 60, { r: 8, fill: 'url(#gDarkV)' }) + rect(640, 452, 50, 8, { r: 3, fill: '#9aa7ad' }))
  o.push(rect(100, 450, 110, 50, { r: 6, fill: 'url(#gSteelV)' }) + text(155, 480, '1TB HDD', { size: 14, fill: '#3b464c' }))
  return o.join('')
}

export function nvr() {
  const o = [shadow(400, 440, 340, 14)]
  o.push(poly([[110, 300], [690, 300], [730, 262], [150, 262]], { fill: '#5a676e' }))
  o.push(poly([[690, 300], [730, 262], [730, 392], [690, 430]], { fill: '#0e1417' }))
  o.push(rect(110, 300, 580, 130, { r: 8, fill: 'url(#gDarkV)' }))
  o.push(rect(130, 322, 250, 86, { r: 6, fill: 'url(#pVent)' }) + rect(130, 322, 250, 86, { r: 6, stroke: '#4a565d', sw: 2 }))
  o.push(rect(410, 326, 150, 40, { r: 5, fill: '#07151c' }) + text(485, 355, '8 CH  4K', { size: 20, fill: '#6fe0ff', ls: 2 }))
  ;[0, 1, 2, 3].forEach((i) => o.push(circ(420 + i * 28, 392, 5.5, { fill: ['#26c281', '#26c281', '#f5a623', '#e5173f'][i] })))
  o.push(circ(640, 366, 18, { fill: 'url(#gSteel)', stroke: '#566269', sw: 2 }) + circ(640, 366, 5, { fill: '#7f8c93' }))
  o.push(rect(585, 396, 30, 10, { r: 2, fill: '#222b30' }) + rect(622, 396, 30, 10, { r: 2, fill: '#222b30' }))
  o.push(sheen(116, 304, 568, 26, 8, 0.22))
  o.push(rect(130, 430, 40, 12, { r: 3, fill: '#2a3338' }) + rect(630, 430, 40, 12, { r: 3, fill: '#2a3338' }))
  return o.join('')
}

/* ---------- SOLAR ---------- */
function solarPanelShape({ tl, tr, br, bl, cols = 6, rows = 10 }) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const pt = (u, v) => lerp(lerp(tl, tr, u), lerp(bl, br, u), v)
  const o = []
  o.push(poly([tl, tr, br, bl], { fill: '#c7d0d5', stroke: '#9aa7ae', sw: 3 }))
  const inset = (u, v) => pt(u, v)
  o.push(poly([inset(0.025, 0.025), inset(0.975, 0.025), inset(0.975, 0.975), inset(0.025, 0.975)], { fill: 'url(#gSolar)' }))
  for (let i = 1; i < cols; i++) {
    const a = pt(0.025 + (0.95 * i) / cols, 0.025)
    const b = pt(0.025 + (0.95 * i) / cols, 0.975)
    o.push(line(a[0], a[1], b[0], b[1], { stroke: '#8fb0ee', sw: 1.6, op: 0.7 }))
  }
  for (let j = 1; j < rows; j++) {
    const a = pt(0.025, 0.025 + (0.95 * j) / rows)
    const b = pt(0.975, 0.025 + (0.95 * j) / rows)
    o.push(line(a[0], a[1], b[0], b[1], { stroke: '#8fb0ee', sw: 1.2, op: 0.55 }))
  }
  for (let i = 1; i < cols; i++) {
    for (let j = 1; j < rows; j++) {
      const p = pt(0.025 + (0.95 * i) / cols, 0.025 + (0.95 * j) / rows)
      o.push(circ(p[0], p[1], 1.4, { fill: '#c9dafc', op: 0.7 }))
    }
  }
  o.push(poly([pt(0.03, 0.03), pt(0.55, 0.03), pt(0.3, 0.97), pt(0.03, 0.97)], { fill: '#fff', op: 0.1 }))
  return o.join('')
}

export function solarPanel({ cols = 6, rows = 10 } = {}) {
  const o = [shadow(400, 530, 300, 14)]
  o.push(poly([[300, 380], [316, 380], [292, 525], [270, 525]], { fill: 'url(#gSteelV)' }))
  o.push(poly([[470, 392], [486, 392], [520, 525], [498, 525]], { fill: 'url(#gSteelV)' }))
  o.push(rect(250, 520, 300, 10, { r: 4, fill: '#8d99a0' }))
  o.push(solarPanelShape({ tl: [255, 95], tr: [640, 120], br: [590, 440], bl: [170, 410], cols, rows }))
  return o.join('')
}

export function solarBattery({ gel = false } = {}) {
  const o = [shadow(400, 500, 300, 14)]
  const body = gel ? '#24303a' : '#2c3338'
  o.push(poly([[210, 250], [510, 250], [590, 196], [290, 196]], { fill: '#58646b' }))
  o.push(poly([[510, 250], [590, 196], [590, 440], [510, 490]], { fill: '#1a2125' }))
  o.push(rect(210, 250, 300, 240, { r: 6, fill: body }))
  o.push(rect(210, 250, 300, 240, { r: 6, fill: 'url(#gShadeL)' }))
  o.push(rect(228, 280, 264, 150, { r: 6, fill: gel ? '#e9eef0' : '#f2f5f6' }))
  o.push(rect(228, 280, 264, 34, { r: 6, fill: gel ? 'url(#gBlue)' : 'url(#gGreen)' }))
  o.push(text(360, 305, gel ? 'GEL  DEEP CYCLE' : 'DEEP CYCLE  12V', { size: 17, fill: '#fff', ls: 1.5, weight: 800 }))
  o.push(text(360, 360, '12V', { size: 46, fill: '#14323c', weight: 800 }))
  o.push(text(360, 394, 'SOLAR · UPS · INVERTER', { size: 12, fill: '#4b6a75', ls: 1.4, weight: 600 }))
  o.push(rect(250, 440, 220, 6, { r: 3, fill: '#4b6a75', op: 0.5 }))
  o.push(rect(240, 222, 40, 28, { r: 5, fill: 'url(#gRed)' }) + rect(440, 222, 40, 28, { r: 5, fill: '#1a1f22' }))
  o.push(circ(260, 234, 9, { fill: '#c7d0d5' }) + circ(460, 234, 9, { fill: '#c7d0d5' }))
  o.push(text(260, 218, '+', { size: 20, fill: '#e5173f' }) + text(460, 218, '–', { size: 20, fill: '#5d6a71' }))
  o.push(rect(320, 232, 80, 14, { r: 7, fill: '#3b454b' }))
  o.push(sheen(214, 254, 292, 24, 6, 0.18))
  return o.join('')
}

export function inverter() {
  const o = [shadow(400, 520, 220, 12)]
  o.push(rect(250, 100, 300, 410, { r: 22, fill: 'url(#gWhite)' }))
  o.push(rect(250, 100, 300, 410, { r: 22, fill: 'url(#gShadeR)' }))
  o.push(rect(222, 130, 28, 350, { r: 6, fill: 'url(#gSteelV)' }) + rect(550, 130, 28, 350, { r: 6, fill: 'url(#gSteelV)' }))
  o.push(rect(285, 135, 230, 110, { r: 10, fill: '#0b1519' }))
  o.push(rect(295, 145, 210, 90, { r: 6, fill: '#08222c' }))
  o.push(text(340, 188, '230V', { size: 34, fill: '#6fe0ff', weight: 700 }) + text(450, 188, '50Hz', { size: 22, fill: '#6fe0ff', weight: 700 }))
  o.push(rect(310, 204, 180, 14, { r: 3, fill: '#0f3a49' }) + rect(310, 204, 130, 14, { r: 3, fill: '#26c281' }))
  ;[0, 1, 2, 3].forEach((i) => o.push(circ(315 + i * 56, 275, 9, { fill: ['#26c281', '#26c281', '#f5a623', '#d6d9db'][i] })))
  o.push(circ(400, 340, 28, { fill: 'url(#gSteel)', stroke: '#59656c', sw: 2 }) + line(400, 340, 400, 318, { stroke: '#2a343a', sw: 4, cap: 'round' }))
  o.push(rect(290, 400, 220, 90, { r: 8, fill: 'url(#pVent)' }) + rect(290, 400, 220, 90, { r: 8, stroke: '#aab5bb', sw: 1.5 }))
  o.push(sheen(256, 104, 40, 400, 16, 0.5))
  o.push(text(400, 392, 'PURE SINE WAVE', { size: 12, fill: '#4b6a75', ls: 2, weight: 700 }))
  return o.join('')
}

export function solarAccessories() {
  const o = [shadow(400, 520, 340, 14)]
  // charge controller
  o.push(rect(300, 130, 200, 250, { r: 16, fill: 'url(#gBlue)' }))
  o.push(rect(300, 130, 200, 250, { r: 16, fill: 'url(#gShadeR)' }))
  o.push(rect(322, 156, 156, 90, { r: 8, fill: '#07151c' }) + text(400, 205, '13.8V', { size: 34, fill: '#6fe0ff', weight: 700 }) + text(400, 230, 'CHARGING', { size: 12, fill: '#6fe0ff', ls: 2 }))
  ;[0, 1, 2].forEach((i) => o.push(rect(325 + i * 52, 270, 44, 30, { r: 6, fill: '#e9eef0' })))
  ;[0, 1, 2, 3].forEach((i) => o.push(rect(322 + i * 40, 345, 30, 22, { r: 3, fill: '#1a2125' }) + circ(337 + i * 40, 356, 6, { fill: '#9aa7ad' })))
  o.push(sheen(306, 134, 188, 30, 12, 0.35))
  // cable coil
  o.push(circ(190, 410, 82, { fill: '#c92a22' }) + circ(190, 410, 52, { fill: '#e8e9ea' }) + circ(190, 410, 82, { stroke: '#7d150f', sw: 6 }))
  for (let r = 56; r <= 78; r += 7) o.push(circ(190, 410, r, { stroke: '#7d150f', sw: 1.5, op: 0.6 }))
  o.push(circ(190, 410, 52, { stroke: '#cfd3d5', sw: 3 }))
  // MC4 connectors
  o.push(rect(560, 400, 120, 26, { r: 8, fill: 'url(#gDarkV)' }) + rect(540, 405, 30, 16, { r: 4, fill: '#d9a21b' }) + rect(680, 404, 26, 18, { r: 4, fill: 'url(#gSteelV)' }))
  o.push(rect(560, 450, 120, 26, { r: 8, fill: 'url(#gRed)' }) + rect(540, 455, 30, 16, { r: 4, fill: '#d9a21b' }) + rect(680, 454, 26, 18, { r: 4, fill: 'url(#gSteelV)' }))
  // mounting rail
  o.push(poly([[520, 330], [720, 330], [736, 350], [536, 350]], { fill: 'url(#gSteelV)' }) + rect(520, 350, 200, 18, { fill: '#9aa7ae' }))
  o.push(circ(560, 340, 4, { fill: '#4a565d' }) + circ(640, 340, 4, { fill: '#4a565d' }) + circ(700, 340, 4, { fill: '#4a565d' }))
  return o.join('')
}

/* ---------- WATER PUMPS ---------- */
export function waterPump({ color = 'blue' } = {}) {
  const gradH = { blue: 'gBlueH', red: 'gRedH', green: 'gGreen' }[color]
  const o = [shadow(400, 505, 320, 14)]
  o.push(rect(130, 470, 480, 24, { r: 6, fill: 'url(#gDarkV)' }))
  o.push(rect(150, 280, 290, 150, { r: 20, fill: `url(#${gradH})` }))
  for (let i = 0; i < 9; i++) o.push(rect(190 + i * 24, 285, 7, 140, { r: 3, fill: '#000', op: 0.15 }))
  o.push(path('M150 300 Q120 300 120 355 Q120 410 150 410 Z', { fill: 'url(#gDark)' }))
  for (let i = 0; i < 5; i++) o.push(line(112, 316 + i * 20, 135, 316 + i * 20, { stroke: '#566269', sw: 3, op: 0.7 }))
  o.push(rect(190, 428, 220, 42, { r: 6, fill: 'url(#gDarkV)' }))
  o.push(rect(250, 240, 90, 44, { r: 6, fill: '#2a343a' }) + text(295, 268, 'HP', { size: 18, fill: '#8fb0c0' }))
  // pump head
  o.push(circ(500, 360, 98, { fill: 'url(#gSteel)' }) + circ(500, 360, 98, { stroke: '#6b777e', sw: 4 }))
  o.push(circ(500, 360, 58, { fill: 'url(#gSteelV)', stroke: '#6b777e', sw: 3 }) + circ(500, 360, 20, { fill: '#5f6b72' }))
  for (let k = 0; k < 8; k++) o.push(circ(500 + 78 * Math.cos((k * Math.PI) / 4), 360 + 78 * Math.sin((k * Math.PI) / 4), 5, { fill: '#59656c' }))
  o.push(rect(470, 200, 60, 80, { r: 6, fill: 'url(#gSteel)' }) + rect(456, 190, 88, 20, { r: 6, fill: 'url(#gSteelV)' }))
  o.push(rect(580, 330, 96, 60, { r: 6, fill: 'url(#gSteel)' }) + rect(664, 318, 22, 84, { r: 4, fill: 'url(#gSteelV)' }))
  o.push(rect(447, 395, 52, 32, { r: 4, fill: '#8d99a0' }))
  return o.join('')
}

export function pressurePump() {
  const o = [shadow(400, 505, 300, 14)]
  o.push(rect(160, 462, 440, 22, { r: 6, fill: 'url(#gDarkV)' }))
  // pressure vessel
  o.push(path('M470 150 Q470 110 540 110 Q610 110 610 150 L610 440 Q610 470 540 470 Q470 470 470 440 Z', { fill: 'url(#gBlueH)' }))
  o.push(rect(522, 78, 36, 38, { r: 5, fill: 'url(#gSteelV)' }))
  o.push(sheen(480, 130, 30, 320, 12, 0.45))
  // pump body
  o.push(rect(170, 300, 260, 150, { r: 22, fill: 'url(#gGreen)' }))
  for (let i = 0; i < 7; i++) o.push(rect(215 + i * 28, 308, 8, 134, { r: 4, fill: '#000', op: 0.14 }))
  o.push(rect(430, 340, 60, 70, { r: 8, fill: 'url(#gSteel)' }))
  o.push(rect(260, 262, 110, 44, { r: 8, fill: 'url(#gDarkV)' }))
  // gauge
  o.push(circ(315, 220, 52, { fill: 'url(#gSteel)' }) + circ(315, 220, 42, { fill: '#fff' }))
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (0.8 + (k * 1.4) / 8)
    o.push(line(315 + 34 * Math.cos(a), 220 + 34 * Math.sin(a), 315 + 40 * Math.cos(a), 220 + 40 * Math.sin(a), { stroke: '#3b464c', sw: 2 }))
  }
  o.push(line(315, 220, 336, 196, { stroke: '#e5173f', sw: 3, cap: 'round' }) + circ(315, 220, 5, { fill: '#2a343a' }))
  o.push(text(315, 245, 'BAR', { size: 9, fill: '#3b464c' }))
  o.push(rect(150, 360, 30, 40, { r: 5, fill: 'url(#gSteel)' }))
  return o.join('')
}

export function submersible() {
  const o = [shadow(400, 520, 160, 12)]
  o.push(path('M395 40 C395 120 330 120 330 170', { stroke: '#161c1f', sw: 14, cap: 'round' }))
  o.push(rect(330, 120, 140, 50, { r: 8, fill: 'url(#gSteelV)' }) + rect(350, 110, 100, 18, { r: 5, fill: '#8d99a0' }))
  o.push(rect(336, 168, 128, 330, { r: 24, fill: 'url(#gSteel)' }))
  for (let i = 0; i < 6; i++) o.push(line(338, 200 + i * 50, 462, 200 + i * 50, { stroke: '#6b777e', sw: 2, op: 0.5 }))
  o.push(rect(336, 168, 128, 22, { r: 8, fill: '#59656c', op: 0.5 }))
  o.push(rect(352, 330, 96, 70, { r: 6, fill: '#e9eef0' }) + text(400, 360, 'SUBMERSIBLE', { size: 10, fill: '#14323c', ls: 0.5 }) + text(400, 382, '1 HP', { size: 16, fill: '#14323c' }))
  o.push(rect(350, 478, 100, 28, { r: 8, fill: 'url(#gDark)' }))
  o.push(sheen(342, 172, 30, 320, 12, 0.55))
  o.push(rect(470, 130, 90, 18, { r: 8, fill: 'url(#gBlue)' }))
  return o.join('')
}

/* ---------- NETWORKING ---------- */
export function router() {
  const o = [shadow(400, 480, 300, 14)]
  const ant = (x, rot) => g(rect(-9, -210, 18, 210, { r: 9, fill: 'url(#gDarkV)' }) + rect(-14, -10, 28, 20, { r: 6, fill: '#1d2428' }) + rect(-4, -204, 4, 180, { r: 2, fill: '#fff', op: 0.18 }), `translate(${x} 380) rotate(${rot})`)
  o.push(ant(250, -18), ant(400, 0), ant(550, 18))
  o.push(poly([[190, 392], [610, 392], [660, 360], [240, 360]], { fill: '#f6f9fa' }))
  o.push(rect(190, 392, 420, 70, { r: 12, fill: 'url(#gWhiteV)' }))
  o.push(poly([[610, 392], [660, 360], [660, 430], [610, 462]], { fill: '#b9c4ca' }))
  ;[0, 1, 2, 3, 4].forEach((i) => o.push(circ(240 + i * 40, 426, 6, { fill: i === 3 ? '#f5a623' : '#26c281' })))
  o.push(circ(470, 426, 6, { fill: '#26c281' }) + circ(510, 426, 6, { fill: '#3fe0ff' }) + circ(550, 426, 6, { fill: '#26c281' }))
  o.push(rect(200, 444, 400, 5, { r: 2, fill: '#b9c4ca' }))
  o.push(sheen(194, 394, 412, 20, 10, 0.5))
  return o.join('')
}

export function switchUnit({ ports = 16 } = {}) {
  const o = [shadow(400, 400, 340, 12)]
  o.push(poly([[90, 260], [710, 260], [740, 236], [120, 236]], { fill: '#5a676e' }))
  o.push(rect(90, 260, 620, 110, { r: 6, fill: 'url(#gDarkV)' }))
  o.push(rect(70, 268, 24, 94, { r: 4, fill: 'url(#gSteelV)' }) + rect(706, 268, 24, 94, { r: 4, fill: 'url(#gSteelV)' }))
  o.push(circ(82, 282, 4, { fill: '#59656c' }) + circ(82, 348, 4, { fill: '#59656c' }) + circ(718, 282, 4, { fill: '#59656c' }) + circ(718, 348, 4, { fill: '#59656c' }))
  const per = ports / 2
  const pw = Math.min(30, 400 / per)
  const gap = (440 - per * pw) / (per + 1)
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < per; i++) {
      const x = 150 + gap + i * (pw + gap)
      const y = 280 + r * 40
      o.push(rect(x, y, pw, 26, { r: 3, fill: '#050709', stroke: '#6b777e', sw: 1.5 }))
      o.push(rect(x + 3, y + 3, pw - 6, 6, { fill: '#c9a227', op: 0.85 }))
      o.push(circ(x + pw / 2, y + 34, 2.4, { fill: i % 3 === 1 ? '#f5a623' : '#26c281' }))
    }
  }
  o.push(rect(600, 285, 80, 24, { r: 4, fill: '#07151c' }) + text(640, 303, `${ports}P`, { size: 17, fill: '#6fe0ff', ls: 1 }))
  o.push(circ(660, 338, 6, { fill: '#26c281' }) + circ(640, 338, 6, { fill: '#26c281' }))
  o.push(sheen(96, 262, 608, 18, 6, 0.2))
  return o.join('')
}

export function accessPoint() {
  const o = [shadow(400, 470, 260, 16)]
  o.push(ell(400, 420, 230, 56, { fill: '#b5c0c6' }))
  o.push(rect(170, 360, 460, 60, { fill: 'url(#gWhiteV)' }))
  o.push(ell(400, 360, 230, 56, { fill: 'url(#gWhite)', stroke: '#c5ced3', sw: 2 }))
  o.push(ell(400, 356, 150, 34, { fill: '#f3f6f7', stroke: '#d3dbdf', sw: 2 }))
  o.push(ell(400, 356, 60, 14, { fill: '#e4eaed' }))
  o.push(ell(400, 386, 210, 36, { stroke: '#3fe0ff', sw: 5, op: 0.9 }))
  o.push(ell(400, 386, 210, 36, { stroke: '#3fe0ff', sw: 14, op: 0.2 }))
  o.push(path('M170 420 A230 56 0 0 0 630 420', { stroke: '#a9b6bd', sw: 3 }))
  // wifi waves
  ;[70, 120, 170].forEach((r, i) => o.push(path(`M${400 - r} ${250 - r * 0.2} A${r} ${r} 0 0 1 ${400 + r} ${250 - r * 0.2}`, { stroke: '#0a6a74', sw: 7, cap: 'round', op: 0.85 - i * 0.2 })))
  o.push(circ(400, 262, 10, { fill: '#0a6a74' }))
  return o.join('')
}

/* ---------- POWER ---------- */
export function generator() {
  const o = [shadow(400, 530, 330, 15)]
  o.push(path('M170 500 L170 190 Q170 160 200 160 L600 160 Q630 160 630 190 L630 500', { stroke: '#c2281d', sw: 18, cap: 'round' }))
  o.push(path('M170 300 L630 300', { stroke: '#c2281d', sw: 14 }))
  o.push(rect(200, 190, 330, 60, { r: 26, fill: 'url(#gRed)' }) + sheen(212, 194, 306, 20, 10, 0.5) + circ(235, 190, 16, { fill: '#222b30' }) + circ(235, 190, 8, { fill: '#8d99a0' }))
  o.push(rect(215, 320, 220, 150, { r: 14, fill: 'url(#gDark)' }))
  for (let i = 0; i < 5; i++) o.push(rect(228 + i * 40, 330, 12, 130, { r: 4, fill: '#fff', op: 0.08 }))
  o.push(circ(250, 400, 30, { fill: 'url(#gSteel)', stroke: '#566269', sw: 3 }) + circ(250, 400, 9, { fill: '#566269' }))
  o.push(rect(440, 330, 170, 130, { r: 14, fill: 'url(#gSteelV)' }))
  o.push(rect(455, 345, 60, 20, { r: 4, fill: '#07151c' }) + text(485, 361, '230V', { size: 12, fill: '#6fe0ff' }))
  o.push(circ(480, 415, 20, { fill: '#17202a', stroke: '#566269', sw: 3 }) + circ(480, 415, 6, { fill: '#566269' }))
  o.push(circ(560, 415, 20, { fill: '#17202a', stroke: '#566269', sw: 3 }) + circ(560, 415, 6, { fill: '#566269' }))
  o.push(circ(560, 365, 10, { fill: '#e5173f' }) + rect(580, 356, 24, 18, { r: 4, fill: '#f5a623' }))
  o.push(circ(200, 500, 30, { fill: '#1b2327' }) + circ(200, 500, 14, { fill: '#8d99a0' }) + circ(600, 500, 30, { fill: '#1b2327' }) + circ(600, 500, 14, { fill: '#8d99a0' }))
  return o.join('')
}

export function stabilizer() {
  const o = [shadow(400, 500, 280, 14)]
  o.push(rect(190, 150, 420, 320, { r: 18, fill: 'url(#gBlue)' }))
  o.push(rect(190, 150, 420, 320, { r: 18, fill: 'url(#gShadeR)' }))
  o.push(rect(225, 182, 210, 100, { r: 8, fill: '#07151c' }))
  o.push(text(330, 250, '230', { size: 62, fill: '#6fe0ff', weight: 700 }) + text(420, 252, 'V', { size: 22, fill: '#6fe0ff' }))
  o.push(circ(525, 232, 42, { fill: 'url(#gSteel)', stroke: '#2a343a', sw: 3 }) + line(525, 232, 525, 202, { stroke: '#2a343a', sw: 5, cap: 'round' }))
  ;[0, 1, 2].forEach((i) => o.push(circ(240 + i * 40, 318, 8, { fill: ['#26c281', '#f5a623', '#e5173f'][i] })))
  ;[0, 1, 2].forEach((i) => o.push(rect(235 + i * 110, 365, 90, 70, { r: 8, fill: '#e9eef0' }) + rect(250 + i * 110, 380, 8, 20, { fill: '#2a343a' }) + rect(268 + i * 110, 380, 8, 20, { fill: '#2a343a' }) + rect(259 + i * 110, 408, 8, 14, { fill: '#2a343a' })))
  o.push(rect(166, 190, 24, 240, { r: 6, fill: 'url(#gSteelV)' }) + rect(610, 190, 24, 240, { r: 6, fill: 'url(#gSteelV)' }))
  o.push(sheen(196, 154, 408, 30, 14, 0.35))
  return o.join('')
}

/* ---------- HOME APPLIANCES ---------- */
export function microwave() {
  const o = [shadow(400, 470, 300, 14)]
  o.push(rect(130, 180, 540, 280, { r: 18, fill: 'url(#gSteelV)' }))
  o.push(rect(130, 180, 540, 280, { r: 18, fill: 'url(#gShadeR)' }))
  o.push(rect(155, 205, 340, 230, { r: 12, fill: 'url(#gDarkV)' }))
  o.push(rect(170, 220, 310, 200, { r: 8, fill: '#0b1519' }))
  for (let i = 0; i < 6; i++) o.push(line(180, 240 + i * 30, 470, 240 + i * 30, { stroke: '#2b3a41', sw: 1.5 }))
  o.push(poly([[170, 220], [330, 220], [250, 420], [170, 420]], { fill: '#fff', op: 0.08 }))
  o.push(rect(500, 205, 14, 230, { r: 6, fill: 'url(#gSteel)' }))
  o.push(rect(530, 215, 115, 54, { r: 6, fill: '#07151c' }) + text(588, 255, '2:30', { size: 32, fill: '#6fe0ff', weight: 700 }))
  o.push(circ(588, 330, 36, { fill: 'url(#gDark)', stroke: '#8d99a0', sw: 3 }) + line(588, 330, 588, 304, { stroke: '#fff', sw: 4, cap: 'round' }))
  o.push(rect(540, 385, 90, 22, { r: 6, fill: '#e5173f' }) + text(585, 401, 'START', { size: 12, fill: '#fff' }))
  o.push(rect(150, 458, 40, 10, { r: 3, fill: '#333f45' }) + rect(610, 458, 40, 10, { r: 3, fill: '#333f45' }))
  return o.join('')
}

export function washingMachine() {
  const o = [shadow(400, 520, 220, 14)]
  o.push(rect(245, 70, 310, 445, { r: 16, fill: 'url(#gWhite)' }))
  o.push(rect(245, 70, 310, 445, { r: 16, fill: 'url(#gShadeR)' }))
  o.push(rect(245, 70, 310, 88, { r: 16, fill: 'url(#gWhiteV)' }) + line(245, 158, 555, 158, { stroke: '#aeb9bf', sw: 2 }))
  o.push(rect(268, 92, 74, 40, { r: 6, fill: '#e1e8eb', stroke: '#b9c3c9', sw: 1.5 }) + rect(280, 106, 50, 12, { r: 4, fill: '#9fb1ba' }))
  o.push(rect(372, 92, 80, 40, { r: 6, fill: '#07151c' }) + text(412, 120, '60°C', { size: 20, fill: '#6fe0ff', weight: 700 }))
  o.push(circ(498, 112, 24, { fill: 'url(#gSteel)', stroke: '#8d99a0', sw: 2 }) + line(498, 112, 498, 92, { stroke: '#2a343a', sw: 4, cap: 'round' }))
  o.push(circ(400, 340, 106, { fill: 'url(#gSteel)', stroke: '#9aa7ae', sw: 3 }))
  o.push(circ(400, 340, 86, { fill: '#10242f' }) + circ(400, 340, 80, { fill: 'url(#gGlass)' }))
  o.push(path('M330 340 A70 70 0 0 1 470 340 A70 70 0 0 1 330 340 Z', { fill: '#0a2a44', op: 0.4 }))
  o.push(path('M340 360 Q370 330 400 360 T460 350 L460 400 Q400 420 340 400 Z', { fill: '#6fc3ff', op: 0.35 }))
  o.push(path('M335 300 A70 70 0 0 1 400 268 L370 330 Z', { fill: '#fff', op: 0.3 }))
  o.push(circ(498, 340, 10, { fill: '#aeb9bf' }) + rect(285, 480, 40, 12, { r: 4, fill: '#333f45' }) + rect(475, 480, 40, 12, { r: 4, fill: '#333f45' }))
  return o.join('')
}

/* ---------- ELECTRONICS & ACCESSORIES ---------- */
export function powerBank() {
  const o = [shadow(420, 500, 280, 12)]
  o.push(g(
    rect(-70, -170, 140, 320, { r: 26, fill: 'url(#gDark)' }) + rect(-60, -160, 120, 300, { r: 20, fill: 'url(#gShadeL)' }) +
      rect(-36, -130, 72, 10, { r: 5, fill: '#26c281' }) + rect(-36, -108, 72, 10, { r: 5, fill: '#26c281' }) + rect(-36, -86, 72, 10, { r: 5, fill: '#2a3a40' }) + rect(-36, -64, 72, 10, { r: 5, fill: '#2a3a40' }) +
      text(0, 10, '20000', { size: 26, fill: '#fff', weight: 800 }) + text(0, 34, 'mAh', { size: 15, fill: '#8fb0c0' }) +
      rect(-44, 100, 28, 14, { r: 3, fill: '#050709', stroke: '#8d99a0', sw: 1.5 }) + rect(-12, 100, 28, 14, { r: 3, fill: '#050709', stroke: '#8d99a0', sw: 1.5 }) + rect(20, 100, 24, 14, { r: 3, fill: '#050709', stroke: '#8d99a0', sw: 1.5 }) +
      sheen(-66, -166, 36, 310, 18, 0.28),
    'translate(330 330) rotate(-8)'))
  o.push(g(rect(-45, -105, 90, 210, { r: 20, fill: 'url(#gSteelV)' }) + rect(-34, -90, 68, 8, { r: 4, fill: '#26c281' }) + rect(-34, -72, 68, 8, { r: 4, fill: '#2a3a40' }) + text(0, 10, '10000', { size: 18, fill: '#2a3a40', weight: 800 }) + rect(-14, 82, 28, 12, { r: 3, fill: '#050709' }), 'translate(560 395) rotate(10)'))
  o.push(path('M500 515 C540 560 640 560 690 500', { stroke: '#e9eef0', sw: 8, cap: 'round' }))
  return o.join('')
}

export function earbuds() {
  const o = [shadow(400, 480, 250, 14)]
  o.push(rect(270, 290, 260, 180, { r: 70, fill: 'url(#gWhite)' }))
  o.push(path('M270 360 Q270 290 335 290 L465 290 Q530 290 530 360 Z', { fill: '#f7fafb' }))
  o.push(line(272, 358, 528, 358, { stroke: '#b9c3c9', sw: 2.5 }))
  o.push(circ(400, 330, 6, { fill: '#26c281' }) + circ(400, 408, 14, { fill: 'none', stroke: '#b9c3c9', sw: 3 }))
  o.push(sheen(280, 296, 240, 40, 30, 0.55))
  const bud = (x, y, rot, flip) => g(ell(0, 0, 38, 46, { fill: 'url(#gWhite)', stroke: '#c5ced3', sw: 2 }) + rect(flip ? -8 : -4, 30, 12, 92, { r: 6, fill: 'url(#gWhite)', stroke: '#c5ced3', sw: 2 }) + circ(0, -8, 14, { fill: '#dfe7ea' }) + circ(0, -8, 6, { fill: '#3b464c' }) + sheen(-30, -40, 22, 50, 10, 0.7), `translate(${x} ${y}) rotate(${rot})`)
  o.push(bud(210, 180, -14, false), bud(590, 180, 14, true))
  return o.join('')
}

export function extension() {
  const o = [shadow(400, 440, 340, 12)]
  o.push(rect(100, 270, 600, 120, { r: 22, fill: 'url(#gWhite)' }))
  o.push(rect(100, 270, 600, 120, { r: 22, fill: 'url(#gShadeR)' }))
  for (let i = 0; i < 5; i++) {
    const x = 138 + i * 86
    o.push(rect(x, 292, 70, 76, { r: 10, fill: '#eef2f4', stroke: '#b9c3c9', sw: 2 }))
    o.push(rect(x + 29, 304, 12, 16, { r: 2, fill: '#2a343a' }) + rect(x + 14, 336, 12, 14, { r: 2, fill: '#2a343a' }) + rect(x + 44, 336, 12, 14, { r: 2, fill: '#2a343a' }))
  }
  o.push(rect(600, 250, 70, 24, { r: 8, fill: 'url(#gRed)' }) + text(635, 267, 'ON', { size: 12, fill: '#fff' }))
  o.push(path('M100 330 C40 330 20 420 120 470 C220 510 330 470 360 520', { stroke: '#e9eef0', sw: 14, cap: 'round' }))
  o.push(path('M100 330 C40 330 20 420 120 470 C220 510 330 470 360 520', { stroke: '#b9c3c9', sw: 2, cap: 'round', dash: '2 12' }))
  o.push(sheen(106, 274, 588, 22, 16, 0.55))
  return o.join('')
}

export function wallMount() {
  const o = [shadow(400, 530, 260, 12)]
  o.push(rect(70, 70, 660, 460, { fill: '#e7ecee' }) + rect(70, 70, 660, 460, { fill: 'url(#gShadeL)' }))
  for (let r = 0; r < 5; r++) o.push(line(70, 130 + r * 95, 730, 130 + r * 95, { stroke: '#d4dbde', sw: 1.5 }))
  // wall plate
  o.push(rect(330, 120, 140, 380, { r: 8, fill: 'url(#gDarkV)' }))
  ;[[360, 150], [440, 150], [360, 470], [440, 470]].forEach(([x, y]) => o.push(circ(x, y, 9, { fill: '#8d99a0' }) + circ(x, y, 3.5, { fill: '#3b464c' })))
  // arms
  o.push(rect(210, 240, 380, 26, { r: 6, fill: 'url(#gSteelV)' }) + rect(210, 360, 380, 26, { r: 6, fill: 'url(#gSteelV)' }))
  o.push(rect(210, 240, 22, 146, { r: 6, fill: 'url(#gSteel)' }) + rect(568, 240, 22, 146, { r: 6, fill: 'url(#gSteel)' }))
  o.push(rect(385, 266, 30, 94, { r: 4, fill: 'url(#gSteel)' }))
  ;[[221, 262], [579, 262], [221, 364], [579, 364]].forEach(([x, y]) => o.push(circ(x, y, 6, { fill: '#4a565d' })))
  o.push(circ(400, 313, 14, { fill: '#e5173f' }) + circ(400, 313, 5, { fill: '#fff' }))
  return o.join('')
}
