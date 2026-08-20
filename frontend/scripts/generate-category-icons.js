const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'categories');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const icons = {
    'electrical-electronics.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="ee_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e40af"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>
    <linearGradient id="ee_orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>
    <linearGradient id="ee_copper" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>
    <linearGradient id="ee_metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>
    <filter id="ee_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Electric Motor Body -->
  <g filter="url(#ee_shadow)">
    <!-- Base plate -->
    <rect x="25" y="88" width="55" height="10" rx="3" fill="#334155"/>
    <rect x="22" y="94" width="61" height="5" rx="2" fill="#1e293b"/>
    <!-- Motor Cylinder -->
    <rect x="30" y="44" width="45" height="46" rx="6" fill="url(#ee_blue)"/>
    <!-- Cooling Fins -->
    <line x1="36" y1="46" x2="36" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <line x1="42" y1="46" x2="42" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <line x1="48" y1="46" x2="48" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <line x1="54" y1="46" x2="54" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <line x1="60" y1="46" x2="60" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <line x1="66" y1="46" x2="66" y2="88" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <!-- Terminal Box on top -->
    <rect x="42" y="34" width="22" height="12" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
    <!-- Rotor Shaft & Pulley -->
    <rect x="75" y="60" width="14" height="14" rx="2" fill="url(#ee_metal)"/>
    <circle cx="89" cy="67" r="10" fill="#475569" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="89" cy="67" r="4" fill="#0f172a"/>
  </g>
  <!-- Water Pump / Orange unit -->
  <g filter="url(#ee_shadow)">
    <rect x="80" y="70" width="34" height="28" rx="5" fill="url(#ee_orange)"/>
    <circle cx="97" cy="84" r="9" fill="#7c2d12" stroke="#fed7aa" stroke-width="1.5"/>
    <path d="M97 45 L97 70" stroke="url(#ee_metal)" stroke-width="7" stroke-linecap="round"/>
    <rect x="91" y="40" width="12" height="6" rx="2" fill="#475569"/>
    <path d="M114 84 L126 84" stroke="url(#ee_metal)" stroke-width="6" stroke-linecap="round"/>
  </g>
  <!-- Wire spool / cables -->
  <g filter="url(#ee_shadow)">
    <circle cx="22" cy="74" r="14" fill="url(#ee_copper)" stroke="#78350f" stroke-width="1"/>
    <circle cx="22" cy="74" r="7" fill="#f8fafc"/>
    <path d="M22 60 C30 50, 40 40, 50 36" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
  </g>
  <!-- Electrical Spark Badge -->
  <g transform="translate(100, 20)">
    <circle cx="14" cy="14" r="14" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
    <path d="M15 6 L9 15 L14 15 L13 22 L19 13 L14 13 Z" fill="#d97706"/>
  </g>
</svg>`,

    'office-supplies.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="of_chair" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#831843"/><stop offset="100%" stop-color="#4c0519"/></linearGradient>
    <linearGradient id="of_printer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <filter id="of_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Ergonomic Executive Office Chair -->
  <g filter="url(#of_shadow)">
    <!-- Backrest -->
    <rect x="25" y="25" width="30" height="42" rx="7" fill="url(#of_chair)" stroke="#be123c" stroke-width="1"/>
    <line x1="30" y1="40" x2="50" y2="40" stroke="#f43f5e" stroke-width="1.5" opacity="0.6"/>
    <line x1="30" y1="52" x2="50" y2="52" stroke="#f43f5e" stroke-width="1.5" opacity="0.6"/>
    <!-- Headrest -->
    <rect x="30" y="16" width="20" height="8" rx="4" fill="url(#of_chair)"/>
    <!-- Seat -->
    <rect x="20" y="65" width="40" height="12" rx="4" fill="url(#of_chair)"/>
    <!-- Armrests -->
    <path d="M18 52 L18 64 L24 64" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
    <path d="M62 52 L62 64 L56 64" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
    <!-- Stem & Gas Lift -->
    <rect x="37" y="77" width="6" height="18" fill="#64748b"/>
    <!-- 5-Star Caster Base -->
    <path d="M40 95 L22 104 M40 95 L58 104 M40 95 L40 106 M40 95 L28 106 M40 95 L52 106" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="20" cy="106" r="2.5" fill="#0f172a"/>
    <circle cx="60" cy="106" r="2.5" fill="#0f172a"/>
    <circle cx="40" cy="108" r="2.5" fill="#0f172a"/>
  </g>
  <!-- Office Laser Printer / Scanner -->
  <g filter="url(#of_shadow)">
    <!-- Printer main body -->
    <rect x="68" y="58" width="56" height="34" rx="5" fill="url(#of_printer)"/>
    <rect x="73" y="63" width="46" height="6" rx="2" fill="#1e293b"/>
    <!-- Control panel display -->
    <rect x="73" y="73" width="14" height="8" rx="1.5" fill="#0284c7"/>
    <circle cx="92" cy="77" r="2" fill="#22c55e"/>
    <circle cx="98" cy="77" r="2" fill="#ef4444"/>
    <!-- Paper output tray with printed sheet -->
    <rect x="74" y="85" width="44" height="16" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="80" y1="90" x2="110" y2="90" stroke="#94a3b8" stroke-width="1.5"/>
    <line x1="80" y1="95" x2="102" y2="95" stroke="#94a3b8" stroke-width="1.5"/>
    <!-- Top paper input tray -->
    <rect x="80" y="44" width="32" height="16" rx="2" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1"/>
  </g>
</svg>`,

    'tools-hardware.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="th_yellow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#facc15"/><stop offset="100%" stop-color="#ca8a04"/></linearGradient>
    <linearGradient id="th_dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <filter id="th_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.2"/></filter>
  </defs>
  <!-- Cordless Heavy Hammer Drill -->
  <g filter="url(#th_shadow)">
    <!-- Drill Body -->
    <path d="M28 35 L68 35 L68 56 L48 56 L44 88 L26 88 L30 56 L28 56 Z" fill="url(#th_yellow)" stroke="#a16207" stroke-width="1"/>
    <!-- Rubber grip inserts -->
    <rect x="30" y="60" width="14" height="24" rx="3" fill="url(#th_dark)"/>
    <line x1="32" y1="66" x2="42" y2="66" stroke="#64748b" stroke-width="1.5"/>
    <line x1="32" y1="72" x2="42" y2="72" stroke="#64748b" stroke-width="1.5"/>
    <line x1="32" y1="78" x2="42" y2="78" stroke="#64748b" stroke-width="1.5"/>
    <!-- Battery Pack -->
    <rect x="20" y="88" width="28" height="14" rx="3" fill="url(#th_dark)"/>
    <rect x="22" y="98" width="24" height="3" fill="#ef4444"/>
    <!-- Chuck & Drill bit -->
    <rect x="68" y="40" width="14" height="12" rx="2" fill="#475569"/>
    <polygon points="82,44 104,46 104,46 82,48" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
  </g>
  <!-- Circular Saw / Angle Grinder Unit -->
  <g filter="url(#th_shadow)">
    <!-- Saw blade guard -->
    <path d="M72 75 A 28 28 0 0 1 124 88 L72 88 Z" fill="url(#th_yellow)"/>
    <!-- Blade disc with teeth -->
    <circle cx="96" cy="88" r="24" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
    <circle cx="96" cy="88" r="8" fill="#334155"/>
    <circle cx="96" cy="88" r="3" fill="#f8fafc"/>
    <!-- Motor housing & handle -->
    <rect x="80" y="60" width="30" height="16" rx="4" fill="url(#th_dark)"/>
    <path d="M106 64 L124 58 L126 68 L108 72 Z" fill="url(#th_dark)"/>
  </g>
  <!-- Wrench tool in background -->
  <g transform="rotate(-30 40 40)">
    <rect x="70" y="10" width="40" height="7" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1"/>
    <circle cx="70" cy="13.5" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1"/>
    <rect x="62" y="10" width="10" height="7" fill="#ffffff"/>
  </g>
</svg>`,

    'agriculture-nursery.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="ag_green" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#15803d"/></linearGradient>
    <linearGradient id="ag_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
    <filter id="ag_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Agricultural Wheelbarrow -->
  <g filter="url(#ag_shadow)">
    <!-- Tray / Tub -->
    <polygon points="30,55 78,55 68,82 38,82" fill="url(#ag_blue)" stroke="#0284c7" stroke-width="1"/>
    <!-- Frame & Handles -->
    <path d="M22 68 L78 86 L94 86" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <!-- Support Leg -->
    <path d="M42 82 L38 98" stroke="#475569" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Front Wheel -->
    <circle cx="86" cy="94" r="14" fill="#334155" stroke="#64748b" stroke-width="2"/>
    <circle cx="86" cy="94" r="6" fill="#cbd5e1"/>
  </g>
  <!-- Motorized Garden Sprayer & Tank -->
  <g filter="url(#ag_shadow)">
    <!-- Sprayer backpack tank -->
    <rect x="76" y="40" width="28" height="42" rx="7" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
    <rect x="84" y="34" width="12" height="6" rx="2" fill="#0f172a"/>
    <rect x="80" y="52" width="20" height="12" rx="3" fill="#ffffff" opacity="0.9"/>
    <!-- Spray Lance & Nozzle -->
    <path d="M104 60 C118 60, 122 45, 122 30" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round"/>
    <polygon points="119,25 125,25 122,30" fill="#f59e0b"/>
  </g>
  <!-- Healthy Green Plant Sapling -->
  <g filter="url(#ag_shadow)">
    <!-- Terracotta pot -->
    <polygon points="40,82 56,82 53,98 43,98" fill="#c2410c"/>
    <!-- Plant stem & leaves -->
    <path d="M48 82 Q48 55 42 42" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 64 C35 58, 32 45, 44 48 C44 48, 48 56, 46 64 Z" fill="url(#ag_green)"/>
    <path d="M47 52 C58 46, 62 34, 48 38 C48 38, 45 46, 47 52 Z" fill="url(#ag_green)"/>
  </g>
</svg>`,

    'medical-supplies.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="md_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0f766e"/></linearGradient>
    <filter id="md_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Medical First Aid Kit / Equipment Case -->
  <g filter="url(#md_shadow)">
    <rect x="22" y="50" width="48" height="42" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="36" y="42" width="20" height="8" rx="3" fill="none" stroke="#0284c7" stroke-width="3"/>
    <!-- Red Cross -->
    <rect x="42" y="62" width="8" height="18" rx="2" fill="#ef4444"/>
    <rect x="37" y="67" width="18" height="8" rx="2" fill="#ef4444"/>
  </g>
  <!-- Patient Diagnostic Monitor -->
  <g filter="url(#md_shadow)">
    <!-- Monitor Bezel -->
    <rect x="68" y="38" width="52" height="40" rx="5" fill="#1e293b"/>
    <!-- Screen with ECG Waveform -->
    <rect x="72" y="42" width="44" height="30" rx="2" fill="#0f172a"/>
    <path d="M74 58 L82 58 L85 50 L88 64 L91 54 L94 58 L114 58" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="100" y="50" font-family="sans-serif" font-size="7" font-weight="bold" fill="#38bdf8">98%</text>
    <!-- Stand -->
    <rect x="90" y="78" width="8" height="14" fill="#64748b"/>
    <rect x="80" y="92" width="28" height="5" rx="2" fill="#334155"/>
  </g>
  <!-- Stethoscope -->
  <g filter="url(#md_shadow)">
    <path d="M30 85 C30 108, 65 112, 70 95" fill="none" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="72" cy="94" r="8" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <circle cx="72" cy="94" r="4" fill="#0284c7"/>
  </g>
</svg>`,

    'safety-supplies.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="sf_yellow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#eab308"/></linearGradient>
    <linearGradient id="sf_red" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
    <linearGradient id="sf_boot" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#92400e"/><stop offset="100%" stop-color="#451a03"/></linearGradient>
    <filter id="sf_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Heavy Duty Safety Shoes / Boots -->
  <g filter="url(#sf_shadow)">
    <path d="M22 68 L36 68 L36 78 L58 84 L58 98 L18 98 L18 78 Z" fill="url(#sf_boot)" stroke="#78350f" stroke-width="1"/>
    <!-- Grip Sole -->
    <rect x="16" y="96" width="44" height="8" rx="2" fill="#1e293b"/>
    <line x1="22" y1="104" x2="54" y2="104" stroke="#f59e0b" stroke-width="2"/>
    <!-- Toe Cap Reinforcement -->
    <path d="M48 84 Q58 84 58 96 L46 96 Z" fill="#b45309"/>
  </g>
  <!-- Hard Hat / Safety Helmet -->
  <g filter="url(#sf_shadow)">
    <!-- Helmet Dome -->
    <path d="M35 52 C35 28, 85 28, 85 52 Z" fill="url(#sf_yellow)" stroke="#ca8a04" stroke-width="1.5"/>
    <line x1="60" y1="30" x2="60" y2="52" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <!-- Helmet Brim -->
    <path d="M28 52 C28 50, 92 50, 92 52 L90 56 L30 56 Z" fill="#ca8a04"/>
  </g>
  <!-- Industrial Fire Extinguisher -->
  <g filter="url(#sf_shadow)">
    <!-- Red Cylinder -->
    <rect x="86" y="44" width="22" height="48" rx="8" fill="url(#sf_red)"/>
    <!-- Gauge & Handle -->
    <rect x="94" y="34" width="6" height="10" fill="#334155"/>
    <path d="M92 34 L108 28 L108 34 Z" fill="#334155"/>
    <circle cx="104" cy="38" r="4" fill="#ffffff" stroke="#334155" stroke-width="1"/>
    <!-- Hose -->
    <path d="M96 38 C116 40, 116 68, 110 74" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
    <!-- Label -->
    <rect x="88" y="58" width="18" height="16" rx="2" fill="#ffffff"/>
    <text x="91" y="68" font-family="sans-serif" font-size="6" font-weight="900" fill="#dc2626">ABC</text>
  </g>
</svg>`,

    'automobile-parts.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="au_tire" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="au_rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>
    <linearGradient id="au_oil" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dc2626"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
    <filter id="au_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.2"/></filter>
  </defs>
  <!-- Alloy Wheel & Tyre Assembly -->
  <g filter="url(#au_shadow)">
    <circle cx="50" cy="74" r="34" fill="url(#au_tire)" stroke="#0f172a" stroke-width="2"/>
    <!-- Tread marks -->
    <circle cx="50" cy="74" r="30" fill="none" stroke="#475569" stroke-width="3" stroke-dasharray="6,4"/>
    <!-- Rim -->
    <circle cx="50" cy="74" r="22" fill="url(#au_rim)" stroke="#64748b" stroke-width="2"/>
    <!-- 5 Spokes -->
    <circle cx="50" cy="74" r="7" fill="#0f172a"/>
    <line x1="50" y1="52" x2="50" y2="96" stroke="#475569" stroke-width="3"/>
    <line x1="28" y1="74" x2="72" y2="74" stroke="#475569" stroke-width="3"/>
    <line x1="34" y1="58" x2="66" y2="90" stroke="#475569" stroke-width="3"/>
  </g>
  <!-- Ventilated Disc Brake & Red Caliper -->
  <g filter="url(#au_shadow)">
    <!-- Red Caliper -->
    <path d="M68 44 Q80 34 94 40 L90 56 Q80 50 72 56 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
  </g>
  <!-- Synthetic Engine Oil Canister -->
  <g filter="url(#au_shadow)">
    <rect x="86" y="52" width="32" height="46" rx="5" fill="url(#au_oil)"/>
    <path d="M92 52 L92 40 L102 40 L102 52" fill="none" stroke="url(#au_oil)" stroke-width="4"/>
    <rect x="94" y="36" width="12" height="6" rx="1.5" fill="#f59e0b"/>
    <!-- Oil Label & Viscosity -->
    <rect x="90" y="65" width="24" height="22" rx="2" fill="#ffffff"/>
    <circle cx="102" cy="74" r="5" fill="#f59e0b"/>
    <text x="94" y="84" font-family="sans-serif" font-size="5" font-weight="bold" fill="#0f172a">5W-40</text>
  </g>
</svg>`,

    'construction-materials.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="cn_orange" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#c2410c"/></linearGradient>
    <linearGradient id="cn_cement" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>
    <filter id="cn_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Concrete / Cement Mixer Drum -->
  <g filter="url(#cn_shadow)">
    <!-- Stand -->
    <path d="M30 98 L50 65 L70 98" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <circle cx="32" cy="98" r="6" fill="#334155"/>
    <circle cx="68" cy="98" r="6" fill="#334155"/>
    <!-- Mixer Drum tilted -->
    <g transform="rotate(-25 50 60)">
      <polygon points="34,44 66,44 74,72 26,72" fill="url(#cn_orange)"/>
      <ellipse cx="50" cy="44" rx="16" ry="7" fill="#ea580c" stroke="#7c2d12" stroke-width="1.5"/>
      <circle cx="50" cy="72" r="8" fill="#334155"/>
    </g>
  </g>
  <!-- Cement Bag / Sack -->
  <g filter="url(#cn_shadow)">
    <rect x="76" y="55" width="42" height="34" rx="6" fill="url(#cn_cement)" stroke="#64748b" stroke-width="1.5"/>
    <rect x="82" y="65" width="30" height="14" rx="2" fill="#dc2626"/>
    <text x="85" y="75" font-family="sans-serif" font-size="8" font-weight="900" fill="#ffffff">CEMENT</text>
  </g>
  <!-- Masonry Bricks & Chrome Valve / Pipe -->
  <g filter="url(#cn_shadow)">
    <rect x="74" y="90" width="22" height="9" rx="1.5" fill="#b45309" stroke="#78350f" stroke-width="1"/>
    <rect x="98" y="90" width="22" height="9" rx="1.5" fill="#b45309" stroke="#78350f" stroke-width="1"/>
    <rect x="86" y="82" width="22" height="8" rx="1.5" fill="#b45309" stroke="#78350f" stroke-width="1"/>
  </g>
</svg>`,

    'industrial-chemicals.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="ch_teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0f766e"/></linearGradient>
    <linearGradient id="ch_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e40af"/></linearGradient>
    <filter id="ch_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Industrial Chemical Storage Drum -->
  <g filter="url(#ch_shadow)">
    <rect x="22" y="44" width="40" height="54" rx="6" fill="url(#ch_blue)"/>
    <!-- Drum Rings -->
    <line x1="22" y1="58" x2="62" y2="58" stroke="#38bdf8" stroke-width="2"/>
    <line x1="22" y1="78" x2="62" y2="78" stroke="#38bdf8" stroke-width="2"/>
    <!-- Hazard Diamond -->
    <g transform="translate(36, 62) rotate(45)">
      <rect width="10" height="10" fill="#facc15" stroke="#ca8a04" stroke-width="1"/>
    </g>
  </g>
  <!-- Glass Laboratory Conical Flask (Erlenmeyer) -->
  <g filter="url(#ch_shadow)">
    <path d="M84 40 L94 40 L94 54 L114 88 Q116 92 110 92 L68 92 Q62 92 64 88 L84 54 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" opacity="0.9"/>
    <!-- Teal Chemical Liquid -->
    <path d="M72 80 L106 80 L112 88 Q114 90 108 90 L70 90 Q64 90 66 88 Z" fill="url(#ch_teal)"/>
    <!-- Bubbles -->
    <circle cx="86" cy="74" r="3" fill="#2dd4bf"/>
    <circle cx="96" cy="70" r="2" fill="#2dd4bf"/>
    <circle cx="90" cy="62" r="1.5" fill="#2dd4bf"/>
  </g>
</svg>`,

    'refractories.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="rf_fire" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
    <linearGradient id="rf_brick" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#7c2d12"/></linearGradient>
    <filter id="rf_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Industrial Smelting Crucible / Ladle with Molten Metal Glow -->
  <g filter="url(#rf_shadow)">
    <!-- Crucible Pot -->
    <path d="M68 36 L118 36 L112 86 Q110 94 93 94 Q76 94 74 86 Z" fill="#334155" stroke="#1e293b" stroke-width="2"/>
    <!-- Molten Golden Liquid Inside -->
    <ellipse cx="93" cy="42" rx="20" ry="7" fill="#fbbf24"/>
    <ellipse cx="93" cy="42" rx="14" ry="4" fill="#fef08a"/>
    <!-- Heat Glow Waves -->
    <path d="M85 28 Q88 18 93 28 Q98 18 101 28" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
  </g>
  <!-- Interlocking Refractory Firebricks Stack -->
  <g filter="url(#rf_shadow)">
    <rect x="22" y="78" width="46" height="18" rx="2" fill="url(#rf_brick)" stroke="#451a03" stroke-width="1.5"/>
    <rect x="30" y="60" width="44" height="18" rx="2" fill="url(#rf_brick)" stroke="#451a03" stroke-width="1.5"/>
    <rect x="24" y="42" width="42" height="18" rx="2" fill="url(#rf_brick)" stroke="#451a03" stroke-width="1.5"/>
    <!-- Mortar / joints -->
    <line x1="45" y1="78" x2="45" y2="96" stroke="#fb923c" stroke-width="1.5"/>
    <line x1="52" y1="60" x2="52" y2="78" stroke="#fb923c" stroke-width="1.5"/>
  </g>
</svg>`,

    'tyres-rubber.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="tr_dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <filter id="tr_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.2"/></filter>
  </defs>
  <!-- Heavy Industrial Treaded Tyres Stack -->
  <g filter="url(#tr_shadow)">
    <!-- Rear tyre -->
    <ellipse cx="86" cy="62" rx="32" ry="34" fill="url(#tr_dark)" stroke="#0f172a" stroke-width="2"/>
    <ellipse cx="86" cy="62" rx="16" ry="17" fill="#f8fafc"/>
    <!-- Deep Treads -->
    <circle cx="86" cy="62" r="28" fill="none" stroke="#64748b" stroke-width="4" stroke-dasharray="8,6"/>
  </g>
  <g filter="url(#tr_shadow)">
    <!-- Front Tyre tilted -->
    <ellipse cx="50" cy="78" rx="30" ry="24" fill="url(#tr_dark)" stroke="#0f172a" stroke-width="2"/>
    <ellipse cx="50" cy="78" rx="15" ry="11" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <!-- Rubber O-rings & V-belts -->
    <ellipse cx="50" cy="78" r="5" fill="#0f172a"/>
  </g>
  <!-- Rubber Belt Roll -->
  <g filter="url(#tr_shadow)">
    <rect x="75" y="80" width="44" height="18" rx="5" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <line x1="80" y1="86" x2="114" y2="86" stroke="#94a3b8" stroke-width="2"/>
    <line x1="80" y1="92" x2="114" y2="92" stroke="#94a3b8" stroke-width="2"/>
  </g>
</svg>`,

    'it-computer.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="it_screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient>
    <filter id="it_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Desktop Monitor / Screen -->
  <g filter="url(#it_shadow)">
    <!-- Monitor Bezel -->
    <rect x="25" y="32" width="62" height="44" rx="4" fill="#0f172a"/>
    <!-- Screen Glass -->
    <rect x="28" y="35" width="56" height="36" rx="2" fill="url(#it_screen)"/>
    <line x1="34" y1="44" x2="60" y2="44" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="34" y1="50" x2="72" y2="50" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="34" y1="56" x2="52" y2="56" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <!-- Stand -->
    <rect x="52" y="76" width="8" height="12" fill="#64748b"/>
    <rect x="42" y="88" width="28" height="4" rx="2" fill="#334155"/>
  </g>
  <!-- Modern Laptop Open -->
  <g filter="url(#it_shadow)">
    <polygon points="68,64 112,64 118,92 62,92" fill="#334155"/>
    <polygon points="72,67 108,67 114,88 66,88" fill="url(#it_screen)"/>
    <!-- Base -->
    <polygon points="56,92 124,92 128,98 52,98" fill="#94a3b8"/>
    <rect x="80" y="93" width="20" height="3" rx="1" fill="#64748b"/>
  </g>
  <!-- Server Tower / Router with WiFi -->
  <g filter="url(#it_shadow)">
    <rect x="94" y="36" width="24" height="48" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <circle cx="106" cy="46" r="2" fill="#22c55e"/>
    <circle cx="106" cy="54" r="2" fill="#38bdf8"/>
    <line x1="98" y1="64" x2="114" y2="64" stroke="#475569" stroke-width="1.5"/>
    <line x1="98" y1="72" x2="114" y2="72" stroke="#475569" stroke-width="1.5"/>
  </g>
</svg>`,

    'steel-metal.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="st_metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/></linearGradient>
    <filter id="st_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Heavy Structural Steel I-Beam -->
  <g filter="url(#st_shadow)">
    <path d="M25 35 L65 35 L65 43 L50 43 L50 77 L65 77 L65 85 L25 85 L25 77 L40 77 L40 43 L25 43 Z" fill="url(#st_metal)" stroke="#1e293b" stroke-width="1.5"/>
  </g>
  <!-- Rolled Metal Steel Coil -->
  <g filter="url(#st_shadow)">
    <ellipse cx="94" cy="62" rx="26" ry="28" fill="url(#st_metal)" stroke="#1e293b" stroke-width="2"/>
    <ellipse cx="94" cy="62" rx="14" ry="15" fill="#f8fafc" stroke="#475569" stroke-width="2"/>
    <ellipse cx="94" cy="62" rx="6" ry="7" fill="#334155"/>
  </g>
  <!-- Rebar steel rods bundle -->
  <g filter="url(#st_shadow)">
    <line x1="30" y1="94" x2="114" y2="94" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
    <line x1="34" y1="90" x2="110" y2="90" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`,

    'hydraulics-pneumatics.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="hy_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
    <filter id="hy_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Chrome Hydraulic Piston Cylinder -->
  <g filter="url(#hy_shadow)">
    <rect x="25" y="58" width="56" height="24" rx="4" fill="url(#hy_blue)" stroke="#0369a1" stroke-width="1.5"/>
    <!-- Piston Rod Extended -->
    <rect x="81" y="65" width="34" height="10" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>
    <circle cx="118" cy="70" r="5" fill="#475569"/>
    <!-- Mounting clevis -->
    <circle cx="22" cy="70" r="6" fill="#334155"/>
  </g>
  <!-- Brass Pressure Gauge with Dial -->
  <g filter="url(#hy_shadow)">
    <circle cx="68" cy="38" r="16" fill="#ffffff" stroke="#f59e0b" stroke-width="3"/>
    <path d="M68 38 L76 32" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
    <circle cx="68" cy="38" r="3" fill="#0f172a"/>
    <rect x="65" y="54" width="6" height="6" fill="#f59e0b"/>
  </g>
</svg>`,

    'packaging-printing.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="pk_kraft" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d97706"/><stop offset="100%" stop-color="#92400e"/></linearGradient>
    <filter id="pk_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Corrugated Shipping Boxes Stack -->
  <g filter="url(#pk_shadow)">
    <!-- Base large box -->
    <polygon points="30,68 65,52 100,68 65,84" fill="#f59e0b"/>
    <polygon points="30,68 65,84 65,104 30,88" fill="url(#pk_kraft)"/>
    <polygon points="100,68 65,84 65,104 100,88" fill="#b45309"/>
    <!-- Top small box -->
    <polygon points="45,44 70,32 95,44 70,56" fill="#fcd34d"/>
    <polygon points="45,44 70,56 70,72 45,60" fill="url(#pk_kraft)"/>
    <polygon points="95,44 70,56 70,72 95,60" fill="#b45309"/>
    <!-- Fragile Tape / Label -->
    <line x1="55" y1="51" x2="85" y2="37" stroke="#dc2626" stroke-width="2.5"/>
  </g>
</svg>`,

    'textiles-garments.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="tx_pink" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#be185d"/></linearGradient>
    <linearGradient id="tx_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e40af"/></linearGradient>
    <filter id="tx_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Fabric Roll in Pink -->
  <g filter="url(#tx_shadow)">
    <ellipse cx="40" cy="50" rx="14" ry="24" fill="url(#tx_pink)"/>
    <ellipse cx="40" cy="50" rx="6" ry="12" fill="#fdf2f8"/>
    <path d="M40 26 L94 40 L94 88 L40 74 Z" fill="url(#tx_pink)"/>
  </g>
  <!-- Safety Reflective Uniform / Shirt -->
  <g filter="url(#tx_shadow)">
    <path d="M75 58 L95 44 L115 58 L108 88 L82 88 Z" fill="#22c55e" stroke="#15803d" stroke-width="1.5"/>
    <line x1="80" y1="72" x2="110" y2="72" stroke="#ffffff" stroke-width="3"/>
  </g>
</svg>`,

    'shg-handicrafts.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="sh_pot" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>
    <linearGradient id="sh_weave" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
    <filter id="sh_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Handcrafted Terracotta Clay Pot -->
  <g filter="url(#sh_shadow)">
    <ellipse cx="46" cy="48" rx="16" ry="6" fill="#fdba74" stroke="#c2410c" stroke-width="1.5"/>
    <path d="M30 48 Q18 70 38 88 Q46 94 54 88 Q74 70 62 48 Z" fill="url(#sh_pot)"/>
    <ellipse cx="46" cy="66" rx="14" ry="4" fill="none" stroke="#fef08a" stroke-width="2"/>
  </g>
  <!-- Handwoven Bamboo / Cane Basket -->
  <g filter="url(#sh_shadow)">
    <polygon points="68,54 116,54 106,92 78,92" fill="url(#sh_weave)" stroke="#78350f" stroke-width="1.5"/>
    <!-- Weave lines -->
    <line x1="72" y1="66" x2="112" y2="66" stroke="#fde68a" stroke-width="2"/>
    <line x1="76" y1="78" x2="108" y2="78" stroke="#fde68a" stroke-width="2"/>
    <path d="M76 54 Q92 32 108 54" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>`,

    'fuel-oil-gas.svg': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="fl_blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
    <linearGradient id="fl_red" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
    <filter id="fl_shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.18"/></filter>
  </defs>
  <!-- Petroleum Oil Drum -->
  <g filter="url(#fl_shadow)">
    <rect x="26" y="44" width="42" height="54" rx="6" fill="url(#fl_blue)"/>
    <line x1="26" y1="58" x2="68" y2="58" stroke="#38bdf8" stroke-width="2"/>
    <line x1="26" y1="78" x2="68" y2="78" stroke="#38bdf8" stroke-width="2"/>
    <!-- Flame icon -->
    <path d="M47 62 C43 68 40 72 47 78 C54 72 51 68 47 62 Z" fill="#fbbf24"/>
  </g>
  <!-- LPG / High-pressure Industrial Gas Cylinder -->
  <g filter="url(#fl_shadow)">
    <rect x="80" y="46" width="30" height="52" rx="12" fill="url(#fl_red)"/>
    <!-- Guard Collar & Valve -->
    <rect x="87" y="36" width="16" height="10" rx="3" fill="#334155"/>
    <rect x="92" y="30" width="6" height="6" fill="#f59e0b"/>
  </g>
</svg>`,
};

for (const [filename, content] of Object.entries(icons)) {
    const fullPath = path.join(targetDir, filename);
    fs.writeFileSync(fullPath, content.trim(), 'utf8');
    console.log(`Generated ${filename}`);
}

console.log('All category icons generated successfully!');
