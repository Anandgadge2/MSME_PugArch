import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const frontendPublic = path.resolve(repoRoot, 'frontend/public');
const backendUploads = path.resolve(repoRoot, 'backend/uploads');

const ensureDirs = () => {
  ['products', 'org-logos', 'banners'].forEach(dir => {
    fs.mkdirSync(path.join(frontendPublic, dir), { recursive: true });
    fs.mkdirSync(path.join(backendUploads, dir), { recursive: true });
  });
};

const saveAsset = (subDir: string, fileName: string, content: string) => {
  const fPath = path.join(frontendPublic, subDir, fileName);
  const bPath = path.join(backendUploads, subDir, fileName);
  fs.writeFileSync(fPath, content, 'utf-8');
  fs.writeFileSync(bPath, content, 'utf-8');
};

// Studio wrapper template that gives realistic product photography lighting, subtle floor reflection & shadow
function studioWrap(content: string, ratingBadge?: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <!-- Studio Lighting Backdrop -->
    <radialGradient id="studioBg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="70%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </radialGradient>
    
    <!-- Realistic Ground Contact Shadow -->
    <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(15, 23, 42, 0.28)" />
      <stop offset="50%" stop-color="rgba(15, 23, 42, 0.12)" />
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0)" />
    </radialGradient>
    
    <!-- Chrome / Metallic Highlights -->
    <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f1f5f9" />
      <stop offset="25%" stop-color="#94a3b8" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="75%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>

    <!-- Copper / Brass Metallic Gradient -->
    <linearGradient id="copperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdba74" />
      <stop offset="35%" stop-color="#ea580c" />
      <stop offset="70%" stop-color="#fed7aa" />
      <stop offset="100%" stop-color="#c2410c" />
    </linearGradient>

    <!-- Steel / Dark Metal Gradient -->
    <linearGradient id="darkMetal" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <!-- Blue Industrial Power Tool Paint -->
    <linearGradient id="toolBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="40%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>

    <!-- Orange Industrial Paint -->
    <linearGradient id="safetyOrange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="50%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#c2410c" />
    </linearGradient>

    <!-- Red Industrial Paint -->
    <linearGradient id="dangerRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f87171" />
      <stop offset="50%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#991b1b" />
    </linearGradient>

    <!-- Yellow Industrial Paint -->
    <linearGradient id="cautionYellow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047" />
      <stop offset="40%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>

    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>

  <!-- Clean Studio Background -->
  <rect width="500" height="500" rx="16" fill="url(#studioBg)" />

  <!-- Ground Contact Shadow -->
  <ellipse cx="250" cy="425" rx="180" ry="24" fill="url(#contactShadow)" />
  <ellipse cx="250" cy="422" rx="120" ry="14" fill="url(#contactShadow)" opacity="0.8" />

  <!-- Realistic Product Artwork Container -->
  <g filter="url(#softGlow)">
    ${content}
  </g>

  ${ratingBadge ? `
  <g transform="translate(24, 24)">
    <rect width="78" height="24" rx="6" fill="#15803d" />
    <text x="14" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff">★ ${ratingBadge}</text>
  </g>
  ` : ''}
</svg>
`.trim();
}

// -------------------------------------------------------------
// Detailed Realistic Product Renderers
// -------------------------------------------------------------

export const realisticDrawings: Record<string, () => string> = {
  // 1. Pneumatic Impact Wrench
  'impact-wrench': () => `
    <g transform="translate(110, 80)">
      <!-- Handle / Grip -->
      <path d="M110 180 L140 330 C143 345 130 355 115 355 L90 355 C75 355 65 342 60 328 L50 180 Z" fill="#1e293b" stroke="#0f172a" stroke-width="3" />
      <!-- Ergonomic rubber grips -->
      <rect x="75" y="220" width="45" height="12" rx="4" fill="#334155" />
      <rect x="79" y="245" width="45" height="12" rx="4" fill="#334155" />
      <rect x="83" y="270" width="45" height="12" rx="4" fill="#334155" />
      <rect x="87" y="295" width="45" height="12" rx="4" fill="#334155" />
      <!-- Air Inlet Brass Nipple at Base -->
      <rect x="80" y="355" width="22" height="25" rx="3" fill="url(#copperGrad)" stroke="#7c2d12" stroke-width="1.5" />
      <rect x="84" y="380" width="14" height="15" rx="2" fill="url(#chromeGrad)" />
      <!-- Main Motor Housing -->
      <rect x="30" y="70" width="180" height="120" rx="28" fill="url(#darkMetal)" stroke="#334155" stroke-width="4" />
      <rect x="35" y="78" width="170" height="15" rx="7" fill="url(#safetyOrange)" />
      <!-- Back Cap / Direction Lever -->
      <rect x="180" y="90" width="45" height="80" rx="16" fill="#334155" stroke="#0f172a" stroke-width="3" />
      <circle cx="202" cy="130" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
      <!-- Front Hammer Casing (Polished Aluminum) -->
      <path d="M40 85 L-20 100 L-20 160 L40 175 Z" fill="url(#chromeGrad)" stroke="#64748b" stroke-width="3" />
      <!-- 1" Square Drive Anvil -->
      <rect x="-60" y="115" width="40" height="30" rx="4" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <circle cx="-40" cy="130" r="5" fill="#f8fafc" />
      <!-- Trigger -->
      <path d="M48 200 C48 185 30 185 30 200 L35 230 C35 240 48 240 48 230 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
      <!-- Brand & Spec Badge -->
      <rect x="65" y="115" width="90" height="35" rx="6" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
      <text x="110" y="132" font-family="sans-serif" font-size="10" font-weight="900" fill="#f8fafc" text-anchor="middle">HEAVY DUTY 1"</text>
      <text x="110" y="144" font-family="sans-serif" font-size="8" font-weight="700" fill="#38bdf8" text-anchor="middle">2600 Nm TWIN HAMMER</text>
    </g>
  `,

  // 2. Inverter Arc Welder
  'arc-welder': () => `
    <g transform="translate(90, 70)">
      <!-- Welder Body -->
      <rect x="40" y="80" width="240" height="230" rx="24" fill="url(#safetyOrange)" stroke="#9a3412" stroke-width="4" />
      <!-- Top Handle -->
      <path d="M90 80 L90 35 C90 20 230 20 230 35 L230 80" fill="none" stroke="#1e293b" stroke-width="16" stroke-linecap="round" />
      <!-- Front Panel Insert (Matte Black) -->
      <rect x="60" y="100" width="200" height="190" rx="14" fill="#0f172a" stroke="#334155" stroke-width="2" />
      <!-- Digital LED Amp Readout -->
      <rect x="80" y="120" width="80" height="42" rx="6" fill="#1e293b" stroke="#475569" stroke-width="2" />
      <text x="120" y="152" font-family="'Courier New', monospace" font-size="28" font-weight="900" fill="#22c55e" text-anchor="middle" letter-spacing="2">400</text>
      <text x="175" y="135" font-family="sans-serif" font-size="10" font-weight="800" fill="#94a3b8">AMPS</text>
      <!-- Current Adjustment Knob -->
      <circle cx="215" cy="142" r="18" fill="url(#darkMetal)" stroke="#94a3b8" stroke-width="2" />
      <line x1="215" y1="142" x2="225" y2="132" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
      <!-- Cooling Air Grille Slots -->
      <g stroke="#334155" stroke-width="3" stroke-linecap="round">
        <line x1="80" y1="185" x2="240" y2="185" />
        <line x1="80" y1="195" x2="240" y2="195" />
        <line x1="80" y1="205" x2="240" y2="205" />
        <line x1="80" y1="215" x2="240" y2="215" />
      </g>
      <!-- Positive (+) and Negative (-) Brass DINSE Sockets -->
      <circle cx="100" cy="255" r="16" fill="url(#dangerRed)" stroke="#7f1d1d" stroke-width="2" />
      <circle cx="100" cy="255" r="8" fill="url(#copperGrad)" />
      <text x="100" y="248" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">+</text>

      <circle cx="220" cy="255" r="16" fill="#1e293b" stroke="#475569" stroke-width="2" />
      <circle cx="220" cy="255" r="8" fill="url(#copperGrad)" />
      <text x="220" y="248" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">-</text>

      <!-- Welding Cable with Electrode Holder coiled in front -->
      <path d="M100 270 C100 350 -30 320 -10 370 C10 400 120 380 160 370" fill="none" stroke="#dc2626" stroke-width="12" stroke-linecap="round" />
      <rect x="150" y="345" width="80" height="25" rx="6" fill="#1e293b" transform="rotate(-15 150 345)" stroke="#ea580c" stroke-width="2" />
    </g>
  `,

  // 3. Welding Electrodes Box + Rods
  'welding-electrodes': () => `
    <g transform="translate(100, 70)">
      <!-- 3D Packaging Box -->
      <polygon points="60,90 220,50 280,80 120,120" fill="#1e40af" stroke="#1d4ed8" stroke-width="2" />
      <polygon points="60,90 120,120 120,330 60,300" fill="#1e3a8a" stroke="#172554" stroke-width="2" />
      <polygon points="120,120 280,80 280,290 120,330" fill="#2563eb" stroke="#1d4ed8" stroke-width="2" />
      <!-- Box Branding -->
      <text x="200" y="160" font-family="sans-serif" font-size="20" font-weight="900" fill="#ffffff" transform="rotate(-14 200 160)">E7018</text>
      <text x="195" y="185" font-family="sans-serif" font-size="11" font-weight="700" fill="#fbbf24" transform="rotate(-14 195 185)">LOW HYDROGEN</text>
      <text x="190" y="210" font-family="sans-serif" font-size="9" font-weight="600" fill="#93c5fd" transform="rotate(-14 190 210)">4.00mm x 450mm • 20 KG</text>
      <rect x="155" y="235" width="90" height="20" rx="4" fill="#dc2626" transform="rotate(-14 155 235)" />
      <text x="200" y="249" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(-14 200 249)">ISI CERTIFIED</text>
      <!-- Actual Electrodes Fanned Out in Front -->
      <g stroke="#94a3b8" stroke-width="6" stroke-linecap="round">
        <line x1="20" y1="360" x2="200" y2="110" />
        <line x1="35" y1="365" x2="215" y2="115" />
        <line x1="50" y1="370" x2="230" y2="120" />
        <line x1="65" y1="375" x2="245" y2="125" />
      </g>
      <!-- Core wire tips (copper / raw steel) -->
      <g stroke="#f59e0b" stroke-width="6" stroke-linecap="round">
        <line x1="195" y1="117" x2="200" y2="110" />
        <line x1="210" y1="122" x2="215" y2="115" />
        <line x1="225" y1="127" x2="230" y2="120" />
        <line x1="240" y1="132" x2="245" y2="125" />
      </g>
    </g>
  `,

  // 4. Heavy Lifting Chain & Hook
  'lifting-chain': () => `
    <g transform="translate(100, 60)">
      <!-- Master Oblong Link Top -->
      <ellipse cx="150" cy="50" rx="35" ry="50" fill="none" stroke="url(#safetyOrange)" stroke-width="18" />
      <!-- Chain Links Cascade -->
      <g fill="none" stroke="url(#darkMetal)" stroke-width="15">
        <ellipse cx="150" cy="120" rx="20" ry="35" />
        <ellipse cx="150" cy="170" rx="20" ry="35" transform="rotate(90 150 170)" />
        <ellipse cx="150" cy="220" rx="20" ry="35" />
        <ellipse cx="150" cy="270" rx="20" ry="35" transform="rotate(90 150 270)" />
      </g>
      <!-- Heavy Forged Red Swivel Eye Hook -->
      <g transform="translate(100, 270)">
        <!-- Hook Eye -->
        <circle cx="50" cy="30" r="22" fill="none" stroke="url(#dangerRed)" stroke-width="14" />
        <!-- Hook Body -->
        <path d="M50 45 C50 100 110 110 110 70 C110 30 75 25 70 50 C65 70 30 75 30 45 Z" fill="url(#dangerRed)" stroke="#7f1d1d" stroke-width="2" />
        <!-- Spring Safety Latch (Silver) -->
        <line x1="50" y1="50" x2="90" y2="70" stroke="url(#chromeGrad)" stroke-width="5" stroke-linecap="round" />
        <circle cx="50" cy="50" r="4" fill="#0f172a" />
        <!-- Grade 80 Stamp -->
        <text x="68" y="95" font-family="sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">G80 • 5T</text>
      </g>
    </g>
  `,

  // 5. Full Body Safety Harness
  'safety-harness': () => `
    <g transform="translate(100, 60)">
      <!-- Dorsal D-Ring -->
      <path d="M135 70 L165 70 L160 95 L140 95 Z" fill="none" stroke="url(#chromeGrad)" stroke-width="8" />
      <!-- Shoulder Straps (Neon Green/Yellow with black stitching) -->
      <path d="M90 300 L110 140 L135 80 L165 80 L190 140 L210 300" fill="none" stroke="#84cc16" stroke-width="22" stroke-linecap="round" />
      <path d="M90 300 L110 140 L135 80 L165 80 L190 140 L210 300" fill="none" stroke="#15803d" stroke-width="4" stroke-dasharray="6,4" stroke-linecap="round" />
      <!-- Chest Strap with Quick-Connect Buckle -->
      <rect x="110" y="160" width="80" height="18" rx="4" fill="#0284c7" />
      <rect x="140" y="155" width="22" height="28" rx="4" fill="url(#chromeGrad)" stroke="#334155" stroke-width="2" />
      <!-- Waist Belt / Pad -->
      <rect x="65" y="250" width="170" height="24" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="3" />
      <!-- Leg Loops -->
      <ellipse cx="100" cy="330" rx="35" ry="40" fill="none" stroke="#84cc16" stroke-width="20" />
      <ellipse cx="200" cy="330" rx="35" ry="40" fill="none" stroke="#84cc16" stroke-width="20" />
      <!-- Dual Scaffold Snap Hooks attached -->
      <g transform="translate(20, 160) rotate(-25)">
        <path d="M20 0 L40 0 C55 0 65 20 50 40 L30 80 L15 65 Z" fill="url(#chromeGrad)" stroke="#475569" stroke-width="3" />
        <rect x="25" y="25" width="10" height="40" rx="3" fill="#eab308" />
      </g>
    </g>
  `,

  // 6. Steel Toe Safety Shoe
  'safety-shoe': () => `
    <g transform="translate(70, 100)">
      <!-- Lugged Oil/Acid Resistant Sole -->
      <path d="M30 240 L330 240 C350 240 360 225 350 215 L320 215 L300 200 L110 200 L70 205 L30 215 Z" fill="#0f172a" />
      <!-- Deep Tread Grips under sole -->
      <g fill="#ea580c">
        <rect x="50" y="240" width="15" height="10" rx="2" />
        <rect x="75" y="240" width="15" height="10" rx="2" />
        <rect x="100" y="240" width="15" height="10" rx="2" />
        <rect x="125" y="240" width="15" height="10" rx="2" />
        <rect x="150" y="240" width="15" height="10" rx="2" />
        <rect x="240" y="240" width="18" height="10" rx="2" />
        <rect x="270" y="240" width="18" height="10" rx="2" />
        <rect x="300" y="240" width="18" height="10" rx="2" />
      </g>
      <!-- Leather Upper Boot Body -->
      <path d="M60 215 C60 160 90 90 120 70 L180 70 C190 90 190 140 230 160 L310 180 C345 190 355 215 320 215 Z" fill="#1e293b" stroke="#0f172a" stroke-width="4" />
      <!-- Padded Orange Ankle Collar -->
      <path d="M120 70 C140 60 170 60 180 70 L175 100 L125 100 Z" fill="url(#safetyOrange)" />
      <!-- Steel Toe Cap Contour Highlight -->
      <path d="M260 170 C295 175 340 195 330 215 L260 215 Z" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="4,3" />
      <!-- Laces & Brass Eyelets -->
      <g fill="none" stroke="#f97316" stroke-width="3">
        <line x1="145" y1="105" x2="165" y2="120" />
        <line x1="155" y1="120" x2="175" y2="135" />
        <line x1="165" y1="135" x2="185" y2="150" />
        <line x1="175" y1="150" x2="200" y2="165" />
      </g>
      <circle cx="145" cy="105" r="4" fill="url(#copperGrad)" />
      <circle cx="165" cy="120" r="4" fill="url(#copperGrad)" />
      <circle cx="155" cy="120" r="4" fill="url(#copperGrad)" />
      <circle cx="175" cy="135" r="4" fill="url(#copperGrad)" />
      <!-- S3 Badge -->
      <rect x="80" y="140" width="38" height="18" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
      <text x="99" y="153" font-family="sans-serif" font-size="9" font-weight="900" fill="#38bdf8" text-anchor="middle">S3 SRC</text>
    </g>
  `,

  // 7. Fire Extinguisher 9KG ABC
  'fire-extinguisher': () => `
    <g transform="translate(160, 50)">
      <!-- Cylinder Body -->
      <rect x="40" y="110" width="100" height="230" rx="35" fill="url(#dangerRed)" stroke="#7f1d1d" stroke-width="4" />
      <!-- Top Neck & Brass Valve -->
      <rect x="75" y="85" width="30" height="28" rx="4" fill="url(#copperGrad)" stroke="#7c2d12" stroke-width="1.5" />
      <!-- Pressure Gauge -->
      <circle cx="65" cy="85" r="14" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
      <path d="M57 85 A8 8 0 0 1 73 85" fill="none" stroke="#22c55e" stroke-width="4" />
      <line x1="65" y1="85" x2="67" y2="77" stroke="#dc2626" stroke-width="2" />
      <!-- Squeeze Handle / Lever -->
      <path d="M85 85 L135 60 C140 58 145 65 140 70 L95 95" fill="url(#chromeGrad)" stroke="#334155" stroke-width="2" />
      <path d="M85 98 L140 98" fill="none" stroke="url(#chromeGrad)" stroke-width="8" stroke-linecap="round" />
      <!-- Discharge Hose with Nozzle -->
      <path d="M100 90 C150 90 165 160 160 260 L155 310" fill="none" stroke="#0f172a" stroke-width="12" stroke-linecap="round" />
      <rect x="148" y="280" width="14" height="35" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1" />
      <!-- Commercial Label Stencil -->
      <rect x="48" y="150" width="84" height="110" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
      <rect x="52" y="156" width="76" height="22" rx="3" fill="#0284c7" />
      <text x="90" y="171" font-family="sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">POWDER</text>
      <text x="90" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#dc2626" text-anchor="middle">9 KG</text>
      <text x="90" y="215" font-family="sans-serif" font-size="11" font-weight="800" fill="#0f172a" text-anchor="middle">A • B • C</text>
      <rect x="55" y="225" width="70" height="14" rx="3" fill="#15803d" />
      <text x="90" y="235" font-family="sans-serif" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">ISI MARKED</text>
    </g>
  `,

  // 8. Industrial Induction Electric Motor
  'electric-motor': () => `
    <g transform="translate(100, 70)">
      <!-- Cast Iron Motor Body with Cooling Fins -->
      <rect x="70" y="90" width="170" height="180" rx="20" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="4" />
      <!-- Ribbed Cooling Fins -->
      <g stroke="#075985" stroke-width="4">
        <line x1="90" y1="90" x2="90" y2="270" />
        <line x1="110" y1="90" x2="110" y2="270" />
        <line x1="130" y1="90" x2="130" y2="270" />
        <line x1="150" y1="90" x2="150" y2="270" />
        <line x1="170" y1="90" x2="170" y2="270" />
        <line x1="190" y1="90" x2="190" y2="270" />
        <line x1="210" y1="90" x2="210" y2="270" />
      </g>
      <!-- Top Terminal Connection Box -->
      <rect x="110" y="55" width="90" height="40" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
      <!-- Rear Fan Cowl -->
      <path d="M240 100 C270 100 270 260 240 260 Z" fill="#1e293b" stroke="#0f172a" stroke-width="3" />
      <!-- Drive Shaft (Precision Steel Ground) -->
      <rect x="15" y="155" width="60" height="45" rx="4" fill="url(#chromeGrad)" stroke="#64748b" stroke-width="2" />
      <rect x="25" y="165" width="35" height="8" rx="2" fill="#0f172a" /> <!-- Keyway -->
      <!-- Mounting Feet -->
      <rect x="60" y="260" width="40" height="25" rx="4" fill="#0369a1" stroke="#0f172a" stroke-width="2" />
      <rect x="200" y="260" width="40" height="25" rx="4" fill="#0369a1" stroke="#0f172a" stroke-width="2" />
      <circle cx="80" cy="275" r="5" fill="#0f172a" />
      <circle cx="220" cy="275" r="5" fill="#0f172a" />
      <!-- Specification Nameplate -->
      <rect x="115" y="130" width="80" height="45" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="1" />
      <text x="155" y="146" font-family="sans-serif" font-size="10" font-weight="900" fill="#0369a1" text-anchor="middle">IE3 PREMIUM</text>
      <text x="155" y="160" font-family="sans-serif" font-size="9" font-weight="800" fill="#0f172a" text-anchor="middle">25 HP • 1440 RPM</text>
      <text x="155" y="170" font-family="sans-serif" font-size="7" font-weight="700" fill="#64748b" text-anchor="middle">415V • 3-PHASE</text>
    </g>
  `,

  // 9. MCCB Circuit Breaker
  'mccb-breaker': () => `
    <g transform="translate(120, 60)">
      <!-- Main Molded Case -->
      <rect x="30" y="50" width="200" height="280" rx="14" fill="#334155" stroke="#1e293b" stroke-width="4" />
      <!-- Front Cover Inset (Light Industrial Gray) -->
      <rect x="45" y="80" width="170" height="220" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2" />
      <!-- 4 Phase Terminals Top & Bottom -->
      <g fill="url(#copperGrad)" stroke="#7c2d12" stroke-width="1.5">
        <rect x="55" y="30" width="20" height="25" rx="3" />
        <rect x="95" y="30" width="20" height="25" rx="3" />
        <rect x="135" y="30" width="20" height="25" rx="3" />
        <rect x="175" y="30" width="20" height="25" rx="3" />

        <rect x="55" y="325" width="20" height="25" rx="3" />
        <rect x="95" y="325" width="20" height="25" rx="3" />
        <rect x="135" y="325" width="20" height="25" rx="3" />
        <rect x="175" y="325" width="20" height="25" rx="3" />
      </g>
      <!-- Center Red Operating Toggle Switch -->
      <rect x="105" y="140" width="50" height="70" rx="6" fill="#0f172a" />
      <rect x="115" y="145" width="30" height="40" rx="4" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
      <text x="130" y="168" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">ON</text>
      <!-- Push to Trip Button -->
      <circle cx="75" cy="250" r="10" fill="#eab308" stroke="#ca8a04" stroke-width="1.5" />
      <text x="75" y="270" font-family="sans-serif" font-size="7" font-weight="800" fill="#334155" text-anchor="middle">TRIP</text>
      <!-- Rating Text -->
      <text x="130" y="115" font-family="sans-serif" font-size="14" font-weight="900" fill="#0f172a" text-anchor="middle">400A • 4P</text>
      <text x="130" y="130" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">36kA • 415V AC</text>
    </g>
  `,

  // 10. Armoured Power Cable Roll & Drum
  'power-cable': () => `
    <g transform="translate(100, 70)">
      <!-- Unpacked Coiled Wire Roll (Bright Red Industrial FR-PVC) -->
      <g fill="none" stroke="#dc2626" stroke-width="14" stroke-linecap="round">
        <ellipse cx="150" cy="220" rx="110" ry="60" />
        <ellipse cx="150" cy="205" rx="100" ry="55" />
        <ellipse cx="150" cy="190" rx="90" ry="50" />
        <ellipse cx="150" cy="175" rx="80" ry="45" />
        <ellipse cx="150" cy="160" rx="70" ry="40" />
      </g>
      <!-- Packaging Box Behind -->
      <g transform="translate(20, 20)">
        <polygon points="10,60 120,30 170,50 60,80" fill="#b91c1c" />
        <polygon points="10,60 60,80 60,200 10,180" fill="#991b1b" />
        <polygon points="60,80 170,50 170,170 60,200" fill="#dc2626" />
        <text x="110" y="110" font-family="sans-serif" font-size="16" font-weight="900" fill="#ffffff" transform="rotate(-12 110 110)">FAB 1.0</text>
        <text x="105" y="130" font-family="sans-serif" font-size="8" font-weight="700" fill="#fef08a" transform="rotate(-12 105 130)">100% COPPER</text>
      </g>
      <!-- Stripped Cable End Showing Multi-Core Conductors & Steel Armour -->
      <g transform="translate(210, 220)">
        <!-- Outer Black Sheath -->
        <rect x="0" y="0" width="50" height="26" rx="4" fill="#0f172a" transform="rotate(-25)" />
        <!-- Galvanized Steel Armour Wire Ring -->
        <rect x="40" y="-18" width="18" height="22" rx="2" fill="url(#chromeGrad)" transform="rotate(-25)" />
        <!-- 4 Insulated Cores: Red, Yellow, Blue, Black -->
        <circle cx="68" cy="-28" r="6" fill="#ef4444" />
        <circle cx="78" cy="-24" r="6" fill="#eab308" />
        <circle cx="68" cy="-16" r="6" fill="#0284c7" />
        <circle cx="78" cy="-12" r="6" fill="#1e293b" />
        <!-- Pure Copper Strands Emerging -->
        <g stroke="url(#copperGrad)" stroke-width="2.5">
          <line x1="74" y1="-28" x2="90" y2="-35" />
          <line x1="84" y1="-24" x2="100" y2="-30" />
          <line x1="74" y1="-16" x2="90" y2="-20" />
          <line x1="84" y1="-12" x2="100" y2="-15" />
        </g>
      </g>
    </g>
  `,

  // 11. Industrial Bearings (Deep Groove & Spherical)
  'bearings': () => `
    <g transform="translate(100, 80)">
      <!-- Large Precision Ball Bearing -->
      <g transform="translate(40, 20)">
        <!-- Outer Ring -->
        <circle cx="110" cy="110" r="100" fill="url(#chromeGrad)" stroke="#334155" stroke-width="4" />
        <!-- Black Rubber Contact Seal Ring -->
        <circle cx="110" cy="110" r="82" fill="#0f172a" stroke="#475569" stroke-width="2" />
        <text x="110" y="42" font-family="sans-serif" font-size="9" font-weight="900" fill="#94a3b8" text-anchor="middle">SKF 6312-2RS / C3 • GERMANY</text>
        <!-- Steel Balls (visible on cutout or open side) -->
        <circle cx="110" cy="110" r="62" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
        <!-- Inner Ring -->
        <circle cx="110" cy="110" r="45" fill="#f8fafc" stroke="#334155" stroke-width="3" />
        <circle cx="110" cy="110" r="32" fill="#e2e8f0" />
      </g>

      <!-- Smaller Tapered / Spherical Bearing in front -->
      <g transform="translate(140, 160)">
        <ellipse cx="60" cy="60" rx="55" ry="35" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="3" />
        <!-- Brass Cage -->
        <ellipse cx="60" cy="60" rx="42" ry="26" fill="url(#copperGrad)" stroke="#9a3412" stroke-width="2" />
        <ellipse cx="60" cy="60" rx="28" ry="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
      </g>
    </g>
  `,

  // 12. Flanged Industrial Ball Valve
  'ball-valve': () => `
    <g transform="translate(110, 80)">
      <!-- Left & Right Heavy Pipe Flanges -->
      <rect x="20" y="140" width="30" height="120" rx="6" fill="url(#darkMetal)" stroke="#334155" stroke-width="3" />
      <rect x="230" y="140" width="30" height="120" rx="6" fill="url(#darkMetal)" stroke="#334155" stroke-width="3" />
      <!-- Flange Bolt Holes -->
      <circle cx="35" cy="160" r="6" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <circle cx="35" cy="240" r="6" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <circle cx="245" cy="160" r="6" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <circle cx="245" cy="240" r="6" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <!-- Valve Center Spherical Body -->
      <circle cx="140" cy="200" r="60" fill="url(#chromeGrad)" stroke="#475569" stroke-width="4" />
      <rect x="50" y="170" width="180" height="60" fill="url(#darkMetal)" />
      <circle cx="140" cy="200" r="35" fill="url(#chromeGrad)" stroke="#0f172a" stroke-width="2" />
      <!-- Valve Bonnet & Stem -->
      <rect x="125" y="80" width="30" height="65" rx="4" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <!-- Bright Blue Operating Lever Handle -->
      <rect x="80" y="65" width="190" height="24" rx="8" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="3" transform="rotate(-15 140 75)" />
      <circle cx="140" cy="75" r="14" fill="#0f172a" stroke="#ffffff" stroke-width="2" />
      <!-- Spec Stencil -->
      <text x="140" y="205" font-family="sans-serif" font-size="10" font-weight="900" fill="#0f172a" text-anchor="middle">3" #150</text>
      <text x="140" y="217" font-family="sans-serif" font-size="8" font-weight="700" fill="#334155" text-anchor="middle">WCB • SS316</text>
    </g>
  `,

  // 13. VFD Drive Frequency Inverter
  'vfd-drive': () => `
    <g transform="translate(120, 60)">
      <!-- Inverter Body Case -->
      <rect x="40" y="40" width="180" height="300" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="4" />
      <!-- Top Brand Strip -->
      <rect x="55" y="55" width="150" height="30" rx="6" fill="#1e293b" />
      <text x="130" y="75" font-family="sans-serif" font-size="12" font-weight="900" fill="#38bdf8" text-anchor="middle">DELTA • 30 kW</text>
      <!-- Red 7-Segment LED Display -->
      <rect x="65" y="100" width="130" height="50" rx="8" fill="#000000" stroke="#334155" stroke-width="2" />
      <text x="130" y="136" font-family="'Courier New', monospace" font-size="28" font-weight="900" fill="#ef4444" text-anchor="middle" letter-spacing="3">50.00</text>
      <text x="180" y="120" font-family="sans-serif" font-size="8" font-weight="800" fill="#22c55e">Hz</text>
      <!-- Keypad Buttons -->
      <rect x="70" y="165" width="32" height="22" rx="4" fill="#22c55e" />
      <text x="86" y="180" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">RUN</text>

      <rect x="110" y="165" width="32" height="22" rx="4" fill="#ef4444" />
      <text x="126" y="180" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">STOP</text>

      <rect x="150" y="165" width="32" height="22" rx="4" fill="#3b82f6" />
      <text x="166" y="180" font-family="sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">PROG</text>
      <!-- Potentiometer Speed Dial -->
      <circle cx="130" cy="225" r="22" fill="url(#darkMetal)" stroke="#64748b" stroke-width="3" />
      <line x1="130" y1="225" x2="140" y2="210" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
      <!-- Bottom Cooling Heatsink Grille -->
      <g stroke="#334155" stroke-width="3">
        <line x1="60" y1="270" x2="200" y2="270" />
        <line x1="60" y1="280" x2="200" y2="280" />
        <line x1="60" y1="290" x2="200" y2="290" />
        <line x1="60" y1="300" x2="200" y2="300" />
        <line x1="60" y1="310" x2="200" y2="310" />
      </g>
    </g>
  `,

  // 14. Infrared Laser Pyrometer Gun
  'pyrometer': () => `
    <g transform="translate(100, 70)">
      <!-- Gun Body (Yellow/Black Industrial Thermo Casing) -->
      <path d="M40 80 L180 80 C195 80 205 90 205 105 L205 150 C205 165 195 175 180 175 L140 175 L160 300 C162 315 150 325 135 325 L105 325 C90 325 80 315 75 300 L70 175 L40 175 Z" fill="url(#cautionYellow)" stroke="#a16207" stroke-width="4" />
      <!-- Black Rubber Grip Inlays -->
      <rect x="85" y="210" width="60" height="15" rx="4" fill="#1e293b" />
      <rect x="90" y="235" width="60" height="15" rx="4" fill="#1e293b" />
      <rect x="95" y="260" width="60" height="15" rx="4" fill="#1e293b" />
      <rect x="100" y="285" width="60" height="15" rx="4" fill="#1e293b" />
      <!-- Backlit Color LCD Screen -->
      <rect x="75" y="95" width="90" height="60" rx="8" fill="#0f172a" stroke="#334155" stroke-width="2" />
      <text x="120" y="125" font-family="'Courier New', monospace" font-size="20" font-weight="900" fill="#22c55e" text-anchor="middle">845.6°C</text>
      <text x="120" y="145" font-family="sans-serif" font-size="9" font-weight="800" fill="#f59e0b" text-anchor="middle">MAX • ε=0.95</text>
      <!-- Laser Emitter Lens Front -->
      <rect x="25" y="100" width="20" height="50" rx="4" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <circle cx="25" cy="115" r="5" fill="#ef4444" />
      <circle cx="25" cy="135" r="5" fill="#ef4444" />
      <!-- Red Trigger -->
      <path d="M68 185 C55 185 55 210 68 210 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
    </g>
  `,

  // 15. LED High-Bay UFO Light
  'highbay-led': () => `
    <g transform="translate(100, 70)">
      <!-- Top Eye Bolt Ring -->
      <circle cx="150" cy="50" r="22" fill="none" stroke="url(#chromeGrad)" stroke-width="10" />
      <!-- Driver Compartment -->
      <rect x="110" y="70" width="80" height="40" rx="10" fill="#0f172a" stroke="#334155" stroke-width="3" />
      <!-- Die-cast Aluminum UFO Heatsink Fins -->
      <ellipse cx="150" cy="160" rx="140" ry="40" fill="url(#darkMetal)" stroke="#0f172a" stroke-width="4" />
      <ellipse cx="150" cy="160" rx="120" ry="32" fill="#334155" />
      <!-- Radial Heatsink Fins -->
      <g stroke="#0f172a" stroke-width="3">
        <line x1="30" y1="160" x2="270" y2="160" />
        <line x1="50" y1="140" x2="250" y2="180" />
        <line x1="50" y1="180" x2="250" y2="140" />
        <line x1="80" y1="130" x2="220" y2="190" />
        <line x1="80" y1="190" x2="220" y2="130" />
      </g>
      <!-- High Lumen LED Array Board Glowing Under Lens -->
      <ellipse cx="150" cy="175" rx="90" ry="24" fill="#ffffff" stroke="#facc15" stroke-width="3" filter="drop-shadow(0 0 15px #fde047)" />
      <!-- Individual SMD LED Dots -->
      <g fill="#f59e0b">
        <circle cx="110" cy="175" r="4" />
        <circle cx="130" cy="175" r="4" />
        <circle cx="150" cy="175" r="4" />
        <circle cx="170" cy="175" r="4" />
        <circle cx="190" cy="175" r="4" />
        <circle cx="120" cy="168" r="3" />
        <circle cx="140" cy="168" r="3" />
        <circle cx="160" cy="168" r="3" />
        <circle cx="180" cy="168" r="3" />
        <circle cx="120" cy="182" r="3" />
        <circle cx="140" cy="182" r="3" />
        <circle cx="160" cy="182" r="3" />
        <circle cx="180" cy="182" r="3" />
      </g>
      <text x="150" y="240" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">150W • IP66 • 21,000 LM</text>
    </g>
  `,

  // 16. Polycarbonate Safety Goggles
  'safety-goggles': () => `
    <g transform="translate(80, 110)">
      <!-- Black Elastic Headband -->
      <path d="M20 120 C-30 120 -30 60 40 60" fill="none" stroke="#0f172a" stroke-width="16" stroke-linecap="round" />
      <path d="M320 120 C370 120 370 60 300 60" fill="none" stroke="#0f172a" stroke-width="16" stroke-linecap="round" />
      <!-- Goggle Frame (Soft Black PVC) -->
      <path d="M30 110 C30 50 120 40 170 65 C220 40 310 50 310 110 C310 170 230 180 170 150 C110 180 30 170 30 110 Z" fill="#1e293b" stroke="#0f172a" stroke-width="6" />
      <!-- Clear Polycarbonate Panoramic Lens with Light Reflections -->
      <path d="M45 110 C45 60 120 55 170 75 C220 55 295 60 295 110 C295 155 225 165 170 140 C115 165 45 155 45 110 Z" fill="url(#studioBg)" stroke="#38bdf8" stroke-width="3" opacity="0.95" />
      <!-- Lens Glare Highlight Lines -->
      <path d="M60 85 L140 75 L120 135 L50 140 Z" fill="rgba(255, 255, 255, 0.45)" />
      <path d="M190 75 L270 85 L280 140 L210 135 Z" fill="rgba(255, 255, 255, 0.35)" />
      <!-- Indirect Ventilation Valves -->
      <circle cx="80" cy="70" r="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5" />
      <circle cx="100" cy="65" r="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5" />
      <circle cx="240" cy="65" r="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5" />
      <circle cx="260" cy="70" r="6" fill="#0f172a" stroke="#64748b" stroke-width="1.5" />
      <!-- Anti-Fog / UV400 Badge -->
      <text x="170" y="110" font-family="sans-serif" font-size="10" font-weight="900" fill="#0284c7" text-anchor="middle" opacity="0.8">ANTI-FOG • UV400</text>
    </g>
  `,

  // 17. Industrial Degreaser Canister (50L / 20L Carboy)
  'degreaser-canister': () => `
    <g transform="translate(130, 60)">
      <!-- Semi-Translucent Heavy Duty Jerrycan -->
      <rect x="30" y="80" width="180" height="260" rx="28" fill="#e0f2fe" stroke="#0284c7" stroke-width="4" />
      <!-- Top Handle -->
      <path d="M70 80 L70 40 C70 30 170 30 170 40 L170 80" fill="none" stroke="#0284c7" stroke-width="18" stroke-linecap="round" />
      <!-- Red Vented Cap -->
      <rect x="45" y="45" width="40" height="35" rx="6" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
      <!-- Liquid Level (Blue Concentrated Degreaser) -->
      <rect x="36" y="140" width="168" height="194" rx="20" fill="#0284c7" opacity="0.35" />
      <!-- Commercial Label -->
      <rect x="48" y="130" width="144" height="130" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
      <rect x="52" y="136" width="136" height="24" rx="4" fill="#0f172a" />
      <text x="120" y="152" font-family="sans-serif" font-size="11" font-weight="900" fill="#38bdf8" text-anchor="middle">HEAVY DEGREASER</text>
      <text x="120" y="180" font-family="sans-serif" font-size="14" font-weight="900" fill="#dc2626" text-anchor="middle">50 LITERS</text>
      <text x="120" y="200" font-family="sans-serif" font-size="9" font-weight="700" fill="#334155" text-anchor="middle">Concentrated • Bio-Safe</text>
      <g transform="translate(65, 215)">
        <polygon points="15,0 30,24 0,24" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5" />
        <text x="15" y="20" font-family="sans-serif" font-size="14" font-weight="900" fill="#0f172a" text-anchor="middle">!</text>
        <text x="65" y="16" font-family="sans-serif" font-size="9" font-weight="800" fill="#15803d">PLANT GRADE</text>
      </g>
    </g>
  `,

  // 18. Natural Odisha Hill Grass Broom
  'grass-broom': () => `
    <g transform="translate(120, 50)">
      <!-- Broom Handle / Bound Stems -->
      <path d="M120 30 L140 30 L155 180 L105 180 Z" fill="#ca8a04" stroke="#854d0e" stroke-width="2" />
      <!-- Wire Wrapping / Red Binding -->
      <rect x="112" y="50" width="36" height="12" rx="2" fill="#dc2626" />
      <rect x="110" y="75" width="40" height="12" rx="2" fill="#dc2626" />
      <rect x="108" y="100" width="44" height="12" rx="2" fill="#dc2626" />
      <rect x="106" y="125" width="48" height="12" rx="2" fill="#dc2626" />
      <rect x="104" y="150" width="52" height="12" rx="2" fill="#dc2626" />
      <!-- Dense Natural Hill Grass Brush Flares -->
      <path d="M105 180 C80 260 20 340 30 370 C60 380 200 380 230 370 C240 340 180 260 155 180 Z" fill="url(#cautionYellow)" stroke="#a16207" stroke-width="3" />
      <!-- Fine Straw Line Textures -->
      <g stroke="#ca8a04" stroke-width="1.5">
        <line x1="130" y1="180" x2="50" y2="370" />
        <line x1="130" y1="180" x2="80" y2="370" />
        <line x1="130" y1="180" x2="110" y2="370" />
        <line x1="130" y1="180" x2="130" y2="370" />
        <line x1="130" y1="180" x2="150" y2="370" />
        <line x1="130" y1="180" x2="180" y2="370" />
        <line x1="130" y1="180" x2="210" y2="370" />
      </g>
      <!-- SHG Quality Badge -->
      <rect x="75" y="270" width="110" height="24" rx="12" fill="#15803d" stroke="#ffffff" stroke-width="2" />
      <text x="130" y="286" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">ODISHA HER-SHG</text>
    </g>
  `,

  // 19. Workshop Bench Vice
  'bench-vice': () => `
    <g transform="translate(90, 80)">
      <!-- Swivel Base -->
      <ellipse cx="160" cy="280" rx="110" ry="25" fill="url(#darkMetal)" stroke="#0f172a" stroke-width="3" />
      <circle cx="80" cy="280" r="8" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <circle cx="240" cy="280" r="8" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      <!-- Vice Heavy Cast Iron Body (Blue) -->
      <rect x="90" y="140" width="140" height="120" rx="14" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="4" />
      <!-- Fixed Jaw (Right) -->
      <rect x="180" y="80" width="50" height="80" rx="6" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="3" />
      <rect x="180" y="80" width="14" height="40" rx="2" fill="url(#chromeGrad)" stroke="#334155" stroke-width="1.5" />
      <!-- Movable Sliding Jaw (Left) -->
      <rect x="60" y="80" width="60" height="120" rx="6" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="3" />
      <rect x="106" y="80" width="14" height="40" rx="2" fill="url(#chromeGrad)" stroke="#334155" stroke-width="1.5" />
      <!-- Chrome Lead Screw & Sliding Handle -->
      <rect x="20" y="170" width="60" height="20" rx="4" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <rect x="10" y="100" width="12" height="160" rx="6" fill="url(#chromeGrad)" stroke="#334155" stroke-width="2" />
      <circle cx="16" cy="100" r="8" fill="#0f172a" />
      <circle cx="16" cy="260" r="8" fill="#0f172a" />
      <!-- Anvil Pad -->
      <rect x="130" y="125" width="45" height="15" rx="3" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <!-- Spec -->
      <text x="160" y="210" font-family="sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">8 INCH</text>
      <text x="160" y="225" font-family="sans-serif" font-size="9" font-weight="700" fill="#bae6fd" text-anchor="middle">HEAVY FORGED</text>
    </g>
  `,

  // 20. Seamless Steel Pipes Stack
  'seamless-pipes': () => `
    <g transform="translate(90, 80)">
      <!-- 3 Heavy Carbon Steel Pipes Stacked in Pyramid -->
      <!-- Bottom Left Pipe -->
      <g transform="translate(20, 140)">
        <polygon points="0,0 200,0 200,80 0,80" fill="url(#darkMetal)" stroke="#0f172a" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="20" ry="40" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="14" ry="28" fill="#0f172a" />
        <text x="100" y="45" font-family="sans-serif" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="2">ASTM A106 GR.B • 4" SCH 40</text>
      </g>
      <!-- Bottom Right Pipe -->
      <g transform="translate(100, 140)">
        <polygon points="0,0 200,0 200,80 0,80" fill="url(#darkMetal)" stroke="#0f172a" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="20" ry="40" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="14" ry="28" fill="#0f172a" />
      </g>
      <!-- Top Pipe in Pyramid -->
      <g transform="translate(60, 50)">
        <polygon points="0,0 200,0 200,80 0,80" fill="url(#darkMetal)" stroke="#0f172a" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="20" ry="40" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
        <ellipse cx="0" cy="40" rx="14" ry="28" fill="#0f172a" />
        <text x="100" y="45" font-family="sans-serif" font-size="10" font-weight="800" fill="#facc15" letter-spacing="2">SEAMLESS • 6.0M</text>
      </g>
    </g>
  `,

  // 21. High-Alumina Refractory Firebricks
  'refractory-bricks': () => `
    <g transform="translate(100, 70)">
      <!-- 3D Stack of Refractory Alumina Firebricks -->
      <!-- Brick 1 -->
      <g transform="translate(40, 180)">
        <polygon points="0,40 140,0 220,30 80,70" fill="#fef08a" stroke="#ca8a04" stroke-width="2" />
        <polygon points="0,40 80,70 80,120 0,90" fill="#fde047" stroke="#ca8a04" stroke-width="2" />
        <polygon points="80,70 220,30 220,80 80,120" fill="#eab308" stroke="#ca8a04" stroke-width="2" />
        <text x="150" y="90" font-family="sans-serif" font-size="11" font-weight="900" fill="#713f12" transform="rotate(-15 150 90)">AL-85%</text>
      </g>
      <!-- Brick 2 Stacked Above -->
      <g transform="translate(60, 110)">
        <polygon points="0,40 140,0 220,30 80,70" fill="#fef08a" stroke="#ca8a04" stroke-width="2" />
        <polygon points="0,40 80,70 80,120 0,90" fill="#fde047" stroke="#ca8a04" stroke-width="2" />
        <polygon points="80,70 220,30 220,80 80,120" fill="#eab308" stroke="#ca8a04" stroke-width="2" />
        <text x="150" y="90" font-family="sans-serif" font-size="11" font-weight="900" fill="#713f12" transform="rotate(-15 150 90)">1800°C</text>
      </g>
    </g>
  `,

  // 22. Grinding Media Balls Pile
  'grinding-balls': () => `
    <g transform="translate(100, 80)">
      <!-- Pile of High-Chrome Forged Steel Balls -->
      <circle cx="100" cy="220" r="50" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
      <circle cx="190" cy="220" r="50" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
      <circle cx="145" cy="140" r="55" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="4" />
      <circle cx="70" cy="160" r="38" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
      <circle cx="220" cy="160" r="38" fill="url(#chromeGrad)" stroke="#334155" stroke-width="3" />
      <text x="145" y="145" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">65 HRC</text>
      <text x="145" y="160" font-family="sans-serif" font-size="9" font-weight="800" fill="#334155" text-anchor="middle">HIGH CHROME</text>
    </g>
  `,

  // 23. Perforated GI Cable Tray
  'cable-tray': () => `
    <g transform="translate(80, 80)">
      <!-- 3D Metallic Perforated Steel Cable Tray -->
      <polygon points="20,160 220,60 320,110 120,210" fill="url(#chromeGrad)" stroke="#475569" stroke-width="3" />
      <!-- Side Flanges -->
      <polygon points="20,160 20,120 220,20 220,60" fill="#94a3b8" stroke="#334155" stroke-width="2" />
      <polygon points="120,210 120,170 320,70 320,110" fill="#cbd5e1" stroke="#334155" stroke-width="2" />
      <!-- Perforation Holes Pattern -->
      <g fill="#334155" opacity="0.8">
        <rect x="70" y="150" width="12" height="6" rx="2" transform="rotate(-26 70 150)" />
        <rect x="100" y="135" width="12" height="6" rx="2" transform="rotate(-26 100 135)" />
        <rect x="130" y="120" width="12" height="6" rx="2" transform="rotate(-26 130 120)" />
        <rect x="160" y="105" width="12" height="6" rx="2" transform="rotate(-26 160 105)" />
        <rect x="190" y="90" width="12" height="6" rx="2" transform="rotate(-26 190 90)" />

        <rect x="110" y="170" width="12" height="6" rx="2" transform="rotate(-26 110 170)" />
        <rect x="140" y="155" width="12" height="6" rx="2" transform="rotate(-26 140 155)" />
        <rect x="170" y="140" width="12" height="6" rx="2" transform="rotate(-26 170 140)" />
        <rect x="200" y="125" width="12" height="6" rx="2" transform="rotate(-26 200 125)" />
        <rect x="230" y="110" width="12" height="6" rx="2" transform="rotate(-26 230 110)" />
      </g>
      <text x="170" y="240" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">HOT-DIP GALVANIZED • GI</text>
    </g>
  `,

  // 24. Heavy Conveyor Head Drum Pulley
  'conveyor-pulley': () => `
    <g transform="translate(80, 100)">
      <!-- Main Rubber Lagged Drum -->
      <rect x="60" y="60" width="180" height="140" rx="10" fill="#0f172a" stroke="#334155" stroke-width="4" />
      <!-- Diamond Herringbone Rubber Pattern -->
      <g stroke="#334155" stroke-width="2.5">
        <line x1="80" y1="60" x2="120" y2="200" />
        <line x1="120" y1="60" x2="80" y2="200" />
        <line x1="140" y1="60" x2="180" y2="200" />
        <line x1="180" y1="60" x2="140" y2="200" />
        <line x1="200" y1="60" x2="240" y2="200" />
      </g>
      <!-- Central Ground Steel Shaft -->
      <rect x="10" y="115" width="280" height="30" rx="4" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <!-- End Flanges -->
      <ellipse cx="60" cy="130" rx="15" ry="70" fill="url(#darkMetal)" stroke="#334155" stroke-width="3" />
      <ellipse cx="240" cy="130" rx="15" ry="70" fill="url(#darkMetal)" stroke="#334155" stroke-width="3" />
      <text x="150" y="230" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">RUBBER LAGGED DRUM</text>
    </g>
  `,

  // 25. Slurry Pump Impeller
  'slurry-impeller': () => `
    <g transform="translate(100, 80)">
      <!-- High Chrome 28% Pump Impeller Disc -->
      <circle cx="150" cy="150" r="120" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="5" />
      <!-- 4 Curved Closed Vanes -->
      <path d="M150 150 C190 130 240 170 260 190 C250 210 210 180 150 150 Z" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <path d="M150 150 C130 110 170 60 190 40 C210 50 180 90 150 150 Z" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <path d="M150 150 C110 170 60 130 40 110 C50 90 90 120 150 150 Z" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <path d="M150 150 C170 190 130 240 110 260 C90 250 120 210 150 150 Z" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <!-- Threaded Center Hub -->
      <circle cx="150" cy="150" r="35" fill="url(#copperGrad)" stroke="#7c2d12" stroke-width="3" />
      <circle cx="150" cy="150" r="20" fill="#0f172a" />
      <text x="150" y="295" font-family="sans-serif" font-size="11" font-weight="900" fill="#0f172a" text-anchor="middle">HIGH CHROME 28% ALLOY</text>
    </g>
  `,

  // 26. Stainless Steel Chemical Tank Hopper
  'chemical-hopper': () => `
    <g transform="translate(110, 60)">
      <!-- Top Cylindrical Section (SS304 Mirror Polish) -->
      <rect x="40" y="40" width="200" height="120" rx="10" fill="url(#chromeGrad)" stroke="#475569" stroke-width="3" />
      <!-- Conical Bottom Section -->
      <polygon points="40,160 240,160 160,280 120,280" fill="url(#chromeGrad)" stroke="#475569" stroke-width="3" />
      <!-- Bottom Butterfly Discharge Valve -->
      <rect x="120" y="280" width="40" height="25" rx="4" fill="#0284c7" stroke="#0f172a" stroke-width="2" />
      <circle cx="140" cy="292" r="6" fill="#f8fafc" />
      <!-- Top Flanged Manhole Inlet -->
      <rect x="90" y="25" width="100" height="15" rx="4" fill="#64748b" stroke="#334155" stroke-width="2" />
      <!-- 3 Tubular Support Legs -->
      <rect x="30" y="100" width="14" height="230" rx="4" fill="url(#darkMetal)" stroke="#1e293b" stroke-width="2" />
      <rect x="236" y="100" width="14" height="230" rx="4" fill="url(#darkMetal)" stroke="#1e293b" stroke-width="2" />
      <text x="140" y="110" font-family="sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">SS304 • 5 KL</text>
      <text x="140" y="125" font-family="sans-serif" font-size="9" font-weight="700" fill="#334155" text-anchor="middle">PROCESS HOPPER</text>
    </g>
  `,

  // 27. Spiral Wound Gasket
  'spiral-gasket': () => `
    <g transform="translate(100, 70)">
      <!-- Outer Centering Ring (ASME Green / Yellow Painted Carbon Steel) -->
      <circle cx="150" cy="160" r="130" fill="#22c55e" stroke="#15803d" stroke-width="4" />
      <text x="150" y="55" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">ASME B16.20 • 4" CLASS 300 • 316 / GRAPHITE</text>
      <!-- Spiral Wound Sealing Element (Chevron Metal + Graphite Bands) -->
      <circle cx="150" cy="160" r="100" fill="url(#darkMetal)" stroke="url(#chromeGrad)" stroke-width="8" />
      <!-- Inner Ring (Stainless Steel 316) -->
      <circle cx="150" cy="160" r="75" fill="url(#chromeGrad)" stroke="#475569" stroke-width="3" />
      <!-- Center Bore Hollow -->
      <circle cx="150" cy="160" r="58" fill="url(#studioBg)" />
    </g>
  `,

  // 28. Heavy Roller Chain & Sprocket
  'roller-chain-sprocket': () => `
    <g transform="translate(90, 70)">
      <!-- Precision Flame Hardened Steel Sprocket -->
      <circle cx="160" cy="160" r="100" fill="url(#darkMetal)" stroke="#334155" stroke-width="4" />
      <!-- Sprocket Teeth Profiles around rim -->
      <g fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="1.5">
        <polygon points="160,50 152,65 168,65" />
        <polygon points="210,65 200,80 215,85" />
        <polygon points="250,105 235,115 245,128" />
        <polygon points="270,160 255,152 255,168" />
        <polygon points="250,215 245,200 235,210" />
        <polygon points="210,255 200,240 215,235" />
        <polygon points="160,270 152,255 168,255" />
        <polygon points="110,255 120,240 105,235" />
        <polygon points="70,215 75,200 85,210" />
        <polygon points="50,160 65,152 65,168" />
        <polygon points="70,105 85,115 75,128" />
        <polygon points="110,65 120,80 105,85" />
      </g>
      <!-- Center Keyway Bore -->
      <circle cx="160" cy="160" r="35" fill="url(#chromeGrad)" stroke="#0f172a" stroke-width="3" />
      <rect x="154" y="125" width="12" height="15" fill="#0f172a" />
      <circle cx="160" cy="160" r="22" fill="#0f172a" />
      <!-- Engaged Heavy Roller Chain around top -->
      <path d="M50 160 C50 80 270 80 270 160" fill="none" stroke="url(#safetyOrange)" stroke-width="14" stroke-linecap="round" stroke-dasharray="16,6" />
      <text x="160" y="200" font-family="sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">ASA 120 • 24T</text>
    </g>
  `,

  // 29. Ready Mix Concrete Block & Aggregates
  'rmc-aggregates': () => `
    <g transform="translate(100, 80)">
      <!-- Concrete 150mm Cube Specimen -->
      <polygon points="40,140 140,80 220,110 120,170" fill="#94a3b8" stroke="#475569" stroke-width="2" />
      <polygon points="40,140 120,170 120,270 40,240" fill="#64748b" stroke="#334155" stroke-width="2" />
      <polygon points="120,170 220,110 220,210 120,270" fill="#475569" stroke="#1e293b" stroke-width="2" />
      <text x="170" y="175" font-family="sans-serif" font-size="14" font-weight="900" fill="#ffffff" transform="rotate(-15 170 175)">M30 RMC</text>
      <!-- Granite Stone Aggregates 20mm Pile -->
      <g transform="translate(180, 200)">
        <polygon points="10,40 30,20 50,35 40,55 15,50" fill="#334155" stroke="#0f172a" stroke-width="1.5" />
        <polygon points="45,30 65,10 85,25 75,45 50,40" fill="#475569" stroke="#0f172a" stroke-width="1.5" />
        <polygon points="30,55 55,45 70,60 45,75 25,65" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
        <polygon points="70,45 95,35 110,50 85,65 65,55" fill="#64748b" stroke="#0f172a" stroke-width="1.5" />
      </g>
    </g>
  `,

  // 30. Abrasive Grinding Discs Stack
  'grinding-discs': () => `
    <g transform="translate(100, 80)">
      <!-- Fan stack of 3 Grinding Discs -->
      <g transform="translate(20, 40) rotate(-15)">
        <circle cx="100" cy="100" r="90" fill="url(#darkMetal)" stroke="#ea580c" stroke-width="4" />
        <circle cx="100" cy="100" r="40" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
        <circle cx="100" cy="100" r="16" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="2" />
        <circle cx="100" cy="100" r="11" fill="#f8fafc" />
        <text x="100" y="90" font-family="sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">STEEL GRINDING</text>
        <text x="100" y="118" font-family="sans-serif" font-size="7" font-weight="800" fill="#fef08a" text-anchor="middle">180 x 6.0 x 22.2mm</text>
      </g>
      <g transform="translate(80, 120)">
        <circle cx="100" cy="100" r="90" fill="url(#darkMetal)" stroke="#ea580c" stroke-width="4" />
        <circle cx="100" cy="100" r="40" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
        <circle cx="100" cy="100" r="16" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="2" />
        <circle cx="100" cy="100" r="11" fill="#f8fafc" />
        <text x="100" y="90" font-family="sans-serif" font-size="8" font-weight="900" fill="#ffffff" text-anchor="middle">80 M/S • 8500 RPM</text>
      </g>
    </g>
  `,

  // 31. SCBA Breathing Cylinder
  'scba-kit': () => `
    <g transform="translate(120, 60)">
      <!-- Carbon Composite Yellow Air Cylinder -->
      <rect x="40" y="60" width="100" height="250" rx="45" fill="url(#cautionYellow)" stroke="#a16207" stroke-width="4" />
      <rect x="50" y="80" width="80" height="15" rx="4" fill="#0f172a" />
      <rect x="50" y="270" width="80" height="15" rx="4" fill="#0f172a" />
      <text x="90" y="170" font-family="sans-serif" font-size="12" font-weight="900" fill="#0f172a" text-anchor="middle">300 BAR</text>
      <text x="90" y="190" font-family="sans-serif" font-size="10" font-weight="800" fill="#dc2626" text-anchor="middle">6.8 LITERS</text>
      <!-- Valve & Pressure Regulator -->
      <rect x="78" y="25" width="24" height="35" rx="4" fill="url(#chromeGrad)" stroke="#334155" stroke-width="2" />
      <circle cx="68" cy="35" r="12" fill="#ffffff" stroke="#0f172a" stroke-width="2" />
      <!-- Silicone Full Face Mask alongside -->
      <g transform="translate(130, 140)">
        <ellipse cx="60" cy="60" rx="55" ry="65" fill="#1e293b" stroke="#0f172a" stroke-width="4" />
        <ellipse cx="60" cy="50" rx="42" ry="45" fill="url(#studioBg)" stroke="#38bdf8" stroke-width="2" />
        <circle cx="60" cy="95" r="18" fill="#0284c7" stroke="#0f172a" stroke-width="2" />
      </g>
    </g>
  `,

  // 32. Heavy Industrial EP-2 Grease Drum
  'grease-drum': () => `
    <g transform="translate(130, 60)">
      <!-- Blue Steel 180kg Barrel -->
      <rect x="30" y="70" width="180" height="260" rx="20" fill="url(#toolBlue)" stroke="#0369a1" stroke-width="4" />
      <!-- Chimes & Rings -->
      <line x1="30" y1="130" x2="210" y2="130" stroke="#0f172a" stroke-width="6" />
      <line x1="30" y1="210" x2="210" y2="210" stroke="#0f172a" stroke-width="6" />
      <line x1="30" y1="270" x2="210" y2="270" stroke="#0f172a" stroke-width="6" />
      <ellipse cx="120" cy="70" rx="90" ry="25" fill="#0284c7" stroke="#0369a1" stroke-width="3" />
      <!-- Top Bung Holes -->
      <circle cx="80" cy="70" r="10" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="2" />
      <circle cx="160" cy="70" r="6" fill="url(#chromeGrad)" stroke="#1e293b" stroke-width="2" />
      <!-- Lithograph Brand Label -->
      <rect x="45" y="145" width="150" height="55" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      <text x="120" y="165" font-family="sans-serif" font-size="13" font-weight="900" fill="#dc2626" text-anchor="middle">EP-2 GREASE</text>
      <text x="120" y="180" font-family="sans-serif" font-size="10" font-weight="800" fill="#0f172a" text-anchor="middle">HEAVY INDUSTRIAL 180 KG</text>
      <text x="120" y="193" font-family="sans-serif" font-size="8" font-weight="700" fill="#0284c7" text-anchor="middle">Lithium Complex • MoS2</text>
    </g>
  `
};

// Map each product name / requirement to the appropriate realistic product drawing key
export function getDrawingKeyForProduct(productName: string, categoryName: string): string {
  const p = productName.toLowerCase();
  const c = categoryName.toLowerCase();

  if (p.includes('impact wrench') || p.includes('pneumatic')) return 'impact-wrench';
  if (p.includes('welding machine') || p.includes('welder') || p.includes('igbt') || p.includes('plasma')) return 'arc-welder';
  if (p.includes('electrode') || p.includes('e7018')) return 'welding-electrodes';
  if (p.includes('chain') || p.includes('sling') || p.includes('shackle') || p.includes('rigging') || p.includes('lifting')) return 'lifting-chain';
  if (p.includes('harness') || p.includes('fall arrest')) return 'safety-harness';
  if (p.includes('shoe') || p.includes('boot') || p.includes('footwear')) return 'safety-shoe';
  if (p.includes('extinguisher') || p.includes('fire')) return 'fire-extinguisher';
  if (p.includes('scba') || p.includes('breathing')) return 'scba-kit';
  if (p.includes('motor') || p.includes('induction')) return 'electric-motor';
  if (p.includes('mccb') || p.includes('breaker') || p.includes('switchgear')) return 'mccb-breaker';
  if (p.includes('cable') || p.includes('wire') || p.includes('armoured')) return 'power-cable';
  if (p.includes('torque wrench') || p.includes('tool kit') || p.includes('caliper')) return 'impact-wrench';
  if (p.includes('bearing') || p.includes('plummer')) return 'bearings';
  if (p.includes('valve') || p.includes('flange')) return 'ball-valve';
  if (p.includes('pipe') || p.includes('saniteries') || p.includes('seamless')) return 'seamless-pipes';
  if (p.includes('vfd') || p.includes('inverter drive')) return 'vfd-drive';
  if (p.includes('pyrometer') || p.includes('thermometer') || p.includes('laser')) return 'pyrometer';
  if (p.includes('tray') || p.includes('raceway')) return 'cable-tray';
  if (p.includes('high-bay') || p.includes('flood light') || p.includes('light')) return 'highbay-led';
  if (p.includes('goggle') || p.includes('eyewear') || p.includes('spectacle')) return 'safety-goggles';
  if (p.includes('cleaner') || p.includes('degreaser') || p.includes('hand wash') || p.includes('chemical')) return 'degreaser-canister';
  if (p.includes('broom') || p.includes('mop') || p.includes('grass') || p.includes('coir')) return 'grass-broom';
  if (p.includes('vice') || p.includes('clamping')) return 'bench-vice';
  if (p.includes('grinding') || p.includes('abrasive') || p.includes('wheel')) return 'grinding-discs';
  if (p.includes('grease') || p.includes('oil') || p.includes('lubricant')) return 'grease-drum';
  if (p.includes('gasket')) return 'spiral-gasket';
  if (p.includes('sprocket') || p.includes('gear')) return 'roller-chain-sprocket';
  if (p.includes('concrete') || p.includes('aggregate') || p.includes('culvert') || p.includes('rmc')) return 'rmc-aggregates';
  if (p.includes('impeller') || p.includes('pump')) return 'slurry-impeller';
  if (p.includes('hopper') || p.includes('vessel') || p.includes('tank') || p.includes('ducting')) return 'chemical-hopper';
  if (p.includes('refractory') || p.includes('brick') || p.includes('bauxite') || p.includes('ramming')) return 'refractory-bricks';
  if (p.includes('grinding media') || p.includes('ball')) return 'grinding-balls';
  if (p.includes('pulley') || p.includes('roller')) return 'conveyor-pulley';

  // Fallback by category
  if (c.includes('electrical')) return 'electric-motor';
  if (c.includes('safety')) return 'safety-harness';
  if (c.includes('welding')) return 'arc-welder';
  if (c.includes('tool')) return 'impact-wrench';
  if (c.includes('chemical') || c.includes('fmcg')) return 'degreaser-canister';
  if (c.includes('bearing')) return 'bearings';
  if (c.includes('pipe')) return 'ball-valve';
  if (c.includes('construction')) return 'rmc-aggregates';

  return 'impact-wrench';
}

import { BUYERS_DATA, SELLERS_DATA } from './portal-seed-data.js';

export function generateAllRealisticProductImages() {
  ensureDirs();
  console.log('Generating realistic studio product images for buyers and sellers...');

  const ratings = ['4.8', '4.9', '4.7', '5.0', '4.6', '4.9', '4.8'];
  let ratingIdx = 0;

  for (const buyer of BUYERS_DATA) {
    for (let i = 0; i < buyer.requirements.length; i++) {
      const req = buyer.requirements[i];
      const key = getDrawingKeyForProduct(req.title, req.category);
      const drawFn = realisticDrawings[key] || realisticDrawings['impact-wrench'];
      const rating = ratings[ratingIdx % ratings.length];
      ratingIdx++;

      const svgContent = studioWrap(drawFn(), rating);
      saveAsset('products', `${buyer.slug}-req-${i + 1}.svg`, svgContent);
    }
  }

  for (const seller of SELLERS_DATA) {
    for (let i = 0; i < seller.products.length; i++) {
      const prod = seller.products[i];
      const key = getDrawingKeyForProduct(prod.name, prod.category);
      const drawFn = realisticDrawings[key] || realisticDrawings['impact-wrench'];
      const rating = ratings[ratingIdx % ratings.length];
      ratingIdx++;

      const svgContent = studioWrap(drawFn(), rating);
      saveAsset('products', `${seller.slug}-prod-${i + 1}.svg`, svgContent);
    }
  }

  console.log('Successfully generated all realistic e-commerce product images!');
}

generateAllRealisticProductImages();
