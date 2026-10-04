// Generates the sample product / category / hero artwork into public/.
// Run: npm run generate:images
// These are original vector illustrations used as SAMPLE images only.
// In production, upload real product photos from Admin > Products.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frame, defs, g, rect, ell } from './art/shapes.mjs'
import * as A from './art/drawers1.mjs'
import * as B from './art/drawers2.mjs'
import { CATEGORIES, PRODUCTS, variantSku } from '../src/data/catalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'sample-products')
mkdirSync(outDir, { recursive: true })
mkdirSync(join(root, 'public', 'brand'), { recursive: true })

// drawer registry: name -> [function, zoom focus [x, y, scale]]
const R = {
  tank: [A.tank, [400, 215, 2.0]],
  fittings: [A.fittings, [330, 340, 1.8]],
  fridge: [A.fridge, [400, 210, 1.9]],
  tv: [A.tv, [400, 250, 1.9]],
  btSpeaker: [A.btSpeaker, [400, 340, 1.7]],
  soundbar: [A.soundbar, [390, 255, 2.2]],
  homeTheatre: [A.homeTheatre, [400, 330, 1.6]],
  laptop: [B.laptop, [400, 290, 1.7]],
  desktop: [B.desktop, [330, 300, 1.6]],
  monitor: [B.monitor, [400, 240, 1.8]],
  bulletCam: [B.bulletCam, [330, 290, 1.9]],
  cctvKit: [B.cctvKit, [400, 330, 1.5]],
  nvr: [B.nvr, [400, 360, 1.8]],
  solarPanel: [B.solarPanel, [420, 260, 1.9]],
  solarBattery: [B.solarBattery, [380, 330, 1.8]],
  inverter: [B.inverter, [400, 230, 1.9]],
  solarAcc: [B.solarAccessories, [400, 260, 1.6]],
  waterPump: [B.waterPump, [420, 340, 1.6]],
  pressurePump: [B.pressurePump, [350, 290, 1.6]],
  submersible: [B.submersible, [400, 320, 1.7]],
  router: [B.router, [400, 400, 1.9]],
  switch: [B.switchUnit, [400, 310, 2.0]],
  accessPoint: [B.accessPoint, [400, 370, 1.8]],
  generator: [B.generator, [400, 360, 1.6]],
  stabilizer: [B.stabilizer, [400, 300, 1.8]],
  microwave: [B.microwave, [400, 320, 1.7]],
  washer: [B.washingMachine, [400, 300, 1.8]],
  powerBank: [B.powerBank, [380, 320, 1.6]],
  earbuds: [B.earbuds, [400, 300, 1.7]],
  extension: [B.extension, [400, 330, 1.8]],
  wallMount: [B.wallMount, [400, 300, 1.5]],
}

const write = (file, svg) => writeFileSync(join(outDir, file), svg)

// ---- products ----
const catBg = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.bg]))
const skus = new Set()
for (const p of PRODUCTS) {
  const [name, args] = p.art
  const [fn, focus] = R[name]
  const inner = fn(args)
  write(`${p.slug}-1.svg`, frame(inner, { bg: catBg[p.category] }))
  write(`${p.slug}-2.svg`, frame(inner, { zoom: focus, dark: true }))
  for (const v of p.variants) {
    const s = variantSku(p, v)
    if (skus.has(s)) throw new Error('Duplicate SKU ' + s)
    skus.add(s)
  }
}

// ---- category images ----
const heroDraw = {
  tankHero: () => A.tank({ color: 'black', w: 300, h: 330 }),
  tvHero: () => A.tv({ w: 600 }),
  soundbarHero: () => A.soundbar(),
  fridgeDoubleHero: () => A.fridge({ kind: 'double', finish: 'steel' }),
  washerHero: () => B.washingMachine(),
  laptopHero: () => B.laptop(),
  camHero: () => B.bulletCam({ s: 1 }),
  routerHero: () => B.router(),
  solarHero: () => B.solarPanel(),
  batteryHero: () => B.solarBattery(),
  pumpHero: () => B.waterPump({ color: 'blue' }),
  generatorHero: () => B.generator(),
  powerbankHero: () => B.powerBank(),
  extensionHero: () => B.extension(),
}
for (const c of CATEGORIES) write(`category-${c.slug}.svg`, frame(heroDraw[c.art](), { bg: c.bg }))

// ---- hero collage (transparent) ----
const place = (inner, s, hx, hy) => g(inner, `translate(${hx - 400 * s} ${hy - 520 * s}) scale(${s})`)
const heroParts = [
  ell(450, 560, 420, 40, { fill: '#fff', op: 0.08 }),
  place(A.fridge({ kind: 'double', finish: 'steel' }), 0.93, 300, 560),
  // TV on a console
  rect(520, 520, 300, 38, { r: 6, fill: '#7a5a3a' }),
  rect(520, 520, 300, 8, { r: 4, fill: '#a07c52' }),
  place(A.tv({ w: 520 }), 0.62, 672, 522),
  place(A.tank({ color: 'black', w: 280, h: 330 }), 0.84, 128, 575),
  place(B.solarPanel(), 0.62, 760, 580),
  place(B.laptop(), 0.5, 470, 590),
].join('')
writeFileSync(join(root, 'public', 'brand', 'hero.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 640" role="img" aria-label="Water tank, refrigerator, TV, solar panel and laptop">${defs}${heroParts}</svg>`)

// ---- logo + favicon ----
const markPaths = `<rect width="48" height="48" rx="13" fill="#F4A300"/>
<path fill="#10222B" fill-rule="evenodd" d="M15 11H27C33 11 36 14.5 36 19C36 22 34.5 24 32 25C35.5 26 38 28.5 38 32.5C38 38 34 41 27.5 41H15Z M21 16V22H26.5C29 22 30 20.8 30 19C30 17.2 28.8 16 26.5 16Z M21 27V36H27C30 36 32 34.6 32 31.5C32 28.6 30 27 27 27Z"/>
<circle cx="40" cy="8" r="3" fill="#10222B"/>`
writeFileSync(join(root, 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${markPaths}</svg>`)
writeFileSync(join(root, 'public', 'brand', 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 48" role="img" aria-label="BeiHub"><g>${markPaths}</g><text x="58" y="34" font-family="Bricolage Grotesque, Arial, sans-serif" font-weight="800" font-size="30" fill="#10222B">Bei<tspan fill="#0A6A74">Hub</tspan></text></svg>`)

console.log('Generated artwork for', PRODUCTS.length, 'products and', CATEGORIES.length, 'categories')
