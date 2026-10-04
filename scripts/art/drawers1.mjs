import { rect, ell, circ, path, poly, line, g, text, shadow, sheen } from './shapes.mjs'

/* ---------- WATER TANKS ---------- */
export function tank({ color = 'black', w = 300, h = 340, cx = 400, yb = 505, ribs = 5 } = {}) {
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  const rx = w / 2
  const ry = w * 0.1
  const yt = yb - h
  const grad = { black: 'gTankBlack', blue: 'gTankBlue', green: 'gTankGreen' }[color]
  const o = []
  o.push(shadow(cx + 20, yb + ry * 0.7, w * 0.72, 16))
  o.push(path(`M${x0},${yt} L${x0},${yb} A${rx},${ry} 0 0 0 ${x1},${yb} L${x1},${yt} A${rx},${ry} 0 0 0 ${x0},${yt} Z`, { fill: `url(#${grad})` }))
  for (let i = 1; i <= ribs; i++) {
    const y = yt + (i * h) / (ribs + 1)
    o.push(path(`M${x0},${y} A${rx},${ry} 0 0 0 ${x1},${y}`, { stroke: '#000', sw: 3, op: 0.35 }))
    o.push(path(`M${x0 + 2},${y + 3} A${rx - 2},${ry} 0 0 0 ${x1 - 2},${y + 3}`, { stroke: '#fff', sw: 1.6, op: 0.18 }))
  }
  o.push(ell(cx, yt, rx, ry, { fill: color === 'black' ? 'url(#gTankTop)' : `url(#${grad})` }))
  o.push(ell(cx, yt, rx, ry, { stroke: '#fff', sw: 2, op: 0.15 }))
  o.push(ell(cx, yt, rx * 0.8, ry * 0.8, { stroke: '#000', sw: 2, op: 0.25 }))
  // lid
  o.push(rect(cx - w * 0.15, yt - 18, w * 0.3, 16, { r: 4, fill: 'url(#gDark)' }))
  o.push(ell(cx, yt - 18, w * 0.15, ry * 0.42, { fill: '#2c353b' }))
  o.push(ell(cx, yt - 18, w * 0.15 * 0.7, ry * 0.3, { stroke: '#8a979e', sw: 1.5 }))
  // highlight
  o.push(rect(x0 + w * 0.1, yt + 6, w * 0.07, h - 6, { r: 8, fill: '#fff', op: 0.22 }))
  o.push(rect(x1 - w * 0.12, yt + 10, w * 0.03, h - 24, { r: 4, fill: '#fff', op: 0.08 }))
  // outlet pipe + valve
  const py = yb - 52
  o.push(rect(x1 - 8, py, 58, 18, { r: 4, fill: 'url(#gSteelV)' }))
  o.push(rect(x1 + 20, py - 4, 10, 26, { r: 2, fill: 'url(#gSteelV)' }))
  o.push(rect(x1 + 24, py - 26, 5, 24, { r: 2, fill: '#cfd6da' }))
  o.push(rect(x1 + 13, py - 34, 28, 9, { r: 4, fill: 'url(#gBlue)' }))
  o.push(rect(x1 + 40, py + 2, 22, 14, { r: 3, fill: 'url(#gSteelV)' }))
  // sticker
  o.push(rect(cx - 48, yt + h * 0.42, 96, 44, { r: 6, fill: '#ffffff', op: 0.92 }))
  o.push(text(cx, yt + h * 0.42 + 19, 'FOOD GRADE', { size: 13, fill: '#14323c', ls: 1 }))
  o.push(text(cx, yt + h * 0.42 + 35, 'UV STABILISED', { size: 9.5, fill: '#4b6a75', weight: 600, ls: 0.6 }))
  return o.join('')
}

export function fittings() {
  const o = [shadow(400, 505, 300, 18)]
  // ball valve
  o.push(rect(230, 330, 70, 56, { r: 6, fill: 'url(#gGold)' }))
  o.push(rect(300, 318, 110, 80, { r: 22, fill: 'url(#gGold)' }))
  o.push(rect(410, 330, 70, 56, { r: 6, fill: 'url(#gGold)' }))
  o.push(rect(342, 270, 26, 56, { r: 4, fill: '#9a7420' }))
  o.push(rect(300, 250, 110, 26, { r: 12, fill: 'url(#gRed)' }))
  o.push(sheen(305, 322, 100, 30, 14, 0.4))
  // PVC elbow + coupler
  o.push(path('M190 470 L190 420 Q190 400 210 400 L270 400 L270 440 L230 440 L230 470 Z', { fill: 'url(#gWhite)', stroke: '#b9c3c9', sw: 2 }))
  o.push(rect(300, 440, 120, 40, { r: 8, fill: 'url(#gWhiteV)', stroke: '#b9c3c9', sw: 2 }))
  o.push(rect(430, 440, 120, 40, { r: 8, fill: 'url(#gWhiteV)', stroke: '#b9c3c9', sw: 2 }))
  // float valve
  o.push(line(560, 330, 640, 270, { stroke: '#8f9ba2', sw: 7, cap: 'round' }))
  o.push(circ(660, 245, 44, { fill: 'url(#gOrange)' }))
  o.push(circ(646, 230, 14, { fill: '#fff', op: 0.45 }))
  o.push(rect(530, 322, 54, 38, { r: 6, fill: 'url(#gSteelV)' }))
  o.push(rect(574, 330, 40, 22, { r: 4, fill: 'url(#gBlue)' }))
  // hose
  o.push(path('M600 470 C650 420 720 520 650 520 C590 520 600 470 560 520', { stroke: '#1e5fa8', sw: 12, cap: 'round' }))
  return o.join('')
}

/* ---------- FRIDGES & FREEZERS ---------- */
function handle(x, y, h) {
  return rect(x, y, 7, h, { r: 3.5, fill: 'url(#gSteel)' }) + rect(x + 7, y, 3, h, { r: 1.5, fill: '#000', op: 0.12 })
}

export function fridge({ kind = 'single', finish = 'white' } = {}) {
  const fillBody = finish === 'steel' ? 'url(#gSteel)' : 'url(#gWhite)'
  const o = []
  if (kind === 'single') {
    o.push(shadow(400, 518, 190, 14))
    o.push(rect(305, 100, 190, 410, { r: 12, fill: fillBody }))
    o.push(rect(305, 100, 190, 410, { r: 12, fill: 'url(#gShadeR)' }))
    o.push(line(308, 225, 492, 225, { stroke: '#7e8b92', sw: 3, op: 0.8 }))
    o.push(handle(322, 140, 56) + handle(322, 258, 110))
    o.push(rect(318, 112, 164, 8, { r: 3, fill: '#fff', op: 0.5 }))
    o.push(rect(325, 508, 24, 12, { r: 3, fill: '#4a555b' }) + rect(451, 508, 24, 12, { r: 3, fill: '#4a555b' }))
    o.push(sheen(312, 106, 40, 395, 14, 0.4))
  } else if (kind === 'double') {
    o.push(shadow(400, 518, 220, 14))
    o.push(rect(270, 70, 260, 440, { r: 14, fill: fillBody }))
    o.push(rect(270, 70, 260, 440, { r: 14, fill: 'url(#gShadeR)' }))
    o.push(line(274, 255, 526, 255, { stroke: '#6f7c84', sw: 3.5, op: 0.8 }))
    o.push(handle(290, 150, 70) + handle(290, 270, 140))
    o.push(rect(300, 100, 40, 12, { r: 4, fill: '#8bd3ff', op: 0.8 }))
    o.push(rect(292, 506, 28, 14, { r: 3, fill: '#3f4a50' }) + rect(480, 506, 28, 14, { r: 3, fill: '#3f4a50' }))
    o.push(sheen(280, 76, 46, 420, 16, 0.45))
  } else if (kind === 'sbs') {
    o.push(shadow(400, 518, 270, 15))
    o.push(rect(215, 70, 370, 440, { r: 14, fill: fillBody }))
    o.push(rect(215, 70, 370, 440, { r: 14, fill: 'url(#gShadeR)' }))
    o.push(line(400, 74, 400, 508, { stroke: '#56636b', sw: 4, op: 0.9 }))
    o.push(handle(384, 200, 120) + handle(409, 200, 120))
    o.push(rect(245, 140, 105, 150, { r: 10, fill: 'url(#gDarkV)' }))
    o.push(rect(260, 156, 75, 26, { r: 5, fill: '#0b2c4a' }) + text(297, 175, '4°C', { size: 14, fill: '#6fe0ff' }))
    o.push(rect(278, 235, 40, 38, { r: 6, fill: '#0c1114' }) + rect(290, 215, 16, 20, { r: 3, fill: '#8ad7ff', op: 0.7 }))
    o.push(rect(240, 504, 34, 14, { r: 3, fill: '#3f4a50' }) + rect(526, 504, 34, 14, { r: 3, fill: '#3f4a50' }))
    o.push(sheen(226, 76, 56, 420, 16, 0.4))
  } else {
    // chest freezer
    o.push(shadow(420, 512, 290, 16))
    o.push(poly([[620, 330], [690, 290], [690, 462], [620, 500]], { fill: '#c5cfd5' }))
    o.push(poly([[620, 330], [690, 290], [690, 462], [620, 500]], { fill: 'url(#gShadeR)' }))
    o.push(rect(150, 330, 470, 170, { r: 8, fill: 'url(#gWhiteV)' }))
    o.push(poly([[150, 330], [620, 330], [690, 290], [220, 290]], { fill: '#f6f9fa', stroke: '#b9c4ca', sw: 2 }))
    o.push(poly([[190, 322], [580, 322], [635, 297], [245, 297]], { fill: '#e2e9ec' }))
    o.push(rect(335, 308, 120, 9, { r: 4, fill: '#7f8c93' }))
    o.push(rect(150, 340, 470, 8, { fill: '#2ea3d8', op: 0.9 }))
    o.push(rect(170, 366, 80, 38, { r: 6, fill: 'url(#gDarkV)' }) + text(210, 392, '-18°C', { size: 15, fill: '#6fe0ff' }))
    o.push(circ(560, 388, 12, { fill: 'url(#gSteel)' }) + circ(560, 388, 4, { fill: '#59656c' }))
    o.push(circ(200, 506, 14, { fill: '#2a3238' }) + circ(570, 506, 14, { fill: '#2a3238' }))
    o.push(sheen(158, 350, 460, 40, 8, 0.28))
  }
  return o.join('')
}

/* ---------- TV ---------- */
export function tv({ w = 580, cx = 400, y = 120, ui = true } = {}) {
  const h = (w * 9) / 16
  const x0 = cx - w / 2
  const o = [shadow(cx, y + h + 96, w * 0.55, 12)]
  // stand
  o.push(poly([[cx - 36, y + h - 4], [cx + 36, y + h - 4], [cx + 48, y + h + 44], [cx - 48, y + h + 44]], { fill: 'url(#gDarkV)' }))
  o.push(rect(cx - 150, y + h + 44, 300, 14, { r: 7, fill: 'url(#gDark)' }))
  o.push(rect(cx - 150, y + h + 44, 300, 4, { r: 2, fill: '#fff', op: 0.15 }))
  // bezel & screen
  o.push(rect(x0, y, w, h, { r: 8, fill: 'url(#gDarkV)' }))
  const sx = x0 + 7
  const sy = y + 7
  const sw = w - 14
  const sh = h - 14
  o.push(rect(sx, sy, sw, sh, { r: 3, fill: 'url(#gSun)' }))
  o.push(circ(sx + sw * 0.66, sy + sh * 0.5, sh * 0.17, { fill: '#ffe9a8', op: 0.95 }))
  o.push(poly([[sx, sy + sh], [sx, sy + sh * 0.7], [sx + sw * 0.18, sy + sh * 0.5], [sx + sw * 0.34, sy + sh * 0.68], [sx + sw * 0.5, sy + sh * 0.56], [sx + sw * 0.7, sy + sh * 0.76], [sx + sw * 0.86, sy + sh * 0.62], [sx + sw, sy + sh * 0.74], [sx + sw, sy + sh]], { fill: '#1b1a4b', op: 0.92 }))
  o.push(poly([[sx, sy + sh], [sx, sy + sh * 0.85], [sx + sw * 0.25, sy + sh * 0.78], [sx + sw * 0.55, sy + sh * 0.88], [sx + sw * 0.8, sy + sh * 0.82], [sx + sw, sy + sh * 0.9], [sx + sw, sy + sh]], { fill: '#0d0b2c' }))
  if (ui) {
    const ty = sy + sh - 44
    for (let i = 0; i < 5; i++) o.push(rect(sx + 24 + i * 56, ty, 46, 28, { r: 5, fill: ['#e5173f', '#1ea5ff', '#26c281', '#f5a623', '#8e5bff'][i], op: 0.9 }))
  }
  o.push(poly([[sx, sy], [sx + sw * 0.55, sy], [sx + sw * 0.28, sy + sh], [sx, sy + sh]], { fill: '#fff', op: 0.07 }))
  o.push(circ(cx, y + h - 3.5, 2, { fill: '#6b7880' }))
  return o.join('')
}

/* ---------- SOUND ---------- */
export function btSpeaker() {
  const o = [shadow(400, 470, 260, 14)]
  o.push(path('M200 280 Q200 250 235 248 L565 248 Q600 250 600 280 L600 420 Q600 450 565 452 L235 452 Q200 450 200 420 Z', { fill: 'url(#gDark)' }))
  o.push(rect(240, 272, 320, 160, { r: 26, fill: 'url(#pMesh)' }))
  o.push(rect(240, 272, 320, 160, { r: 26, fill: 'url(#gShadeL)' }))
  o.push(rect(200, 330, 44, 40, { r: 10, fill: '#e5173f' }) + rect(556, 330, 44, 40, { r: 10, fill: '#e5173f' }))
  o.push(rect(350, 440, 100, 6, { r: 3, fill: '#fff', op: 0.5 }))
  for (let i = 0; i < 4; i++) o.push(circ(320 + i * 54, 258, 7, { fill: i === 1 ? '#3fe0ff' : '#c8d0d4' }))
  o.push(path('M220 252 C210 190 270 175 300 215', { stroke: '#222c31', sw: 9, cap: 'round' }))
  o.push(sheen(214, 250, 372, 36, 20, 0.35))
  o.push(text(400, 366, 'BASS', { size: 34, fill: '#fff', ls: 8, weight: 800 }).replace('fill="#fff"', 'fill="#ffffff" opacity="0.7"'))
  return o.join('')
}

export function soundbar() {
  const o = [shadow(400, 530, 330, 14)]
  o.push(rect(90, 215, 620, 78, { r: 20, fill: 'url(#gDark)' }))
  o.push(rect(104, 225, 592, 58, { r: 12, fill: 'url(#pMesh)' }))
  o.push(rect(104, 225, 592, 58, { r: 12, fill: 'url(#gShadeL)' }))
  o.push(circ(382, 286, 3, { fill: '#3fe0ff' }) + circ(400, 286, 3, { fill: '#3fe0ff' }) + circ(418, 286, 3, { fill: '#ffffff', op: 0.5 }))
  o.push(sheen(96, 218, 608, 22, 16, 0.3))
  // subwoofer
  o.push(rect(545, 340, 150, 176, { r: 14, fill: 'url(#gDark)' }))
  o.push(poly([[695, 340], [725, 326], [725, 496], [695, 516]], { fill: '#0e1417' }))
  o.push(circ(620, 440, 58, { fill: '#10171a' }) + circ(620, 440, 50, { fill: 'url(#gCone)' }) + circ(620, 440, 16, { fill: '#2a3338' }))
  o.push(rect(585, 360, 70, 8, { r: 4, fill: '#5d6a71' }))
  o.push(sheen(552, 346, 136, 30, 10, 0.25))
  // remote
  o.push(g([
    rect(-20, -80, 40, 160, { r: 14, fill: 'url(#gDarkV)' }),
    circ(0, -52, 7, { fill: '#e5173f' }),
    circ(0, -20, 14, { fill: '#2a343a', stroke: '#566269', sw: 2 }),
    circ(-9, 30, 5, { fill: '#8d999f' }), circ(9, 30, 5, { fill: '#8d999f' }), circ(-9, 50, 5, { fill: '#8d999f' }), circ(9, 50, 5, { fill: '#8d999f' }),
  ], 'translate(190 430) rotate(-14)'))
  return o.join('')
}

export function homeTheatre() {
  const o = [shadow(400, 520, 360, 16)]
  const tower = (x) => {
    const t = [rect(x, 110, 120, 400, { r: 12, fill: 'url(#gDark)' }), rect(x + 10, 120, 100, 380, { r: 8, fill: 'url(#gShadeL)' })]
    ;[[190, 40], [300, 46], [410, 34]].forEach(([cy, r]) => {
      t.push(circ(x + 60, cy, r + 8, { fill: '#0c1113' }), circ(x + 60, cy, r, { fill: 'url(#gCone)' }), circ(x + 60, cy, r * 0.32, { fill: '#2a3338' }))
    })
    t.push(sheen(x + 4, 114, 30, 388, 10, 0.25), rect(x - 6, 506, 132, 12, { r: 5, fill: '#242d32' }))
    return t.join('')
  }
  o.push(tower(100), tower(580))
  // receiver
  o.push(rect(250, 390, 300, 100, { r: 10, fill: 'url(#gDark)' }))
  o.push(rect(266, 404, 150, 40, { r: 5, fill: '#07151c' }) + text(341, 432, 'HDMI  5.1', { size: 18, fill: '#6fe0ff', ls: 2, weight: 700 }))
  o.push(circ(470, 424, 20, { fill: 'url(#gSteel)', stroke: '#59656c', sw: 2 }) + circ(470, 424, 5, { fill: '#59656c' }))
  o.push(rect(266, 458, 268, 6, { r: 3, fill: '#fff', op: 0.12 }))
  o.push(sheen(256, 394, 288, 24, 8, 0.25))
  // centre speaker
  o.push(rect(280, 316, 240, 62, { r: 10, fill: 'url(#gDark)' }) + rect(292, 326, 216, 42, { r: 6, fill: 'url(#pMesh)' }))
  o.push(sheen(284, 318, 232, 18, 8, 0.28))
  return o.join('')
}
