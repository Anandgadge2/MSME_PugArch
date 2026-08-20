export interface SeedRequirement {
  title: string;
  category: string;
  type: 'PRODUCT' | 'SERVICE';
  qty: number;
  unit: string;
  budget: number;
  desc: string;
}

export interface SeedBuyer {
  slug: string;
  name: string;
  shortName: string;
  subtitle: string;
  category: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  city: string;
  address: string;
  pincode: string;
  type: 'PUBLIC_LIMITED' | 'PRIVATE_LIMITED' | 'GOVERNMENT' | 'PSU';
  turnover: number;
  employees: number;
  pan: string;
  gstin: string;
  cin: string;
  email: string;
  mobile: string;
  requirements: SeedRequirement[];
}

export interface SeedProduct {
  name: string;
  price: number;
  stock: number;
  category: string;
  desc: string;
}

export interface SeedSeller {
  slug: string;
  name: string;
  shortName: string;
  subtitle: string;
  category: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  city: string;
  address: string;
  pincode: string;
  type: 'MSME' | 'SHG' | 'PROPRIETORSHIP' | 'PRIVATE_LIMITED';
  pan: string;
  gstin: string;
  udyam: string;
  email: string;
  mobile: string;
  products: SeedProduct[];
}

export const BUYERS_DATA: SeedBuyer[] = [
  {
    slug: 'vedanta-jharsuguda',
    name: 'Vedanta Limited – Jharsuguda',
    shortName: 'Vedanta Smelter',
    subtitle: 'Aluminium Smelter & Power Plant',
    category: 'Steel & Metal Products',
    icon: 'vedanta',
    primaryColor: '#004b87',
    secondaryColor: '#0ea5e9',
    city: 'Jharsuguda',
    address: 'Vedanta Limited, Smelter & CPP, Post: Bhurkamunda',
    pincode: '768201',
    type: 'PUBLIC_LIMITED',
    turnover: 35000000000,
    employees: 8500,
    pan: 'AAAAC1234V',
    gstin: '21AAAAC1234V1Z5',
    cin: 'L13209GA1965PLC000044',
    email: 'procurement.jsg@vedanta.co.in',
    mobile: '9861011001',
    requirements: [
      {
        title: 'Procurement of High-Alumina Refractory Bricks & Castables',
        category: 'Refractories',
        type: 'PRODUCT',
        qty: 500,
        unit: 'MT',
        budget: 45000000,
        desc: 'High-temperature refractory bricks and castable refractory mixes for aluminium electrolytic potlines and holding furnaces.'
      },
      {
        title: 'Heavy Duty Slurry Pumps & Mechanical Spares for Smelter',
        category: 'Pumps, Motors & Hydraulics',
        type: 'PRODUCT',
        qty: 25,
        unit: 'Units',
        budget: 18500000,
        desc: 'High-wear slurry pumps with high-chrome alloy impellers and mechanical seals for alumina handling.'
      },
      {
        title: 'Industrial PPE, Flame Retardant Suits & Safety Boots',
        category: 'Safety Equipment & Industrial Safety',
        type: 'PRODUCT',
        qty: 1200,
        unit: 'Sets',
        budget: 7200000,
        desc: 'Aluminium smelter grade molten metal splash resistant jackets, safety helmets and EN 345 steel toe boots.'
      },
      {
        title: 'High-Voltage Switchgear & Electrical MRO Spares',
        category: 'Electrical & Electronics',
        type: 'PRODUCT',
        qty: 15,
        unit: 'Lots',
        budget: 28000000,
        desc: '33kV switchgear breaker parts, SF6 gas circuit breaker spares, isolators and protection relays.'
      }
    ]
  },
  {
    slug: 'jsw-energy-utkal',
    name: 'JSW Energy (Utkal) Limited',
    shortName: 'JSW Energy Utkal',
    subtitle: 'Thermal Power Generation Station',
    category: 'Power & Energy Equipment',
    icon: 'jsw',
    primaryColor: '#b91c1c',
    secondaryColor: '#0284c7',
    city: 'Lakhanpur',
    address: 'JSW Energy (Utkal) Ltd, Lakhanpur Plant Site',
    pincode: '768219',
    type: 'PUBLIC_LIMITED',
    turnover: 18000000000,
    employees: 3200,
    pan: 'AAACJ5678J',
    gstin: '21AAACJ5678J1Z2',
    cin: 'U40101MH1994PLC079587',
    email: 'purchase.utkal@jsw.in',
    mobile: '9861011002',
    requirements: [
      {
        title: 'Coal Handling Conveyor Belts, Rollers & Idlers',
        category: 'Conveyor & Material Handling Equipment',
        type: 'PRODUCT',
        qty: 3500,
        unit: 'Meters',
        budget: 24000000,
        desc: 'Fire resistant nylon/nylon carcass conveyor belting and heavy duty carrying & return idlers for coal handling plant.'
      },
      {
        title: 'Boiler & Turbine Mechanical Maintenance Consumables',
        category: 'Industrial Consumables',
        type: 'PRODUCT',
        qty: 1,
        unit: 'Lot',
        budget: 15000000,
        desc: 'High-pressure steam gaskets, turbine lubricating oils, gland packings and high-tensile boiler studs.'
      },
      {
        title: 'Industrial Water Treatment Chemicals & Hydrazine Hydrate',
        category: 'Industrial Chemicals',
        type: 'PRODUCT',
        qty: 80,
        unit: 'Barrels',
        budget: 6500000,
        desc: 'Demineralized boiler feed water treatment corrosion inhibitors, antiscalants and oxygen scavengers.'
      }
    ]
  },
  {
    slug: 'trl-krosaki-refractories',
    name: 'TRL Krosaki Refractories Limited',
    shortName: 'TRL Krosaki',
    subtitle: 'Advanced Refractory Manufacturing',
    category: 'Refractories',
    icon: 'refractory',
    primaryColor: '#c2410c',
    secondaryColor: '#0284c7',
    city: 'Belpahar',
    address: 'TRL Krosaki Works, Belpahar Industrial Area',
    pincode: '768218',
    type: 'PUBLIC_LIMITED',
    turnover: 12000000000,
    employees: 2800,
    pan: 'AAACT9012K',
    gstin: '21AAACT9012K1Z9',
    cin: 'L26921OR1958PLC000349',
    email: 'materials@trlkrosaki.com',
    mobile: '9861011003',
    requirements: [
      {
        title: 'Calcined Bauxite & High-Grade Tabular Alumina',
        category: 'Refractories',
        type: 'PRODUCT',
        qty: 1200,
        unit: 'MT',
        budget: 38000000,
        desc: 'High purity raw mineral feedstock 85%+ Al2O3 grade for high-temperature refractory brick formulations.'
      },
      {
        title: 'Hydraulic Press Spares & High-Temp Thermocouples',
        category: 'Industrial Machinery & Spare Parts',
        type: 'PRODUCT',
        qty: 45,
        unit: 'Units',
        budget: 9500000,
        desc: 'Heavy 1500T refractory brick press hydraulic seals, proportional valves, and Platinum-Rhodium type B thermocouples.'
      },
      {
        title: 'Heavy Duty Packaging Materials & Wooden Pallets',
        category: 'Packaging & Printing',
        type: 'PRODUCT',
        qty: 50000,
        unit: 'Units',
        budget: 4200000,
        desc: 'Heat-treated ISPM-15 wooden export pallets and high-density shrink stretch film for refractory export packaging.'
      }
    ]
  },
  {
    slug: 'smc-power-generation',
    name: 'SMC Power Generation Limited',
    shortName: 'SMC Power (Rungta)',
    subtitle: 'Integrated Steel Plant & CPP',
    category: 'Steel & Metal Products',
    icon: 'steel',
    primaryColor: '#991b1b',
    secondaryColor: '#475569',
    city: 'Hirma',
    address: 'SMC Power Plant, Hirma Village, Post: Talpatia',
    pincode: '768202',
    type: 'PRIVATE_LIMITED',
    turnover: 15000000000,
    employees: 3100,
    pan: 'AAACS3456S',
    gstin: '21AAACS3456S1Z4',
    cin: 'U27102OR2000PTC006240',
    email: 'commercial@smcpower.co.in',
    mobile: '9861011004',
    requirements: [
      {
        title: 'Graphite Electrodes & Ferro-Alloys for Steel Melt Shop',
        category: 'Steel & Metal Products',
        type: 'PRODUCT',
        qty: 180,
        unit: 'MT',
        budget: 32000000,
        desc: 'Ultra High Power (UHP) graphite electrodes and Ferro-Manganese/Silico-Manganese for steel refining.'
      },
      {
        title: 'Heavy Industrial Gearboxes & Rolling Mill Motors',
        category: 'Industrial Machinery & Spare Parts',
        type: 'PRODUCT',
        qty: 20,
        unit: 'Units',
        budget: 16000000,
        desc: 'Helical heavy torque gearboxes and 500kW variable frequency drive rolling mill electric motors.'
      }
    ]
  },
  {
    slug: 'orissa-metaliks',
    name: 'Orissa Metaliks Private Limited',
    shortName: 'Orissa Metaliks',
    subtitle: 'Integrated Steel & Expansion Project',
    category: 'Construction & Building Materials',
    icon: 'steel',
    primaryColor: '#1e3a8a',
    secondaryColor: '#d97706',
    city: 'Budhipadar',
    address: 'Orissa Metaliks Works, Budhipadar Industrial Corridor',
    pincode: '768204',
    type: 'PRIVATE_LIMITED',
    turnover: 22000000000,
    employees: 4200,
    pan: 'AAACO7890M',
    gstin: '21AAACO7890M1Z8',
    cin: 'U27109WB2006PTC111142',
    email: 'project.sourcing@orissametaliks.com',
    mobile: '9861011005',
    requirements: [
      {
        title: 'Structural Steel Beams, Angles & Heavy Fabrication',
        category: 'Construction & Building Materials',
        type: 'PRODUCT',
        qty: 850,
        unit: 'MT',
        budget: 52000000,
        desc: 'IS 2062 Grade E250 structural columns, heavy trusses and crane beam structural supply for steel plant expansion.'
      },
      {
        title: 'Industrial Automation PLC Panels & Field Instrumentation',
        category: 'Automation & Robotics',
        type: 'PRODUCT',
        qty: 12,
        unit: 'Sets',
        budget: 14500000,
        desc: 'Integrated process automation PLC control desks, SCADA panels, mass flow meters and pressure transmitters.'
      }
    ]
  },
  {
    slug: 'ultratech-cement-jharsuguda',
    name: 'UltraTech Cement Limited – Jharsuguda Cement Works',
    shortName: 'UltraTech Cement',
    subtitle: 'Jharsuguda Cement Grinding Works',
    category: 'Cement & Concrete Products',
    icon: 'cement',
    primaryColor: '#ca8a04',
    secondaryColor: '#0f172a',
    city: 'Arda',
    address: 'Jharsuguda Cement Works, Village Arda, Near Bauriguda',
    pincode: '768214',
    type: 'PUBLIC_LIMITED',
    turnover: 28000000000,
    employees: 1900,
    pan: 'AAACU1122C',
    gstin: '21AAACU1122C1Z6',
    cin: 'L26940MH2000PLC128420',
    email: 'purchase.arda@adityabirla.com',
    mobile: '9861011006',
    requirements: [
      {
        title: 'High-Chrome Forged Steel Grinding Media Balls',
        category: 'Cement & Concrete Products',
        type: 'PRODUCT',
        qty: 250,
        unit: 'MT',
        budget: 22500000,
        desc: 'High hardness 60-65 HRC alloy forged steel balls (50mm to 90mm dia) for raw mill and cement ball mill.'
      },
      {
        title: 'Heavy Duty Spherical Roller Bearings for Ball Mill',
        category: 'Bearings & Mechanical Components',
        type: 'PRODUCT',
        qty: 60,
        unit: 'Sets',
        budget: 11000000,
        desc: 'Heavy duty trunnion spherical roller bearings and adapter sleeves with labyrinth seals.'
      }
    ]
  },
  {
    slug: 'ln-metallics',
    name: 'L N Metallics Limited',
    shortName: 'L N Metallics',
    subtitle: 'Sponge Iron & Steel Works',
    category: 'Steel & Metal Products',
    icon: 'steel',
    primaryColor: '#065f46',
    secondaryColor: '#d97706',
    city: 'Sripura',
    address: 'L N Metallics Plant, Sripura Industrial Area',
    pincode: '768201',
    type: 'PUBLIC_LIMITED',
    turnover: 9500000000,
    employees: 1400,
    pan: 'AAACL3344M',
    gstin: '21AAACL3344M1Z3',
    cin: 'U27102OR2003PLC007328',
    email: 'procurement@lnmetallics.com',
    mobile: '9861011007',
    requirements: [
      {
        title: 'Sponge Iron Rotary Kiln Shell Spares & Cooler Rollers',
        category: 'Industrial Machinery & Spare Parts',
        type: 'PRODUCT',
        qty: 15,
        unit: 'Sets',
        budget: 13500000,
        desc: '100 TPD & 350 TPD kiln tyre support rollers, thrust rollers and cooler discharge seals.'
      },
      {
        title: 'Industrial Synthetic Gear Oils & Lubricants',
        category: 'Industrial Consumables',
        type: 'PRODUCT',
        qty: 120,
        unit: 'Barrels',
        budget: 5800000,
        desc: 'ISO VG 320 / 460 synthetic heavy industrial gear oils and lithium complex extreme pressure greases.'
      }
    ]
  },
  {
    slug: 'seven-star-steels',
    name: 'Seven Star Steels Limited',
    shortName: 'Seven Star Steels',
    subtitle: 'Iron & Steel Manufacturing',
    category: 'Steel & Metal Products',
    icon: 'steel',
    primaryColor: '#1d4ed8',
    secondaryColor: '#64748b',
    city: 'Jharsuguda',
    address: 'Seven Star Industrial Complex, Industrial Estate',
    pincode: '768203',
    type: 'PUBLIC_LIMITED',
    turnover: 7800000000,
    employees: 1100,
    pan: 'AAACS5566S',
    gstin: '21AAACS5566S1Z7',
    cin: 'U27106OR2004PLC007788',
    email: 'purchase@sevenstarsteels.com',
    mobile: '9861011008',
    requirements: [
      {
        title: 'Furnace Ramming Mass & High-Temperature Mortar',
        category: 'Refractories',
        type: 'PRODUCT',
        qty: 300,
        unit: 'MT',
        budget: 8500000,
        desc: 'Premixed silica ramming mass with boric acid binder for steel melting induction furnace lining.'
      },
      {
        title: 'Industrial Crane Wheels & Steel Wire Ropes',
        category: 'Conveyor & Material Handling Equipment',
        type: 'PRODUCT',
        qty: 12,
        unit: 'Sets',
        budget: 4900000,
        desc: 'Forged steel double flange EOT crane wheels and 6x36 construction ungalvanized steel wire ropes.'
      }
    ]
  },
  {
    slug: 'jai-hanuman-udyog',
    name: 'Jai Hanuman Udyog Limited',
    shortName: 'Jai Hanuman Udyog',
    subtitle: 'TMT & Billet Re-Rolling Mill',
    category: 'Steel & Metal Products',
    icon: 'steel',
    primaryColor: '#c2410c',
    secondaryColor: '#1e293b',
    city: 'Kalmeshwar',
    address: 'Jai Hanuman Udyog Plant, Kalmeshwar Road',
    pincode: '768201',
    type: 'PRIVATE_LIMITED',
    turnover: 6200000000,
    employees: 850,
    pan: 'AAACJ7788U',
    gstin: '21AAACJ7788U1Z1',
    cin: 'U27109OR2005PLC008214',
    email: 'purchase@jaihanumanudyog.com',
    mobile: '9861011009',
    requirements: [
      {
        title: 'TMT Billet Re-rolling Mill Guides & Friction Rollers',
        category: 'Industrial Machinery & Spare Parts',
        type: 'PRODUCT',
        qty: 40,
        unit: 'Units',
        budget: 6800000,
        desc: 'Tungsten carbide and alloy steel entry and delivery roller guides for high-speed continuous TMT rolling.'
      },
      {
        title: 'Industrial Oxygen & Dissolved Acetylene Cylinders',
        category: 'Industrial Chemicals',
        type: 'PRODUCT',
        qty: 600,
        unit: 'Cylinders',
        budget: 2800000,
        desc: 'High purity commercial industrial oxygen (7 cubic meter) and dissolved acetylene cylinders for steel cutting.'
      }
    ]
  },
  {
    slug: 'thakur-prasad-sao',
    name: 'Thakur Prasad Sao and Sons Private Limited – Unit IV',
    shortName: 'TPS & Sons Unit IV',
    subtitle: 'Heavy Iron & Steel Processing',
    category: 'Steel & Metal Products',
    icon: 'steel',
    primaryColor: '#1e3a8a',
    secondaryColor: '#b45309',
    city: 'Jharsuguda',
    address: 'TPS Plant Unit IV, Industrial Growth Centre',
    pincode: '768201',
    type: 'PRIVATE_LIMITED',
    turnover: 8400000000,
    employees: 1250,
    pan: 'AAACT9900P',
    gstin: '21AAACT9900P1Z0',
    cin: 'U27101WB1998PTC087612',
    email: 'procurement.unit4@tpsao.com',
    mobile: '9861011010',
    requirements: [
      {
        title: 'Industrial Conveyor Drive Pulleys & Belt Splice Kits',
        category: 'Conveyor & Material Handling Equipment',
        type: 'PRODUCT',
        qty: 35,
        unit: 'Units',
        budget: 7400000,
        desc: 'Diamond grooved rubber lagged drive and tail conveyor drum pulleys for heavy mineral transport.'
      },
      {
        title: 'High-Tensile Industrial Grade Fasteners (Grade 8.8 / 10.9)',
        category: 'Industrial Fasteners & Components',
        type: 'PRODUCT',
        qty: 10,
        unit: 'Tons',
        budget: 3500000,
        desc: 'Hot-dip galvanized and black oxide heavy hex head bolts, nuts and hardened washers (M16 to M48).'
      }
    ]
  }
];

export const SELLERS_DATA: SeedSeller[] = [
  {
    slug: 'atom-engineering-products',
    name: 'ATOM ENGINEERING PRODUCTS PVT LTD',
    shortName: 'Atom Engineering',
    subtitle: 'Tools, MRO & Engineering Products',
    category: 'Tools & Industrial Hardware',
    icon: 'atom',
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
    city: 'Jharsuguda',
    address: 'Plot No. 42, Industrial Area, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACA1001A',
    gstin: '21AAACA1001A1Z1',
    udyam: 'UDYAM-OD-12-0001001',
    email: 'sales@atomengineering.in',
    mobile: '9437012001',
    products: [
      { name: 'Heavy Duty Pneumatic Impact Wrench 1 Inch Drive', price: 28500, stock: 45, category: 'Tools & Industrial Hardware', desc: 'Twin hammer mechanism, 2600 Nm max torque industrial pneumatic wrench for heavy plant maintenance.' },
      { name: 'Tungsten Carbide Milling & Lathe Cutting Inserts (Box of 10)', price: 4200, stock: 350, category: 'Tools & Industrial Hardware', desc: 'TiAlN coated CNC turning and face milling inserts for alloy steel and cast iron machining.' },
      { name: 'High-Precision Digital Vernier & Dial Calipers', price: 3800, stock: 120, category: 'Tools & Industrial Hardware', desc: 'IP67 waterproof stainless steel digital vernier calipers with calibration certificate.' }
    ]
  },
  {
    slug: 'abhinav-distributors',
    name: 'ABHINAV DISTRIBUTORS',
    shortName: 'Abhinav Distributors',
    subtitle: 'Welding Equipment & Consumables',
    category: 'Welding & Cutting Equipment',
    icon: 'welding',
    primaryColor: '#f97316',
    secondaryColor: '#334155',
    city: 'Jharsuguda',
    address: 'Near Old Bus Stand, Main Road, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACB2002B',
    gstin: '21AAACB2002B1Z2',
    udyam: 'UDYAM-OD-12-0002002',
    email: 'abhinavdistributors.jsg@gmail.com',
    mobile: '9437012002',
    products: [
      { name: 'Heavy Duty Inverter Arc Welding Machine 400A IGBT', price: 34000, stock: 30, category: 'Welding & Cutting Equipment', desc: '3-Phase industrial IGBT inverter MMA/TIG welder with hot start and anti-stick function.' },
      { name: 'Low Hydrogen Heavy Welding Electrodes E7018 (20kg Pack)', price: 3200, stock: 400, category: 'Industrial Consumables', desc: 'Basic coated low hydrogen electrode for radiographic quality structural steel welding.' },
      { name: 'Industrial Plasma Torch Consumables Set', price: 1850, stock: 200, category: 'Welding & Cutting Equipment', desc: 'High-life copper nozzles and hafnium electrodes for CNC plasma cutting tables.' }
    ]
  },
  {
    slug: 'indian-chain-mill-stores',
    name: 'Indian Chain & Mill Stores',
    shortName: 'ICMS Jharsuguda',
    subtitle: 'Lifting & Material Handling Equipment',
    category: 'Conveyor & Material Handling Equipment',
    icon: 'chain',
    primaryColor: '#ea580c',
    secondaryColor: '#1e3a8a',
    city: 'Jharsuguda',
    address: 'Station Road, Opp. Goods Shed, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACI3003C',
    gstin: '21AAACI3003C1Z3',
    udyam: 'UDYAM-OD-12-0003003',
    email: 'contact@icms.in',
    mobile: '9437012003',
    products: [
      { name: 'Grade 80 Alloy Steel Short Link Lifting Chain (10mm x 50m)', price: 42000, stock: 25, category: 'Conveyor & Material Handling Equipment', desc: 'En 818-2 standard heat-treated alloy steel load chain with proof test certificate.' },
      { name: 'Double Ply Polyester Webbing Slings 5 Ton (6 Meter)', price: 2100, stock: 180, category: 'Conveyor & Material Handling Equipment', desc: 'Heavy duty high-tenacity polyester flat webbing slings with reinforced lifting eyes.' },
      { name: 'Drop Forged Alloy Steel Bow & D-Shackles (8.5 Ton)', price: 1250, stock: 300, category: 'Conveyor & Material Handling Equipment', desc: 'Safety pin type bow shackles for heavy crane rigging and mining applications.' }
    ]
  },
  {
    slug: 'rl-industrial-corporation',
    name: 'R.L. Industrial Corporation - Industrial Safety Store in Jharsuguda',
    shortName: 'R.L. Industrial Safety',
    subtitle: 'Industrial PPE & General Safety Supplies',
    category: 'Safety Equipment & Industrial Safety',
    icon: 'safety',
    primaryColor: '#16a34a',
    secondaryColor: '#0f172a',
    city: 'Jharsuguda',
    address: 'Marwari Para, Main Market, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACR4004D',
    gstin: '21AAACR4004D1Z4',
    udyam: 'UDYAM-OD-12-0004004',
    email: 'rl.safety.jsg@gmail.com',
    mobile: '9437012004',
    products: [
      { name: 'ISI Full Body Fall Arrest Safety Harness with Shock Absorber', price: 2450, stock: 250, category: 'Safety Equipment & Industrial Safety', desc: 'EN 361 certified dual lanyard scaffolding safety harness with forged snap hooks.' },
      { name: 'High-Grade Steel Toe Industrial Safety Shoes (S3 Standard)', price: 1650, stock: 450, category: 'Safety Equipment & Industrial Safety', desc: 'Antistatic, oil & acid resistant PU double density sole safety footwear.' },
      { name: 'Heavy Duty Leather Welding Apron & Leg Guard Set', price: 950, stock: 300, category: 'Safety Equipment & Industrial Safety', desc: 'Split cowhide heat and flame resistant protective apparel for smelter & boiler operators.' }
    ]
  },
  {
    slug: 'swastik-engicom',
    name: 'Swastik Engicom',
    shortName: 'Swastik Engicom',
    subtitle: 'Safety Engineering & PPE Supplies',
    category: 'Safety Equipment & Industrial Safety',
    icon: 'safety',
    primaryColor: '#0d9488',
    secondaryColor: '#1e293b',
    city: 'Jharsuguda',
    address: 'Beheramal Road, Near Overbridge, Jharsuguda',
    pincode: '768203',
    type: 'MSME',
    pan: 'AAACS5005E',
    gstin: '21AAACS5005E1Z5',
    udyam: 'UDYAM-OD-12-0005005',
    email: 'info@swastikengicom.com',
    mobile: '9437012005',
    products: [
      { name: 'Self-Contained Breathing Apparatus (SCBA 6.8L Composite Cylinder)', price: 48000, stock: 15, category: 'Safety Equipment & Industrial Safety', desc: '300 Bar composite carbon cylinder SCBA kit for hazardous chemical and gas rescue operations.' },
      { name: 'ABC Dry Chemical Powder Fire Extinguisher 9 Kg (ISI Marked)', price: 3200, stock: 150, category: 'Safety Equipment & Industrial Safety', desc: 'Stored pressure Class A, B, C & electrical fire extinguisher with squeeze grip mechanism.' },
      { name: 'High-Visibility Executive Safety Jacket with Custom Embroidery', price: 380, stock: 800, category: 'Safety Equipment & Industrial Safety', desc: 'EN 471 certified fluorescent mesh safety vest with 2-inch 3M reflective tape.' }
    ]
  },
  {
    slug: 'krishna-electricals-industrial',
    name: 'Krishna electricals & industrial',
    shortName: 'Krishna Electricals',
    subtitle: 'Industrial Motors, Cables & Switchgear',
    category: 'Electrical & Electronics',
    icon: 'electrical',
    primaryColor: '#eab308',
    secondaryColor: '#1e3a8a',
    city: 'Jharsuguda',
    address: 'Purani Basti, Power House Road, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACK6006F',
    gstin: '21AAACK6006F1Z6',
    udyam: 'UDYAM-OD-12-0006006',
    email: 'krishnaelectricals.jsg@gmail.com',
    mobile: '9437012006',
    products: [
      { name: '3-Phase Induction Electric Motor 25 HP (1440 RPM, Foot Mounted)', price: 58000, stock: 18, category: 'Electrical & Electronics', desc: 'IE3 Premium efficiency cast iron body industrial induction motor for heavy conveyor drives.' },
      { name: 'Molded Case Circuit Breaker (MCCB) 400A 4-Pole 36kA', price: 18500, stock: 40, category: 'Electrical Cables & Power Equipment', desc: 'Thermal-magnetic trip unit circuit breaker for power distribution panels.' },
      { name: 'Armoured Copper Power Cable 3.5 Core x 70 sq.mm (100 Meter Drum)', price: 82000, stock: 12, category: 'Electrical Cables & Power Equipment', desc: '1.1kV XLPE insulated heavy duty underground power cable for industrial substations.' }
    ]
  },
  {
    slug: 'konark-enterprises',
    name: 'Konark Enterprises',
    shortName: 'Konark Enterprises',
    subtitle: 'Industrial Tools & Spares Wholesale',
    category: 'Tools & Industrial Hardware',
    icon: 'atom',
    primaryColor: '#9333ea',
    secondaryColor: '#0f172a',
    city: 'Jharsuguda',
    address: 'Biju Expressway Link Road, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACK7007G',
    gstin: '21AAACK7007G1Z7',
    udyam: 'UDYAM-OD-12-0007007',
    email: 'konark.enterprises.jsg@gmail.com',
    mobile: '9437012007',
    products: [
      { name: 'Heavy Duty Click Type Industrial Torque Wrench (200-1000 Nm)', price: 16500, stock: 35, category: 'Tools & Industrial Hardware', desc: 'Square drive calibrated torque wrench with dual scale for heavy machinery flange bolting.' },
      { name: 'Non-Sparking Beryllium Copper 24-Piece Safety Tool Kit', price: 42000, stock: 10, category: 'Tools & Industrial Hardware', desc: 'Explosion-proof safety hand tools for petrochemical, fuel depot and refinery operations.' },
      { name: 'High-Pressure Hydraulic Wire Braided Hose Assembly 1/2 Inch', price: 1450, stock: 220, category: 'Hydraulics & Pneumatics', desc: '2-Wire braided 350 bar working pressure hose with BSP/NPT crimped male-female ends.' }
    ]
  },
  {
    slug: 'trade-industrial-syndicate',
    name: 'Trade & Industrial Syndicate',
    shortName: 'Trade & Industrial Syn.',
    subtitle: 'Spares & Industrial Wholesale Distribution',
    category: 'Industrial Consumables',
    icon: 'steel',
    primaryColor: '#0284c7',
    secondaryColor: '#059669',
    city: 'Jharsuguda',
    address: 'Industrial Estate, Phase-1, Jharsuguda',
    pincode: '768203',
    type: 'MSME',
    pan: 'AAACT8008H',
    gstin: '21AAACT8008H1Z8',
    udyam: 'UDYAM-OD-12-0008008',
    email: 'tis.jharsuguda@yahoo.com',
    mobile: '9437012008',
    products: [
      { name: 'Synthetic Heavy EP-2 Industrial Grease (180 Kg Barrel)', price: 46000, stock: 20, category: 'Industrial Consumables', desc: 'High-temperature lithium complex grease with solid MoS2 additives for steel mill roll neck bearings.' },
      { name: 'Spiral Wound Metallic Gaskets with SS316 Inner Ring (Class 300)', price: 480, stock: 600, category: 'Industrial Consumables', desc: 'Graphite filler spiral wound flange gasket for high-pressure steam and chemical piping.' },
      { name: 'Industrial Cleaner & Solvent Degreaser (20L Can)', price: 3400, stock: 85, category: 'Industrial Chemicals', desc: 'Heavy duty fast-evaporating solvent for mechanical parts, gearboxes and motor windings.' }
    ]
  },
  {
    slug: 'pavan-enterprises-jsg',
    name: 'Pavan Enterprises, JSG',
    shortName: 'Pavan Enterprises',
    subtitle: 'Electrical & Industrial Control Systems',
    category: 'Electrical & Electronics',
    icon: 'electrical',
    primaryColor: '#0284c7',
    secondaryColor: '#334155',
    city: 'Jharsuguda',
    address: 'Mangalbazar, Near SBI Main Branch, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACP9009I',
    gstin: '21AAACP9009I1Z9',
    udyam: 'UDYAM-OD-12-0009009',
    email: 'pavan.enterprises.jsg@gmail.com',
    mobile: '9437012009',
    products: [
      { name: 'Industrial Variable Frequency Drive (VFD) 30kW / 40 HP', price: 68000, stock: 12, category: 'Automation & Robotics', desc: 'Compact vector control AC drive with built-in Modbus RTU communication for pump & fan control.' },
      { name: 'Infrared Non-Contact Laser Thermometer / Pyrometer (-50°C to 1200°C)', price: 8500, stock: 40, category: 'Electrical & Electronics', desc: 'High optical resolution 50:1 pyrometer for furnace and metallurgical hot spot monitoring.' },
      { name: 'Perforated Galvanized Iron (GI) Cable Trays (100mm x 50mm x 2.5m)', price: 850, stock: 300, category: 'Electrical Cables & Power Equipment', desc: 'Pre-galvanized heavy gauge cable support raceway system for plant electrical cabling.' }
    ]
  },
  {
    slug: 'divine-trends',
    name: 'M/S DIVINE TRENDS',
    shortName: 'Divine Trends',
    subtitle: 'General Industrial Equipment & Supplies',
    category: 'General Industrial Supplier',
    icon: 'atom',
    primaryColor: '#4f46e5',
    secondaryColor: '#d97706',
    city: 'Jharsuguda',
    address: 'Sarbahal Road, Near LIC Office, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACD0101J',
    gstin: '21AAACD0101J1Z0',
    udyam: 'UDYAM-OD-12-0010010',
    email: 'divinetrends.jsg@gmail.com',
    mobile: '9437012010',
    products: [
      { name: 'Industrial High-Bay LED Flood Light 150W (IP66 Waterproof)', price: 4200, stock: 90, category: 'Electrical & Electronics', desc: 'Die-cast aluminium housing high-lumen 140 lm/W LED high-bay for factory sheds and warehouses.' },
      { name: 'Polycarbonate Clear Anti-Fog Safety Goggles (Pack of 20)', price: 1600, stock: 150, category: 'Safety Equipment & Industrial Safety', desc: 'Wrap-around UV385 protective eyewear with adjustable elastic headband.' },
      { name: 'Industrial White Cotton Waste Rags (50 Kg Bale)', price: 2800, stock: 80, category: 'Industrial Consumables', desc: 'Super absorbent unstitched cotton cloth rags for workshop machine wipe down.' }
    ]
  },
  {
    slug: 'laxmi-sales-agency',
    name: 'Laxmi Sales Agency',
    shortName: 'Laxmi Sales Agency',
    subtitle: 'Industrial Bearings & Transmission Spares',
    category: 'Bearings & Mechanical Components',
    icon: 'bearing',
    primaryColor: '#059669',
    secondaryColor: '#d97706',
    city: 'Jharsuguda',
    address: 'Gandhi Chowk, Near Post Office, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACL1212K',
    gstin: '21AAACL1212K1Z1',
    udyam: 'UDYAM-OD-12-0011011',
    email: 'laxmisales.jsg@gmail.com',
    mobile: '9437012011',
    products: [
      { name: 'Deep Groove Radial Ball Bearings 6312-2RS / C3 (High Speed)', price: 1850, stock: 240, category: 'Bearings & Mechanical Components', desc: 'High carbon chromium steel precision bearing with double contact rubber seals.' },
      { name: 'Tapered Roller Bearing Set 32218 for Steel Mill Rollers', price: 4900, stock: 85, category: 'Bearings & Mechanical Components', desc: 'Heavy radial and thrust load bearing set engineered for heavy steel mill gearboxes.' },
      { name: 'Cast Iron Split Plummer Block Bearing Housing SN 516', price: 3200, stock: 110, category: 'Bearings & Mechanical Components', desc: 'Heavy grade cast iron housing with felt seals for conveyor shaft support.' }
    ]
  },
  {
    slug: 'skf-stores-spares',
    name: 'Skf Stores & Spares',
    shortName: 'SKF Stores & Spares',
    subtitle: 'Precision Bearings & Rotating Equipment',
    category: 'Bearings & Mechanical Components',
    icon: 'bearing',
    primaryColor: '#1e40af',
    secondaryColor: '#64748b',
    city: 'Jharsuguda',
    address: 'Bypass Road, Near Transport Nagar, Jharsuguda',
    pincode: '768202',
    type: 'MSME',
    pan: 'AAACS2323L',
    gstin: '21AAACS2323L1Z2',
    udyam: 'UDYAM-OD-12-0012012',
    email: 'skfstores.jsg@gmail.com',
    mobile: '9437012012',
    products: [
      { name: 'Spherical Roller Bearing 22220-E1-K with Adapter Sleeve', price: 9200, stock: 55, category: 'Bearings & Mechanical Components', desc: 'Self-aligning double-row spherical roller bearing with brass cage for vibrating screens.' },
      { name: 'Viton & NBR Double Lip Rotary Shaft Oil Seals (Set of 10)', price: 1650, stock: 300, category: 'Industrial Consumables', desc: 'High temperature and chemical resistant oil seals for gearbox pinion shafts.' },
      { name: 'Laser Optical Pulley & Shaft Alignment Tool Kit', price: 78000, stock: 5, category: 'Tools & Industrial Hardware', desc: 'Digital laser transmitter and target receiver for precision shaft coupling alignment.' }
    ]
  },
  {
    slug: 'jharsuguda-pipes-saniteries',
    name: 'JHARSUGUDA PIPES \'N\' SANITERIES',
    shortName: 'JSG Pipes & Hardware',
    subtitle: 'Pipes, Valves & Industrial Plumbing',
    category: 'Pipes, Tiles & Hardware',
    icon: 'pipe',
    primaryColor: '#0284c7',
    secondaryColor: '#475569',
    city: 'Jharsuguda',
    address: 'Main Chowk, Station Link Road, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACJ3434M',
    gstin: '21AAACJ3434M1Z3',
    udyam: 'UDYAM-OD-12-0013013',
    email: 'jsgpipes@rediffmail.com',
    mobile: '9437012013',
    products: [
      { name: 'Seamless Carbon Steel Pipe ASTM A106 Grade B (4 Inch NB, 6m Length)', price: 9800, stock: 75, category: 'Pipes, Tiles & Hardware', desc: 'Schedule 40 seamless pipe for high-pressure power plant steam and water lines.' },
      { name: 'Cast Steel Flanged Ball Valve 3 Inch Class 150 (Fire Safe)', price: 6200, stock: 60, category: 'Pumps, Motors & Hydraulics', desc: 'Full bore carbon steel body ball valve with SS304 ball and PTFE seating.' },
      { name: 'Heavy Duty Ductile Iron (DI) K9 Water Supply Pipe (150mm x 5.5m)', price: 14500, stock: 40, category: 'Pipes, Tiles & Hardware', desc: 'Cement mortar lined push-on joint DI pipe for industrial raw water intake pipelines.' }
    ]
  },
  {
    slug: 'utkal-innovatives',
    name: 'Utkal Innovatives',
    shortName: 'Utkal Innovatives',
    subtitle: 'Roller Chains & Mining Feeder Spares',
    category: 'Mechanical & Engineering',
    icon: 'chain',
    primaryColor: '#dc2626',
    secondaryColor: '#334155',
    city: 'Kalmeshwar',
    address: 'MSME Industrial Cluster, Kalmeshwar, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACU4545N',
    gstin: '21AAACU4545N1Z4',
    udyam: 'UDYAM-OD-12-0014014',
    email: 'contact@utkalinnovatives.com',
    mobile: '9437012014',
    products: [
      { name: 'Heavy Duty Simplex Industrial Roller Chain (ASA 120 / 1.5 Inch Pitch x 10ft)', price: 18500, stock: 35, category: 'Mechanical & Engineering', desc: 'Shot-peened alloy steel heat-treated roller chain for heavy mining feeder breakers.' },
      { name: 'CNC Precision Hardened Feeder Breaker Drive Sprocket (24 Teeth)', price: 14200, stock: 25, category: 'Mechanical & Engineering', desc: 'Induction hardened teeth flame-cut steel sprocket for coal crusher drive.' },
      { name: 'Phosphor Bronze Precision Machined Bushing Set (Pack of 8)', price: 4800, stock: 90, category: 'Mechanical & Engineering', desc: 'Self-lubricating leaded bronze guide bushings for heavy mechanical presses.' }
    ]
  },
  {
    slug: 'siddhivinayak-engineering',
    name: 'Siddhivinayak engineering',
    shortName: 'Siddhivinayak Engg',
    subtitle: 'Machinery Parts & Precision Fabrication',
    category: 'Industrial Machinery & Spare Parts',
    icon: 'steel',
    primaryColor: '#ea580c',
    secondaryColor: '#1e3a8a',
    city: 'Jharsuguda',
    address: 'Vedantinagar, Near Railway Siding, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACS5656O',
    gstin: '21AAACS5656O1Z5',
    udyam: 'UDYAM-OD-12-0015015',
    email: 'siddhivinayak.engg.jsg@gmail.com',
    mobile: '9437012015',
    products: [
      { name: 'Cast Steel Slurry Pump Impeller (High Chrome 28% Alloy)', price: 28000, stock: 20, category: 'Industrial Machinery & Spare Parts', desc: 'Dynamically balanced closed impeller for ash slurry and mineral handling pumps.' },
      { name: 'Machined Heavy Conveyor Head Drum Pulley (600mm Dia x 1200mm Face)', price: 45000, stock: 10, category: 'Conveyor & Material Handling Equipment', desc: 'Crown faced conveyor drum pulley with heavy duty keyless locking assembly.' },
      { name: 'Precision Case-Hardened Spur & Helical Gears (Module 6 / 45 Teeth)', price: 8500, stock: 45, category: 'Industrial Machinery & Spare Parts', desc: 'Ground tooth finish 20MnCr5 alloy steel gear for heavy plant machinery.' }
    ]
  },
  {
    slug: 'royal-engineering',
    name: 'ROYAL ENGINEERING',
    shortName: 'Royal Engineering',
    subtitle: 'Heavy Structural Fabrication & Plant Services',
    category: 'Fabrication & Welding Services',
    icon: 'steel',
    primaryColor: '#ca8a04',
    secondaryColor: '#1e293b',
    city: 'Jharsuguda',
    address: 'Industrial Growth Centre, Phase-2, Jharsuguda',
    pincode: '768202',
    type: 'MSME',
    pan: 'AAACR6767P',
    gstin: '21AAACR6767P1Z6',
    udyam: 'UDYAM-OD-12-0016016',
    email: 'royalengineering.jsg@gmail.com',
    mobile: '9437012016',
    products: [
      { name: 'Custom Stainless Steel (SS304) Chemical Storage Hopper (5 KL)', price: 240000, stock: 4, category: 'Fabrication & Welding Services', desc: 'TIG welded and pickled chemical storage vessel with conical bottom discharge.' },
      { name: 'Heavy Industrial Ducting & Chimney Flue Gas Sections (Per Metric Ton)', price: 78000, stock: 15, category: 'Fabrication & Welding Services', desc: 'IS 2062 Grade B fabricated circular & rectangular ducting with expansion joints.' },
      { name: 'On-Site Plant Structural Modification & Welding Service Package', price: 120000, stock: 8, category: 'Fabrication & Welding Services', desc: 'Qualified 6G welder crew with mobile diesel generators and rigging gear.' }
    ]
  },
  {
    slug: 'kainsara-infraprojects',
    name: 'Kainsara Infraprojects Private Limited',
    shortName: 'Kainsara Infra',
    subtitle: 'Civil Infrastructure & Ready Mix Concrete',
    category: 'Construction & Civil Work Services',
    icon: 'steel',
    primaryColor: '#475569',
    secondaryColor: '#eab308',
    city: 'Kainsara',
    address: 'Kainsara Industrial Corridor, Jharsuguda',
    pincode: '768211',
    type: 'MSME',
    pan: 'AAACK7878Q',
    gstin: '21AAACK7878Q1Z7',
    udyam: 'UDYAM-OD-12-0017017',
    email: 'kainsarainfra@gmail.com',
    mobile: '9437012017',
    products: [
      { name: 'Ready Mix Concrete M30 Grade (Per Cubic Meter)', price: 4200, stock: 500, category: 'Construction & Building Materials', desc: 'High-strength computerized batching plant RMC with slump retention retarders.' },
      { name: 'Crushed Granite Stone Aggregates 20mm (Per Metric Ton)', price: 750, stock: 1200, category: 'Construction & Building Materials', desc: 'Triple stage crushed cubical stone ballast for heavy industrial RCC foundations.' },
      { name: 'Heavy Industrial Precast RCC Box Culverts (2m x 2m)', price: 18500, stock: 30, category: 'Construction & Building Materials', desc: 'Steel reinforced heavy precast drainage and cable trench culvert modules.' }
    ]
  },
  {
    slug: 'kalpana-traders-jharsuguda',
    name: 'kalpana traders jharsuguda',
    shortName: 'Kalpana Traders',
    subtitle: 'General Industrial Equipment & Fasteners',
    category: 'General Industrial Supplier',
    icon: 'atom',
    primaryColor: '#15803d',
    secondaryColor: '#d97706',
    city: 'Jharsuguda',
    address: 'Purana Bus Stand, Near Town High School, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACK8989R',
    gstin: '21AAACK8989R1Z8',
    udyam: 'UDYAM-OD-12-0018018',
    email: 'kalpanatraders.jsg@gmail.com',
    mobile: '9437012018',
    products: [
      { name: 'Heavy Duty Cast Iron Bench Vice 8 Inch Swivel Base', price: 5400, stock: 40, category: 'Tools & Industrial Hardware', desc: 'Serrated hardened steel jaw workshop vice with forged steel screw.' },
      { name: 'Industrial Depressed Center Grinding Wheels 7 Inch (Pack of 25)', price: 1950, stock: 180, category: 'Tools & Industrial Hardware', desc: 'Aluminium oxide double fiberglass reinforced grinding discs for steel weld seams.' },
      { name: 'High-Tensile Hex Head Bolt & Nut Set M24 x 100mm (Box of 50)', price: 3400, stock: 120, category: 'Industrial Fasteners & Components', desc: 'Grade 8.8 structural black oxide bolts with heavy metric hex nuts.' }
    ]
  },
  {
    slug: 'swastik-enterprise',
    name: 'Swastik Enterprise',
    shortName: 'Swastik Enterprise',
    subtitle: 'Industrial Cleaning & Housekeeping Chemicals',
    category: 'Industrial Consumables',
    icon: 'cleaning',
    primaryColor: '#06b6d4',
    secondaryColor: '#0f766e',
    city: 'Jharsuguda',
    address: 'Cox Colony, Behind Railway Hospital, Jharsuguda',
    pincode: '768201',
    type: 'MSME',
    pan: 'AAACS9090S',
    gstin: '21AAACS9090S1Z9',
    udyam: 'UDYAM-OD-12-0019019',
    email: 'swastikenterprise.jsg@gmail.com',
    mobile: '9437012019',
    products: [
      { name: 'Concentrated Industrial Floor Cleaner & Heavy Degreaser (50 Liter Can)', price: 3800, stock: 65, category: 'Industrial Consumables', desc: 'Biodegradable heavy alkaline floor cleaner for industrial workshops and oil spills.' },
      { name: 'Antibacterial Industrial Hand Wash Concentrate (20 Liter Carboy)', price: 1650, stock: 110, category: 'FMCG & Daily Utility Supply', desc: 'Skin friendly gentle foaming hand cleanser for plant canteens and washrooms.' },
      { name: 'Extra Heavy Duty Black Garbage Trash Bags (36 x 48 Inch, Pack of 100)', price: 850, stock: 250, category: 'FMCG & Daily Utility Supply', desc: 'Virgin virgin LDPE heavy gauge tear-resistant institutional waste bags.' }
    ]
  },
  {
    slug: 'jharsuguda-broom',
    name: 'Jharsuguda Broom',
    shortName: 'Jharsuguda Broom',
    subtitle: 'Institutional Housekeeping & Eco Brooms',
    category: 'FMCG & Daily Utility Supply',
    icon: 'eco',
    primaryColor: '#16a34a',
    secondaryColor: '#d97706',
    city: 'Jharsuguda',
    address: 'Town Hall Road, MSME Handicraft Complex, Jharsuguda',
    pincode: '768201',
    type: 'SHG',
    pan: 'AAACJ0101T',
    gstin: '21AAACJ0101T1Z0',
    udyam: 'UDYAM-OD-12-0020020',
    email: 'jharsugudabroom.shg@gmail.com',
    mobile: '9437012020',
    products: [
      { name: 'Natural Odisha Hill Grass Heavy Industrial Floor Broom (Bundle of 25)', price: 1850, stock: 150, category: 'FMCG & Daily Utility Supply', desc: 'Extra dense traditional hill grass brooms with reinforced wire binding for office and plant floor.' },
      { name: 'Heavy Duty Coconut Coir Hard Ground Sweeping Broom (Bundle of 20)', price: 1400, stock: 200, category: 'FMCG & Daily Utility Supply', desc: 'Tough unbleached natural coconut fiber brooms for outdoor plant roads and concrete yards.' },
      { name: 'Industrial Cotton Wet Floor Mop with Long Aluminium Handle (Set of 10)', price: 2200, stock: 80, category: 'FMCG & Daily Utility Supply', desc: 'Loop-end super absorbent cotton string mop heads with heavy clip-on handle.' }
    ]
  }
];
