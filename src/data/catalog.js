// Sample catalogue for BeiHub.
// This single file feeds: (1) the SQL seed in BeiHub_database.sql, (2) the demo mode
// that runs without Supabase, and (3) the sample artwork generator.
// All prices are illustrative sample prices in Kenya Shillings - edit them in Admin.

export const CATEGORIES = [
  { slug: 'water-tanks', name: 'Water Tanks', description: 'Vertical and storage tanks from 100 to 24,000 litres, plus fittings.', art: 'tankHero', bg: ['#D9ECF3', '#B8D8E6'] },
  { slug: 'tvs-entertainment', name: 'TVs & Entertainment', description: 'Smart LED and 4K televisions in popular screen sizes.', art: 'tvHero', bg: ['#E3E2F5', '#C9C7EA'] },
  { slug: 'speakers-sound', name: 'Speakers & Sound Systems', description: 'Bluetooth speakers, soundbars and home theatre systems.', art: 'soundbarHero', bg: ['#F4E3E6', '#EBC8CF'] },
  { slug: 'refrigerators-freezers', name: 'Refrigerators & Freezers', description: 'Single door, double door, side-by-side fridges and chest freezers.', art: 'fridgeDoubleHero', bg: ['#E1F0F1', '#C2DEE0'] },
  { slug: 'home-appliances', name: 'Home Appliances', description: 'Microwaves, washing machines and everyday home appliances.', art: 'washerHero', bg: ['#EFEAF6', '#DDD3EE'] },
  { slug: 'computers-laptops', name: 'Computers & Laptops', description: 'Laptops, desktop computers and monitors for home and office.', art: 'laptopHero', bg: ['#E4ECF6', '#C8D8EE'] },
  { slug: 'cctv-security', name: 'CCTV & Security', description: 'CCTV cameras, complete kits and DVR / NVR recorders.', art: 'camHero', bg: ['#E7ECEE', '#CBD5D9'] },
  { slug: 'networking-wifi', name: 'Networking & Wi-Fi', description: 'Wi-Fi routers, network switches and access points.', art: 'routerHero', bg: ['#E0F3F2', '#BFE3E1'] },
  { slug: 'solar-equipment', name: 'Solar Equipment', description: 'Solar panels, charge controllers, cables and accessories.', art: 'solarHero', bg: ['#FBF0D4', '#F4DDA0'] },
  { slug: 'inverters-batteries', name: 'Inverters & Batteries', description: 'Hybrid inverters and deep-cycle solar batteries.', art: 'batteryHero', bg: ['#DEF1E5', '#BEE0CB'] },
  { slug: 'water-pumps', name: 'Water Pumps', description: 'Surface, pressure booster and borehole submersible pumps.', art: 'pumpHero', bg: ['#DCEAF7', '#BBD4EE'] },
  { slug: 'power-equipment', name: 'Power Equipment', description: 'Generators and voltage regulators for reliable power.', art: 'generatorHero', bg: ['#F8E4DE', '#F0C7BC'] },
  { slug: 'electronics', name: 'Electronics', description: 'Power banks, earbuds and everyday electronics.', art: 'powerbankHero', bg: ['#E6E9F3', '#CDD3E8'] },
  { slug: 'other-accessories', name: 'Other Accessories', description: 'Extension sockets, wall mounts and handy accessories.', art: 'extensionHero', bg: ['#ECEFE3', '#D8DFC4'] },
]

export const SETTINGS = {
  business_name: 'BeiHub',
  tagline: 'Quality Products. Better Prices. Delivered.',
  phone: '+254 700 000 000',
  whatsapp: '254700000000',
  email: 'hello@beihub.co.ke',
  address: 'Update your shop address in Admin > Settings',
  county: 'Nairobi',
  business_hours: 'Mon - Sat: 8:00am - 6:00pm',
  about: 'BeiHub is a Kenyan catalogue and order desk for electronics, appliances, water tanks and solar equipment. Browse prices, pick what you need and send your order list. We confirm every order personally.',
  payment_instructions: 'After you submit your order we will call or WhatsApp you to confirm availability and delivery, and send our M-Pesa / bank details for the 50% deposit. The balance is paid when your order is delivered.',
  deposit_percent: 50,
  delivery_mode: 'county',
  fixed_delivery_fee: 1500,
  default_delivery_fee: 2500,
  free_delivery_threshold: null,
  facebook_url: '',
  instagram_url: '',
}

export const DELIVERY_LOCATIONS = [
  { county: 'Nairobi', town: null, fee: 1000, eta: '1-2 days' },
  { county: 'Nairobi', town: 'CBD', fee: 600, eta: 'Same or next day' },
  { county: 'Kiambu', town: null, fee: 1500, eta: '1-2 days' },
  { county: 'Machakos', town: null, fee: 1800, eta: '2-3 days' },
  { county: 'Kajiado', town: null, fee: 1800, eta: '2-3 days' },
  { county: 'Nakuru', town: null, fee: 2500, eta: '2-3 days' },
  { county: 'Kisumu', town: null, fee: 3200, eta: '3-4 days' },
  { county: 'Kakamega', town: null, fee: 3500, eta: '3-4 days' },
  { county: 'Mombasa', town: null, fee: 4500, eta: '3-5 days' },
  { county: 'Uasin Gishu', town: null, fee: 3200, eta: '3-4 days' },
]

const V = (label, price, prev = null, stock = 8, avail = 'in_stock') => ({ label, price, prev, stock, avail })

export const PRODUCTS = [
  /* ---------------- WATER TANKS ---------------- */
  {
    slug: 'water-tank', sku: 'TNK', category: 'water-tanks', name: 'Water Tank', brand: null,
    short: 'Vertical food-grade polyethylene water tank with UV protection.',
    description: 'A durable vertical water tank moulded from food-grade polyethylene with UV stabilisers, so water stays clean and the tank stands up to the Kenyan sun. Suitable for homes, farms, schools and commercial sites. Every tank has a screw lid and a 1-inch outlet boss for fittings.',
    specs: { Material: 'Food-grade polyethylene (LLDPE)', 'UV protection': 'Yes', Outlet: '1 inch', Lid: 'Screw-on, lockable', Warranty: '5 years on the tank body' },
    variantKey: 'Capacity', featured: true, popular: true, isNew: false, art: ['tank', { color: 'black' }],
    variants: [
      V('100 Litres', 2800, null, 20), V('200 Litres', 4200, null, 18), V('300 Litres', 5600, null, 14), V('500 Litres', 8500, 9800, 25),
      V('1,000 Litres', 15500, 17500, 22), V('1,500 Litres', 21500, null, 10), V('2,000 Litres', 28000, 32000, 15), V('2,500 Litres', 34500, null, 9),
      V('3,000 Litres', 41000, null, 12), V('4,000 Litres', 54000, null, 6), V('5,000 Litres', 66000, 72000, 8), V('6,000 Litres', 79000, null, 4),
      V('8,000 Litres', 104000, null, 3), V('10,000 Litres', 128000, null, 5), V('12,000 Litres', 152000, null, 2), V('15,000 Litres', 187000, null, 2),
      V('20,000 Litres', 245000, null, 0, 'on_order'), V('24,000 Litres', 290000, null, 0, 'on_order'),
    ],
  },
  {
    slug: 'triple-layer-water-tank', sku: 'TNK-3L', category: 'water-tanks', name: 'Triple-Layer Water Tank', brand: null,
    short: 'Three-layer tank that blocks light to keep water fresher for longer.',
    description: 'The black inner layer blocks sunlight to reduce algae growth, the middle layer adds strength and the outer layer resists UV. A good choice for drinking-water storage and for sites with strong sun.',
    specs: { Material: 'Three-layer polyethylene', 'Light blocking': 'Black inner layer', 'UV protection': 'Yes', Outlet: '1 inch' },
    variantKey: 'Capacity', featured: false, popular: false, isNew: true, art: ['tank', { color: 'blue', w: 330, h: 320, ribs: 3 }],
    variants: [V('500 Litres', 10500, null, 12), V('1,000 Litres', 18500, 20500, 10), V('2,000 Litres', 33500, null, 8), V('3,000 Litres', 48500, null, 5), V('5,000 Litres', 76500, null, 4), V('10,000 Litres', 146000, null, 2)],
  },
  {
    slug: 'tank-fittings-kit', sku: 'TNK-FIT', category: 'water-tanks', name: 'Tank Fittings Kit', brand: null,
    short: 'Ball valve, float valve, unions and sockets to plumb your tank.',
    description: 'Everything needed to connect a water tank: brass ball valve, float valve, tank connector, socket and elbow. Choose the pipe size that matches your plumbing.',
    specs: { Contents: 'Ball valve, float valve, tank connector, socket, elbow', Material: 'Brass and PVC' },
    variantKey: 'Pipe size', featured: false, popular: false, isNew: false, art: ['fittings', {}],
    variants: [V('1/2 inch', 1800, null, 30), V('3/4 inch', 2600, null, 24), V('1 inch', 3800, null, 15)],
  },

  /* ---------------- TVs ---------------- */
  {
    slug: 'samsung-4k-uhd-smart-tv', sku: 'TV-SAM', category: 'tvs-entertainment', name: 'Samsung 4K UHD Smart TV', brand: 'Samsung',
    short: '4K Ultra HD smart television with built-in streaming apps.',
    description: 'Crisp 4K picture, built-in Wi-Fi and popular streaming apps ready to use. Includes remote control and wall-mount compatible back panel. Choose the screen size that suits your room.',
    specs: { Resolution: '3840 x 2160 (4K UHD)', 'Smart TV': 'Yes, with streaming apps', Connectivity: 'Wi-Fi, Bluetooth, 3 x HDMI, 1 x USB', Warranty: '1 year' },
    variantKey: 'Screen size', featured: true, popular: true, isNew: false, art: ['tv', {}],
    variants: [V('43 Inch', 46500, 52000, 10), V('50 Inch', 62000, null, 8), V('55 Inch', 74500, 82000, 7), V('65 Inch', 109000, null, 3)],
  },
  {
    slug: 'lg-uhd-smart-tv', sku: 'TV-LG', category: 'tvs-entertainment', name: 'LG UHD Smart TV', brand: 'LG',
    short: 'UHD smart TV with webOS and voice-ready remote.',
    description: 'UHD resolution, a fast processor and an easy-to-use smart interface. Slim bezel design for a clean look on a stand or on the wall.',
    specs: { Resolution: '3840 x 2160 (UHD)', 'Smart TV': 'Yes', Connectivity: 'Wi-Fi, Bluetooth, 3 x HDMI, 2 x USB', Warranty: '1 year' },
    variantKey: 'Screen size', featured: false, popular: false, isNew: true, art: ['tv', { w: 560 }],
    variants: [V('50 Inch', 63500, null, 6), V('55 Inch', 77000, null, 5), V('65 Inch', 112000, 119000, 2)],
  },
  {
    slug: 'hisense-full-hd-smart-tv', sku: 'TV-HIS', category: 'tvs-entertainment', name: 'Hisense Full HD Smart TV', brand: 'Hisense',
    short: 'Affordable Full HD smart TV for the bedroom or living room.',
    description: 'A budget-friendly smart TV with Full HD picture, built-in Wi-Fi and streaming apps.',
    specs: { Resolution: '1920 x 1080 (Full HD)', 'Smart TV': 'Yes', Connectivity: 'Wi-Fi, 2 x HDMI, 1 x USB', Warranty: '1 year' },
    variantKey: 'Screen size', featured: false, popular: true, isNew: false, art: ['tv', { w: 520 }],
    variants: [V('32 Inch', 19500, 22500, 14), V('43 Inch', 38500, null, 9)],
  },

  /* ---------------- SOUND ---------------- */
  {
    slug: 'portable-bluetooth-speaker', sku: 'SPK-BT', category: 'speakers-sound', name: 'Portable Bluetooth Speaker', brand: 'JBL',
    short: 'Rechargeable wireless speaker with deep bass.',
    description: 'Pair with your phone over Bluetooth and enjoy loud, clear sound at home, in the shop or outdoors. Rechargeable battery, USB charging and a carry strap.',
    specs: { Connectivity: 'Bluetooth 5.0, AUX, USB', Battery: 'Rechargeable lithium', 'Water resistance': 'Splash resistant' },
    variantKey: 'Power', featured: false, popular: true, isNew: false, art: ['btSpeaker', {}],
    variants: [V('Compact 20W', 5800, 6900, 16), V('Medium 40W', 9500, null, 12), V('Party 100W', 24500, null, 4)],
  },
  {
    slug: 'soundbar-with-subwoofer', sku: 'SPK-SB', category: 'speakers-sound', name: 'Soundbar with Subwoofer', brand: 'LG',
    short: 'Wireless subwoofer and soundbar to upgrade your TV sound.',
    description: 'Connects to your TV by HDMI ARC, optical or Bluetooth. A wireless subwoofer adds punchy bass for movies, football and music.',
    specs: { Connectivity: 'HDMI ARC, Optical, Bluetooth, USB', Subwoofer: 'Wireless', Remote: 'Included' },
    variantKey: 'Configuration', featured: false, popular: true, isNew: false, art: ['soundbar', {}],
    variants: [V('2.1 Channel 120W', 14900, 17500, 9), V('2.1 Channel 300W', 26500, null, 6), V('5.1 Channel 500W', 42000, null, 3)],
  },
  {
    slug: 'home-theatre-system', sku: 'SPK-HT', category: 'speakers-sound', name: 'Home Theatre System', brand: 'Sony',
    short: 'Surround sound system with tower speakers and AV receiver.',
    description: 'Fill your living room with powerful surround sound. Includes tower speakers, centre speaker, subwoofer and receiver with HDMI and Bluetooth.',
    specs: { Connectivity: 'HDMI, Optical, Bluetooth, USB', Includes: 'Receiver, tower speakers, centre speaker, subwoofer' },
    variantKey: 'Channels', featured: false, popular: false, isNew: true, art: ['homeTheatre', {}],
    variants: [V('5.1 Channel', 29500, null, 5), V('7.1 Channel', 54000, 59000, 2)],
  },

  /* ---------------- REFRIGERATORS ---------------- */
  {
    slug: 'single-door-refrigerator', sku: 'FRG-1D', category: 'refrigerators-freezers', name: 'Single Door Refrigerator', brand: 'Ramtons',
    short: 'Compact single door fridge with a small freezer compartment.',
    description: 'A practical choice for bedsitters, offices and small families. Adjustable shelves, vegetable crisper and a built-in freezer compartment.',
    specs: { Type: 'Direct cool, single door', 'Energy use': 'Low consumption', Warranty: '1 year' },
    variantKey: 'Capacity', featured: false, popular: true, isNew: false, art: ['fridge', { kind: 'single' }],
    variants: [V('100 Litres', 21500, null, 10), V('150 Litres', 27500, 29900, 8), V('200 Litres', 33000, null, 6)],
  },
  {
    slug: 'double-door-refrigerator', sku: 'FRG-2D', category: 'refrigerators-freezers', name: 'Double Door Refrigerator', brand: 'Hisense',
    short: 'Top-freezer double door fridge with a spacious fresh-food section.',
    description: 'Frost-free cooling, separate freezer and fridge doors and a steel-look finish. Plenty of space for a family.',
    specs: { Type: 'Frost free, top freezer', Finish: 'Stainless-steel look', Warranty: '2 years' },
    variantKey: 'Capacity', featured: true, popular: true, isNew: false, art: ['fridge', { kind: 'double', finish: 'steel' }],
    variants: [V('250 Litres', 52000, null, 7), V('300 Litres', 61500, 67000, 6), V('350 Litres', 72000, null, 4)],
  },
  {
    slug: 'side-by-side-refrigerator', sku: 'FRG-SBS', category: 'refrigerators-freezers', name: 'Side-by-Side Refrigerator', brand: 'LG',
    short: 'Large side-by-side fridge-freezer with water dispenser.',
    description: 'A large-capacity fridge-freezer with external water dispenser and digital temperature control. Built for big households and hospitality.',
    specs: { Type: 'Frost free, side-by-side', Dispenser: 'Water', Warranty: '2 years' },
    variantKey: 'Capacity', featured: false, popular: false, isNew: true, art: ['fridge', { kind: 'sbs', finish: 'steel' }],
    variants: [V('500 Litres', 129000, null, 3), V('600 Litres', 159000, 175000, 2)],
  },
  {
    slug: 'chest-freezer', sku: 'FRZ-CH', category: 'refrigerators-freezers', name: 'Chest Freezer', brand: 'Von',
    short: 'Deep chest freezer for bulk storage of meat, fish and drinks.',
    description: 'Strong cooling for shops, butcheries and homes. Lockable lid, removable basket and fast-freeze switch. Great value for bulk storage.',
    specs: { Type: 'Chest, manual defrost', Lid: 'Lockable', Warranty: '1 year' },
    variantKey: 'Capacity', featured: false, popular: true, isNew: false, art: ['fridge', { kind: 'chest' }],
    variants: [V('200 Litres', 36500, null, 8), V('300 Litres', 46000, 49500, 6), V('400 Litres', 58500, null, 4), V('500 Litres', 69900, null, 3)],
  },

  /* ---------------- HOME APPLIANCES ---------------- */
  {
    slug: 'microwave-oven', sku: 'APP-MW', category: 'home-appliances', name: 'Microwave Oven', brand: 'Ramtons',
    short: 'Digital microwave with multiple power levels and defrost.',
    description: 'Heat, cook and defrost quickly. Digital controls, multiple power levels and a easy-clean interior.',
    specs: { Control: 'Digital', Functions: 'Reheat, cook, defrost', Warranty: '1 year' },
    variantKey: 'Capacity', featured: false, popular: false, isNew: false, art: ['microwave', {}],
    variants: [V('20 Litres', 9500, 10900, 12), V('25 Litres', 12500, null, 9), V('30 Litres', 16800, null, 5)],
  },
  {
    slug: 'front-load-washing-machine', sku: 'APP-WM', category: 'home-appliances', name: 'Front-Load Washing Machine', brand: 'Hisense',
    short: 'Energy-efficient front loader with multiple wash programmes.',
    description: 'Inverter motor, quick wash and several programmes for different fabrics. Choose the drum capacity for your household.',
    specs: { Type: 'Front load, fully automatic', Motor: 'Inverter', Warranty: '2 years' },
    variantKey: 'Capacity', featured: false, popular: false, isNew: false, art: ['washer', {}],
    variants: [V('7 kg', 49000, null, 5), V('9 kg', 62500, 67000, 4), V('10.5 kg', 78000, null, 2)],
  },

  /* ---------------- COMPUTERS ---------------- */
  {
    slug: 'business-laptop-15', sku: 'PC-LAP', category: 'computers-laptops', name: 'Business Laptop 15.6 Inch', brand: 'HP',
    short: 'Reliable 15.6 inch laptop for work, school and business.',
    description: 'Full HD display, fast SSD storage, backlit-ready keyboard and long battery life. Windows 11 ready. Choose the processor, memory and storage that fit your budget.',
    specs: { Display: '15.6 inch Full HD', 'Operating system': 'Windows 11', Warranty: '1 year' },
    variantKey: 'Configuration', featured: true, popular: true, isNew: false, art: ['laptop', {}],
    variants: [V('Core i3 / 8GB / 256GB SSD', 52000, null, 8), V('Core i5 / 8GB / 512GB SSD', 68500, 74000, 6), V('Core i7 / 16GB / 512GB SSD', 94000, null, 3)],
  },
  {
    slug: 'desktop-computer-set', sku: 'PC-DT', category: 'computers-laptops', name: 'Desktop Computer Set', brand: 'Dell',
    short: 'Tower, monitor, keyboard and mouse - ready to plug in.',
    description: 'A complete desktop set for the office, cyber or home. Includes tower, LED monitor, keyboard and mouse.',
    specs: { Includes: 'Tower, monitor, keyboard, mouse', 'Operating system': 'Windows 11', Warranty: '1 year' },
    variantKey: 'Configuration', featured: false, popular: false, isNew: false, art: ['desktop', {}],
    variants: [V('Core i3 / 4GB / 500GB HDD', 36500, null, 6), V('Core i5 / 8GB / 256GB SSD', 52000, null, 4)],
  },
  {
    slug: 'led-monitor', sku: 'PC-MON', category: 'computers-laptops', name: 'LED Monitor', brand: 'Lenovo',
    short: 'Slim-bezel LED monitor with HDMI input.',
    description: 'A sharp, flicker-free display for work, CCTV viewing and entertainment. HDMI and VGA inputs, wall-mountable.',
    specs: { Panel: 'IPS LED', Inputs: 'HDMI, VGA', 'Refresh rate': '75Hz', Warranty: '1 year' },
    variantKey: 'Screen size', featured: false, popular: false, isNew: false, art: ['monitor', {}],
    variants: [V('22 Inch Full HD', 13500, null, 12), V('24 Inch Full HD', 16500, 18500, 10), V('27 Inch QHD', 28500, null, 4)],
  },

  /* ---------------- CCTV ---------------- */
  {
    slug: 'outdoor-cctv-bullet-camera', sku: 'CCTV-CAM', category: 'cctv-security', name: 'Outdoor CCTV Bullet Camera', brand: 'Hikvision',
    short: 'Weatherproof bullet camera with night vision.',
    description: 'Metal housing, IP66 weather protection and infrared night vision up to 30 metres. Works with DVR/NVR recorders.',
    specs: { 'Weather rating': 'IP66', 'Night vision': 'Up to 30m', Housing: 'Metal' },
    variantKey: 'Resolution', featured: false, popular: true, isNew: false, art: ['bulletCam', {}],
    variants: [V('2MP (1080p)', 3800, null, 25), V('5MP', 6200, 6900, 14)],
  },
  {
    slug: 'cctv-camera-kit', sku: 'CCTV-KIT', category: 'cctv-security', name: 'CCTV Camera Kit', brand: 'Hikvision',
    short: 'Complete kit: cameras, recorder, hard drive, cables and power supply.',
    description: 'A complete security kit ready for installation. Includes cameras, DVR, hard drive, power supply and connectors. Installation can be arranged on request.',
    specs: { Includes: 'Cameras, DVR, 1TB HDD, cables, power supply', 'Remote viewing': 'Phone app' },
    variantKey: 'Kit size', featured: true, popular: true, isNew: false, art: ['cctvKit', {}],
    variants: [V('4 Camera Kit', 34500, 39000, 7), V('8 Camera Kit', 62000, null, 4)],
  },
  {
    slug: 'dvr-nvr-recorder', sku: 'CCTV-REC', category: 'cctv-security', name: 'DVR / NVR Recorder', brand: 'Hikvision',
    short: 'Digital video recorders for analogue and IP cameras.',
    description: 'Record and play back CCTV footage with phone app viewing. Supports hard drives up to 8TB (hard drive sold separately).',
    specs: { 'Remote viewing': 'Phone app', 'Hard drive': 'Not included' },
    variantKey: 'Channels', featured: false, popular: false, isNew: false, art: ['nvr', {}],
    variants: [V('4 Channel DVR', 6500, null, 10), V('8 Channel DVR', 9800, null, 8), V('16 Channel NVR', 21500, null, 3)],
  },

  /* ---------------- NETWORKING ---------------- */
  {
    slug: 'wifi-router', sku: 'NET-RTR', category: 'networking-wifi', name: 'Wi-Fi Router', brand: 'TP-Link',
    short: 'Dual-band Wi-Fi routers for home and office.',
    description: 'Fast, stable Wi-Fi for streaming and video calls. Easy setup with a phone app. The 4G LTE model takes a SIM card so you can get internet without a fixed line.',
    specs: { 'Setup': 'Phone app', Ports: 'Gigabit LAN', Warranty: '1 year' },
    variantKey: 'Model', featured: false, popular: true, isNew: true, art: ['router', {}],
    variants: [V('AC1200 Dual Band', 3900, null, 20), V('AX1800 Wi-Fi 6', 8900, 9900, 10), V('4G LTE (SIM) Router', 7500, null, 8)],
  },
  {
    slug: 'network-switch', sku: 'NET-SW', category: 'networking-wifi', name: 'Gigabit Network Switch', brand: 'TP-Link',
    short: 'Plug-and-play gigabit switches for offices and CCTV.',
    description: 'Expand your wired network with gigabit ports. No configuration needed. Metal case suitable for desk or rack mounting.',
    specs: { Speed: '10/100/1000 Mbps', Management: 'Unmanaged', Warranty: '1 year' },
    variantKey: 'Ports', featured: false, popular: false, isNew: false, art: ['switch', { ports: 16 }],
    variants: [V('8-Port', 3200, null, 15), V('16-Port', 7800, null, 9), V('24-Port', 14500, null, 5)],
  },
  {
    slug: 'wireless-access-point', sku: 'NET-AP', category: 'networking-wifi', name: 'Wireless Access Point', brand: 'Tenda',
    short: 'Ceiling-mount and outdoor access points for wide Wi-Fi coverage.',
    description: 'Extend Wi-Fi coverage in offices, hotels and schools. Powered over Ethernet (PoE) for a clean installation.',
    specs: { Power: 'PoE', Coverage: 'Wide-area' },
    variantKey: 'Type', featured: false, popular: false, isNew: false, art: ['accessPoint', {}],
    variants: [V('Ceiling Mount AC1200', 7900, null, 8), V('Outdoor 5GHz', 6800, null, 6)],
  },

  /* ---------------- SOLAR ---------------- */
  {
    slug: 'monocrystalline-solar-panel', sku: 'SOL-PNL', category: 'solar-equipment', name: 'Monocrystalline Solar Panel', brand: null,
    short: 'High-efficiency solar panels for homes, farms and businesses.',
    description: 'Monocrystalline cells for strong output even in low light. Aluminium frame and tempered glass built for Kenyan weather. Choose the wattage that matches your system design.',
    specs: { 'Cell type': 'Monocrystalline', Frame: 'Anodised aluminium', 'Performance warranty': '25 years', 'Product warranty': '10 years' },
    variantKey: 'Power', featured: true, popular: true, isNew: false, art: ['solarPanel', {}],
    variants: [V('100 Watts', 8500, null, 20), V('200 Watts', 15500, null, 16), V('330 Watts', 24500, 27000, 10), V('550 Watts', 36000, null, 6)],
  },
  {
    slug: 'solar-charge-controller', sku: 'SOL-CC', category: 'solar-equipment', name: 'Solar Charge Controller', brand: null,
    short: 'Protects your battery and improves charging efficiency.',
    description: 'LCD charge controller with overload, short-circuit and over-charge protection. MPPT models harvest more power from your panels.',
    specs: { Display: 'LCD', Protection: 'Overload, short circuit, over-charge' },
    variantKey: 'Rating', featured: false, popular: false, isNew: false, art: ['solarAcc', {}],
    variants: [V('30A PWM', 3800, null, 18), V('60A MPPT', 14500, 15900, 7)],
  },
  {
    slug: 'solar-cable-mc4-kit', sku: 'SOL-CBL', category: 'solar-equipment', name: 'Solar Cable & MC4 Connector Kit', brand: null,
    short: 'UV-resistant solar cable with MC4 connectors.',
    description: 'Twin-core solar cable with a pair of MC4 connectors fitted. Sunlight and weather resistant.',
    specs: { Cable: '4mm2 solar cable', Connectors: 'MC4 pair' },
    variantKey: 'Length', featured: false, popular: false, isNew: false, art: ['solarAcc', {}],
    variants: [V('10 Metres', 2800, null, 25), V('20 Metres', 4800, null, 16), V('50 Metres', 10500, null, 6)],
  },

  /* ---------------- INVERTERS & BATTERIES ---------------- */
  {
    slug: 'deep-cycle-solar-battery', sku: 'BAT-DC', category: 'inverters-batteries', name: 'Deep Cycle Solar Battery', brand: null,
    short: '12V deep-cycle batteries for solar, inverter and UPS systems.',
    description: 'Maintenance-free deep cycle battery made for daily charge and discharge. Pair with a solar charge controller and inverter.',
    specs: { Voltage: '12V', Type: 'Deep cycle, maintenance free', Warranty: '1 year' },
    variantKey: 'Capacity', featured: true, popular: true, isNew: false, art: ['solarBattery', {}],
    variants: [V('100Ah', 18500, null, 14), V('150Ah', 26500, 29000, 9), V('200Ah', 33500, null, 7)],
  },
  {
    slug: 'hybrid-solar-inverter', sku: 'INV-HYB', category: 'inverters-batteries', name: 'Hybrid Solar Inverter', brand: null,
    short: 'Pure sine wave hybrid inverter with built-in solar charger.',
    description: 'Runs household appliances from batteries and solar, and switches to grid power when needed. Pure sine wave output with an LCD status display.',
    specs: { Output: 'Pure sine wave', Display: 'LCD', Input: 'Solar + grid', Warranty: '2 years' },
    variantKey: 'Rating', featured: true, popular: false, isNew: true, art: ['inverter', {}],
    variants: [V('1 kVA / 12V', 14500, null, 9), V('3 kVA / 24V', 38500, 42000, 6), V('5 kVA / 48V', 78000, null, 3)],
  },

  /* ---------------- WATER PUMPS ---------------- */
  {
    slug: 'surface-water-pump', sku: 'PMP-SRF', category: 'water-pumps', name: 'Surface Water Pump', brand: null,
    short: 'Electric surface pumps for tanks, gardens and small farms.',
    description: 'Copper-wound motor with a cast-iron pump head for steady water delivery. Ideal for filling tanks and irrigation.',
    specs: { Motor: 'Copper winding', 'Pump head': 'Cast iron', Power: 'Single phase 240V' },
    variantKey: 'Power', featured: false, popular: true, isNew: false, art: ['waterPump', { color: 'blue' }],
    variants: [V('0.5 HP', 7500, null, 12), V('1 HP', 11800, 12900, 10), V('1.5 HP', 16500, null, 6)],
  },
  {
    slug: 'pressure-booster-pump', sku: 'PMP-BST', category: 'water-pumps', name: 'Pressure Booster Pump', brand: null,
    short: 'Automatic booster pump with pressure vessel and gauge.',
    description: 'Boost low water pressure throughout the house. Automatic start and stop with pressure switch and gauge.',
    specs: { Control: 'Automatic pressure switch', Gauge: 'Included', Power: 'Single phase 240V' },
    variantKey: 'Power', featured: false, popular: false, isNew: true, art: ['pressurePump', {}],
    variants: [V('0.75 HP', 14500, null, 8), V('1 HP', 18900, null, 6), V('1.5 HP', 24500, null, 4)],
  },
  {
    slug: 'borehole-submersible-pump', sku: 'PMP-SUB', category: 'water-pumps', name: 'Borehole Submersible Pump', brand: null,
    short: 'Stainless-steel submersible pumps for boreholes and wells.',
    description: 'Stainless-steel body for long life underwater. Supplied with a cable. Choose the power for your depth and flow requirements.',
    specs: { Body: 'Stainless steel', Use: 'Boreholes and deep wells' },
    variantKey: 'Power', featured: false, popular: false, isNew: false, art: ['submersible', {}],
    variants: [V('0.75 HP', 21500, null, 5), V('1 HP', 26500, null, 5), V('2 HP', 44000, 47500, 2)],
  },

  /* ---------------- POWER EQUIPMENT ---------------- */
  {
    slug: 'petrol-generator', sku: 'PWR-GEN', category: 'power-equipment', name: 'Petrol Generator', brand: null,
    short: 'Portable petrol generators with recoil start.',
    description: 'Reliable backup power for homes, shops and sites. Air-cooled engine, AVR for stable output and wheels for easy moving.',
    specs: { Fuel: 'Petrol', Start: 'Recoil (key start on larger sizes)', Output: '230V AC' },
    variantKey: 'Output', featured: false, popular: true, isNew: false, art: ['generator', {}],
    variants: [V('2.5 kVA', 38500, 42000, 6), V('5 kVA', 79000, null, 4), V('7.5 kVA', 125000, null, 2)],
  },
  {
    slug: 'automatic-voltage-regulator', sku: 'PWR-AVR', category: 'power-equipment', name: 'Automatic Voltage Regulator', brand: null,
    short: 'Protect TVs, fridges and computers from voltage spikes.',
    description: 'Stabilises mains voltage and protects your appliances. Digital voltage display and time-delay protection.',
    specs: { Display: 'Digital voltage', Protection: 'Over and under voltage' },
    variantKey: 'Rating', featured: false, popular: false, isNew: false, art: ['stabilizer', {}],
    variants: [V('1 kVA', 4500, null, 14), V('2 kVA', 7200, null, 10), V('5 kVA', 14800, null, 5)],
  },

  /* ---------------- ELECTRONICS & ACCESSORIES ---------------- */
  {
    slug: 'power-bank', sku: 'ELC-PB', category: 'electronics', name: 'Power Bank', brand: null,
    short: 'Fast-charging power banks with dual USB output.',
    description: 'Keep phones, earbuds and tablets charged on the go. LED charge indicator and dual USB output.',
    specs: { Output: 'Dual USB', Indicator: 'LED' },
    variantKey: 'Capacity', featured: false, popular: false, isNew: false, art: ['powerBank', {}],
    variants: [V('10,000 mAh', 1800, null, 30), V('20,000 mAh', 3200, 3600, 22)],
  },
  {
    slug: 'wireless-earbuds', sku: 'ELC-EB', category: 'electronics', name: 'Wireless Earbuds', brand: null,
    short: 'Bluetooth earbuds with charging case.',
    description: 'True wireless earbuds with clear sound, touch controls and a pocket charging case.',
    specs: { Connectivity: 'Bluetooth 5.3', 'Case battery': 'Up to 20 hours total' },
    variantKey: 'Model', featured: false, popular: false, isNew: true, art: ['earbuds', {}],
    variants: [V('Standard', 2500, 3200, 40)],
  },
  {
    slug: 'surge-protected-extension-socket', sku: 'ACC-EXT', category: 'other-accessories', name: 'Surge-Protected Extension Socket', brand: null,
    short: 'Extension sockets with surge protection and switch.',
    description: 'Safe multi-way extension with surge protection, individual overload protection and a 3-metre cable.',
    specs: { Cable: '3 metres', Protection: 'Surge and overload' },
    variantKey: 'Sockets', featured: false, popular: false, isNew: false, art: ['extension', {}],
    variants: [V('4-Way', 900, null, 50), V('6-Way', 1300, null, 40), V('8-Way', 1800, null, 28)],
  },
  {
    slug: 'tv-wall-mount-bracket', sku: 'ACC-WM', category: 'other-accessories', name: 'TV Wall Mount Bracket', brand: null,
    short: 'Tilting TV wall brackets for flat-screen TVs.',
    description: 'Strong steel bracket with tilt adjustment. Screws and fixings included.',
    specs: { Material: 'Steel', Includes: 'Screws and fixings' },
    variantKey: 'Fits TV size', featured: false, popular: false, isNew: false, art: ['wallMount', {}],
    variants: [V('32 to 55 Inch', 1500, null, 35), V('55 to 85 Inch', 2600, null, 20)],
  },
]

// ---- helpers shared with the SQL builder + demo mode ----
export const variantSku = (p, v) => `${p.sku}-${v.label.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 14)}`
export const imageFiles = (p) => [`/sample-products/${p.slug}-1.svg`, `/sample-products/${p.slug}-2.svg`]
export const categoryImage = (c) => `/sample-products/category-${c.slug}.svg`
