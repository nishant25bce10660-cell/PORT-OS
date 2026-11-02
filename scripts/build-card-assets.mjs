import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function buildAssets() {
  const frontSrc = 'C:/Users/nisha/Downloads/true img.png';
  const backSrc = 'C:/Users/nisha/Downloads/bg.png';
  const logoSrc = 'C:/Users/nisha/Downloads/logo.png';

  console.log('Reading source files...');
  if (!fs.existsSync(frontSrc) || !fs.existsSync(backSrc) || !fs.existsSync(logoSrc)) {
    throw new Error('One or more source files do not exist!');
  }

  // 1. Front card image - direct clean image without any gradient overlay
  await sharp(frontSrc)
    .png({ quality: 95 })
    .toFile('public/card-front.png');
  console.log('✓ public/card-front.png generated');

  await sharp(frontSrc)
    .png({ quality: 95 })
    .toFile('public/true-img.png');
  console.log('✓ public/true-img.png generated');

  // 2. Strap / Band image
  await sharp(logoSrc)
    .png({ quality: 95 })
    .toFile('public/band.png');
  console.log('✓ public/band.png generated');

  await sharp(logoSrc)
    .png({ quality: 95 })
    .toFile('public/logo.png');
  console.log('✓ public/logo.png generated');

  // 3. Composite Back Image - SOLID FLAT COLORS ONLY, NO GRADIENTS
  const backMeta = await sharp(backSrc).metadata();
  const width = backMeta.width || 1086;
  const height = backMeta.height || 1448;

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark solid cyber card panel (Zero Gradients) -->
      <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="36" fill="#090d16" stroke="#1e293b" stroke-width="4" />
      
      <!-- Top Accents (Solid Colors) -->
      <path d="M 44 140 L ${width - 44} 140" stroke="#334155" stroke-width="2" />
      <rect x="84" y="80" width="14" height="28" fill="#38bdf8" rx="3" />
      <text x="112" y="102" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" letter-spacing="4">PORT OS SECURITY CREDENTIALS</text>
      <text x="840" y="102" fill="#34d399" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" letter-spacing="2">ROOT LEVEL</text>

      <!-- Smartcard Chip (Solid Gold) -->
      <g transform="translate(84, 180)">
        <rect width="140" height="110" rx="14" fill="#d97706" stroke="#78350f" stroke-width="2" />
        <path d="M 0 55 L 140 55 M 48 0 L 48 110 M 92 0 L 92 110" stroke="#78350f" stroke-width="2" />
        <circle cx="70" cy="55" r="16" fill="none" stroke="#78350f" stroke-width="2" />
      </g>

      <!-- NFC / Contactless Icon -->
      <g transform="translate(250, 210)" stroke="#64748b" stroke-width="3" fill="none">
        <path d="M 0 50 A 40 40 0 0 1 40 10" />
        <path d="M 10 50 A 28 28 0 0 1 38 22" />
        <path d="M 20 50 A 16 16 0 0 1 36 34" />
      </g>

      <!-- Attestation Badge (Solid Dark Slate) -->
      <g transform="translate(720, 195)">
        <rect width="280" height="80" rx="12" fill="#0f172a" stroke="#0284c7" stroke-width="2" />
        <text x="140" y="34" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="2">CRYPTOGRAPHIC ATTESTATION</text>
        <text x="140" y="60" fill="#22c55e" font-family="monospace" font-size="16" font-weight="700" text-anchor="middle">VERIFIED BY KERNEL</text>
      </g>

      <!-- Main Credentials Section (Solid Colors) -->
      <g transform="translate(84, 340)">
        <!-- Section Title -->
        <text x="0" y="30" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" letter-spacing="3">OFFICIAL OWNER AND DEVELOPER DATA</text>
        <line x1="0" y1="45" x2="918" y2="45" stroke="#1e293b" stroke-width="2" />

        <!-- Email Field (Solid Dark Slate) -->
        <g transform="translate(0, 80)">
          <rect width="918" height="120" rx="16" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
          <text x="32" y="42" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" letter-spacing="2">PRIMARY CONTACT EMAIL</text>
          <text x="32" y="86" fill="#38bdf8" font-family="monospace" font-size="28" font-weight="800">nishantjhajharia155@gmail.com</text>
        </g>

        <!-- Location & Status Field (Solid Dark Slate) -->
        <g transform="translate(0, 230)">
          <rect width="444" height="110" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <text x="30" y="38" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2">BASE NODE / LOCATION</text>
          <text x="30" y="80" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Mumbai, INDIA</text>

          <rect x="474" y="0" width="444" height="110" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <text x="504" y="38" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2">AUTHORIZATION STATUS</text>
          <text x="504" y="80" fill="#4ade80" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">ACTIVE / ROOT</text>
        </g>

        <!-- Public Credentials Links (Solid Dark Slate) -->
        <g transform="translate(0, 370)">
          <rect width="918" height="130" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <text x="32" y="38" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2">PORTFOLIO AND DEVELOPER CREDENTIALS</text>
          <text x="32" y="76" fill="#e2e8f0" font-family="monospace" font-size="20">Direct Email: nishantjhajharia155@gmail.com</text>
          <text x="32" y="108" fill="#e2e8f0" font-family="monospace" font-size="20">System Key: 0x9F4B2A8C17E34D90 (Verified Clearance)</text>
        </g>

        <!-- Cryptographic Proof Token (Solid Dark Slate) -->
        <g transform="translate(0, 530)">
          <rect width="918" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="2" />
          <text x="32" y="36" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2">CRYPTOGRAPHIC HARDWARE HASH</text>
          <text x="32" y="76" fill="#a855f7" font-family="monospace" font-size="20" font-weight="600">SHA256: d9b148c7e930f14264bce589a1c87e22fb95b16e</text>
        </g>
      </g>

      <!-- Barcode / Authentication Strip at Bottom (Solid White) -->
      <g transform="translate(84, 1080)">
        <rect width="918" height="180" rx="16" fill="#ffffff" />
        <!-- Procedural Barcode Bars (Solid Slate) -->
        <g fill="#0f172a">
          <rect x="40" y="24" width="6" height="90" />
          <rect x="52" y="24" width="12" height="90" />
          <rect x="70" y="24" width="4" height="90" />
          <rect x="80" y="24" width="18" height="90" />
          <rect x="104" y="24" width="6" height="90" />
          <rect x="116" y="24" width="8" height="90" />
          <rect x="130" y="24" width="14" height="90" />
          <rect x="150" y="24" width="6" height="90" />
          <rect x="162" y="24" width="12" height="90" />
          <rect x="180" y="24" width="4" height="90" />
          <rect x="190" y="24" width="20" height="90" />
          <rect x="216" y="24" width="6" height="90" />
          <rect x="228" y="24" width="16" height="90" />
          <rect x="250" y="24" width="8" height="90" />
          <rect x="264" y="24" width="4" height="90" />
          <rect x="274" y="24" width="18" height="90" />
          <rect x="298" y="24" width="10" height="90" />
          <rect x="314" y="24" width="6" height="90" />
          <rect x="326" y="24" width="14" height="90" />
          <rect x="346" y="24" width="8" height="90" />
          <rect x="360" y="24" width="4" height="90" />
          <rect x="370" y="24" width="20" height="90" />
          <rect x="396" y="24" width="6" height="90" />
          <rect x="408" y="24" width="16" height="90" />
          <rect x="430" y="24" width="8" height="90" />
          <rect x="444" y="24" width="4" height="90" />
          <rect x="454" y="24" width="18" height="90" />
          <rect x="478" y="24" width="10" height="90" />
          <rect x="494" y="24" width="6" height="90" />
          <rect x="506" y="24" width="14" height="90" />
          <rect x="526" y="24" width="8" height="90" />
          <rect x="540" y="24" width="4" height="90" />
          <rect x="550" y="24" width="20" height="90" />
          <rect x="576" y="24" width="6" height="90" />
          <rect x="588" y="24" width="16" height="90" />
          <rect x="610" y="24" width="8" height="90" />
          <rect x="624" y="24" width="4" height="90" />
          <rect x="634" y="24" width="18" height="90" />
          <rect x="658" y="24" width="10" height="90" />
          <rect x="674" y="24" width="6" height="90" />
          <rect x="686" y="24" width="14" height="90" />
          <rect x="706" y="24" width="8" height="90" />
          <rect x="720" y="24" width="4" height="90" />
          <rect x="730" y="24" width="20" height="90" />
          <rect x="756" y="24" width="6" height="90" />
          <rect x="768" y="24" width="16" height="90" />
          <rect x="790" y="24" width="8" height="90" />
          <rect x="804" y="24" width="4" height="90" />
          <rect x="814" y="24" width="18" height="90" />
          <rect x="838" y="24" width="10" height="90" />
          <rect x="854" y="24" width="6" height="90" />
          <rect x="866" y="24" width="14" height="90" />
        </g>
        <text x="459" y="146" fill="#0f172a" font-family="monospace" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="6">* PORT-OS-ROOT-AUTH-9182 *</text>
      </g>

      <!-- Bottom Security Tag -->
      <text x="${width / 2}" y="${height - 110}" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" text-anchor="middle" letter-spacing="2">SECURE CREDENTIAL BADGE • ISSUED BY PORT OS CORE SYSTEM</text>
    </svg>
  `);

  await sharp(backSrc)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png({ quality: 95 })
    .toFile('public/card-back.png');
  console.log('✓ public/card-back.png composited (zero gradients) and generated');

  await sharp(backSrc)
    .png({ quality: 95 })
    .toFile('public/bg.png');
  console.log('✓ public/bg.png generated');

  console.log('All card assets successfully rebuilt with ZERO gradients!');
}

buildAssets().catch((err) => {
  console.error('Error building assets:', err);
  process.exit(1);
});
