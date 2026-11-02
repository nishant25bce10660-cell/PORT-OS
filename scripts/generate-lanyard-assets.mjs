import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateAssets() {
  console.log('Generating high-resolution Lanyard card and strap assets...');
  const publicDir = path.resolve('public');

  // 1. FRONT CARD (width: 600, height: 840)
  const frontSvg = `
  <svg width="600" height="840" viewBox="0 0 600 840" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b0d14"/>
        <stop offset="40%" stop-color="#111726"/>
        <stop offset="100%" stop-color="#07090f"/>
      </linearGradient>
      <linearGradient id="goldChip" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#ca8a04"/>
        <stop offset="100%" stop-color="#854d0e"/>
      </linearGradient>
      <linearGradient id="holoBeam" x1="0%" y1="0%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/>
        <stop offset="50%" stop-color="#a855f7" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.4"/>
      </linearGradient>
      <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>
    </defs>

    <!-- Card Background with subtle border -->
    <rect x="0" y="0" width="600" height="840" rx="36" fill="url(#cardBg)"/>
    <rect x="2" y="2" width="596" height="836" rx="34" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
    
    <!-- Holographic diagonal streak -->
    <path d="M 0 200 L 600 500 L 600 620 L 0 320 Z" fill="url(#holoBeam)" opacity="0.35"/>

    <!-- Subtle Tech Grid -->
    <g stroke="rgba(255,255,255,0.03)" stroke-width="1">
      <line x1="50" y1="0" x2="50" y2="840"/>
      <line x1="150" y1="0" x2="150" y2="840"/>
      <line x1="450" y1="0" x2="450" y2="840"/>
      <line x1="550" y1="0" x2="550" y2="840"/>
      <line x1="0" y1="180" x2="600" y2="180"/>
      <line x1="0" y1="380" x2="600" y2="380"/>
      <line x1="0" y1="640" x2="600" y2="640"/>
    </g>

    <!-- Card Header -->
    <g transform="translate(50, 60)">
      <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#ffffff" letter-spacing="4">PORT OS</text>
      <text x="140" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#38bdf8" letter-spacing="2">// VIP ACCESS PASS</text>
      <circle cx="490" cy="18" r="6" fill="#34d399"/>
      <text x="472" y="38" font-family="monospace" font-size="10" fill="#94a3b8">ONLINE</text>
    </g>

    <!-- Accent divider -->
    <rect x="50" y="110" width="500" height="3" rx="1.5" fill="url(#accentLine)"/>

    <!-- Smart Chip & Contactless Emblem -->
    <g transform="translate(50, 140)">
      <!-- Metallic chip -->
      <rect x="0" y="0" width="96" height="74" rx="8" fill="url(#goldChip)" stroke="#ca8a04" stroke-width="1"/>
      <line x1="0" y1="24" x2="96" y2="24" stroke="#78350f" stroke-width="1.5"/>
      <line x1="0" y1="50" x2="96" y2="50" stroke="#78350f" stroke-width="1.5"/>
      <line x1="48" y1="0" x2="48" y2="74" stroke="#78350f" stroke-width="1.5"/>
      <rect x="32" y="24" width="32" height="26" rx="4" fill="none" stroke="#78350f" stroke-width="1.5"/>

      <!-- NFC Waves -->
      <path d="M 125 15 A 18 18 0 0 1 125 55" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/>
      <path d="M 137 5 A 32 32 0 0 1 137 65" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="3" stroke-linecap="round"/>
      <path d="M 149 -5 A 46 46 0 0 1 149 75" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="3" stroke-linecap="round"/>
    </g>

    <!-- Center Badge Icon / Hologram Ring -->
    <g transform="translate(300, 390)">
      <circle cx="0" cy="0" r="110" fill="none" stroke="rgba(56, 189, 248, 0.25)" stroke-width="2" stroke-dasharray="6 6"/>
      <circle cx="0" cy="0" r="92" fill="rgba(15, 23, 42, 0.8)" stroke="rgba(255, 255, 255, 0.15)" stroke-width="2"/>
      
      <!-- Cyber Shield / Diamond Icon -->
      <path d="M 0 -50 L 45 -15 L 30 45 L -30 45 L -45 -15 Z" fill="url(#accentLine)"/>
      <path d="M 0 -38 L 32 -10 L 20 32 L -20 32 L -32 -10 Z" fill="#0f172a"/>
      <text x="0" y="8" font-family="-apple-system, sans-serif" font-size="28" font-weight="900" fill="#38bdf8" text-anchor="middle">ROOT</text>
    </g>

    <!-- Owner Role & Clearance Title -->
    <g transform="translate(300, 560)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">SYSTEM ARCHITECT</text>
      <text x="0" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#38bdf8" text-anchor="middle" letter-spacing="3">SECURITY CLEARANCE // LEVEL 5</text>
      <text x="0" y="60" font-family="monospace" font-size="12" fill="#94a3b8" text-anchor="middle" letter-spacing="1">AUTH KEY: 0x9F4B·A712·C88E·ROOT</text>
    </g>

    <!-- Card Bottom Footer / Barcode -->
    <g transform="translate(50, 710)">
      <rect x="0" y="0" width="500" height="1" fill="rgba(255,255,255,0.15)"/>
      
      <!-- Barcode simulation -->
      <g transform="translate(0, 20)">
        <rect x="0" y="0" width="4" height="42" fill="#fff"/>
        <rect x="7" y="0" width="2" height="42" fill="#fff"/>
        <rect x="12" y="0" width="6" height="42" fill="#fff"/>
        <rect x="22" y="0" width="3" height="42" fill="#fff"/>
        <rect x="28" y="0" width="8" height="42" fill="#fff"/>
        <rect x="40" y="0" width="2" height="42" fill="#fff"/>
        <rect x="45" y="0" width="5" height="42" fill="#fff"/>
        <rect x="54" y="0" width="3" height="42" fill="#fff"/>
        <rect x="61" y="0" width="7" height="42" fill="#fff"/>
        <rect x="72" y="0" width="2" height="42" fill="#fff"/>
        <rect x="78" y="0" width="6" height="42" fill="#fff"/>
        <rect x="88" y="0" width="4" height="42" fill="#fff"/>
        <rect x="96" y="0" width="8" height="42" fill="#fff"/>
        <rect x="108" y="0" width="3" height="42" fill="#fff"/>
        <rect x="115" y="0" width="5" height="42" fill="#fff"/>
        <rect x="124" y="0" width="2" height="42" fill="#fff"/>
        <rect x="130" y="0" width="7" height="42" fill="#fff"/>
        <rect x="141" y="0" width="4" height="42" fill="#fff"/>
        <rect x="149" y="0" width="3" height="42" fill="#fff"/>
        <rect x="156" y="0" width="6" height="42" fill="#fff"/>
        <rect x="166" y="0" width="2" height="42" fill="#fff"/>
        <rect x="172" y="0" width="5" height="42" fill="#fff"/>
        <rect x="181" y="0" width="3" height="42" fill="#fff"/>
        <rect x="188" y="0" width="6" height="42" fill="#fff"/>
        <rect x="198" y="0" width="2" height="42" fill="#fff"/>
      </g>

      <text x="240" y="38" font-family="monospace" font-size="11" fill="#94a3b8">SERIES 2026.1 // PORT OS</text>
      <text x="240" y="56" font-family="monospace" font-size="10" fill="#64748b">ID: POS-8092-ARCHITECT</text>
    </g>
  </svg>
  `;

  // 2. BACK CARD (width: 600, height: 840)
  const backSvg = `
  <svg width="600" height="840" viewBox="0 0 600 840" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cardBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0c12"/>
        <stop offset="100%" stop-color="#11131c"/>
      </linearGradient>
      <linearGradient id="magStripe" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect x="0" y="0" width="600" height="840" rx="36" fill="url(#cardBackBg)"/>
    <rect x="2" y="2" width="596" height="836" rx="34" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

    <!-- Magnetic Stripe -->
    <rect x="0" y="80" width="600" height="110" fill="url(#magStripe)"/>
    <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="0" y1="190" x2="600" y2="190" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

    <!-- Signature Strip -->
    <g transform="translate(50, 240)">
      <rect x="0" y="0" width="360" height="54" rx="4" fill="#ffffff" opacity="0.95"/>
      <text x="18" y="34" font-family="'Brush Script MT', cursive, sans-serif" font-size="24" fill="#1e293b">Verified PortOS Architect</text>
      <rect x="375" y="0" width="125" height="54" rx="4" fill="rgba(255,255,255,0.08)"/>
      <text x="437" y="34" font-family="monospace" font-size="16" font-weight="700" fill="#38bdf8" text-anchor="middle">719-ROOT</text>
      <text x="0" y="74" font-family="-apple-system, sans-serif" font-size="10" fill="#64748b">AUTHORIZED SIGNATURE • NOT TRANSFERABLE</text>
    </g>

    <!-- Legal / Protocol Notice -->
    <g transform="translate(50, 360)">
      <text x="0" y="0" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#e2e8f0">PORTFOLIO OPERATING SYSTEM // KERNEL NOTICE</text>
      <text x="0" y="24" font-family="-apple-system, sans-serif" font-size="11" fill="#94a3b8" width="500">
        <tspan x="0" dy="0">This credential certifies executive level privileges across all system partitions,</tspan>
        <tspan x="0" dy="18">vault repositories, and interactive runtime microservices. Use of this access</tspan>
        <tspan x="0" dy="18">key is governed by zero-trust cryptographic verification protocols.</tspan>
      </text>
    </g>

    <!-- QR Code / Chip Pattern -->
    <g transform="translate(50, 480)">
      <!-- QR Frame -->
      <rect x="0" y="0" width="130" height="130" rx="10" fill="#ffffff"/>
      <rect x="12" y="12" width="36" height="36" fill="#0f172a"/>
      <rect x="18" y="18" width="24" height="24" fill="#ffffff"/>
      <rect x="24" y="24" width="12" height="12" fill="#0f172a"/>

      <rect x="82" y="12" width="36" height="36" fill="#0f172a"/>
      <rect x="88" y="18" width="24" height="24" fill="#ffffff"/>
      <rect x="94" y="24" width="12" height="12" fill="#0f172a"/>

      <rect x="12" y="82" width="36" height="36" fill="#0f172a"/>
      <rect x="18" y="88" width="24" height="24" fill="#ffffff"/>
      <rect x="24" y="94" width="12" height="12" fill="#0f172a"/>

      <!-- Random QR blocks -->
      <rect x="54" y="18" width="14" height="14" fill="#0f172a"/>
      <rect x="62" y="42" width="12" height="18" fill="#0f172a"/>
      <rect x="54" y="72" width="22" height="12" fill="#0f172a"/>
      <rect x="82" y="62" width="16" height="24" fill="#0f172a"/>
      <rect x="102" y="82" width="16" height="16" fill="#0f172a"/>
      <rect x="82" y="104" width="20" height="14" fill="#0f172a"/>

      <g transform="translate(160, 24)">
        <text x="0" y="16" font-family="monospace" font-size="12" font-weight="700" fill="#ffffff">SESSION TOKEN</text>
        <text x="0" y="38" font-family="monospace" font-size="11" fill="#38bdf8">0x8F9A·22BD·45C0·9911</text>
        <text x="0" y="60" font-family="monospace" font-size="10" fill="#64748b">ENCRYPTION: AES-GCM-256</text>
        <text x="0" y="78" font-family="monospace" font-size="10" fill="#64748b">STATUS: AUTHENTICATED</text>
      </g>
    </g>

    <!-- Bottom security notice -->
    <g transform="translate(50, 740)">
      <rect x="0" y="0" width="500" height="1" fill="rgba(255,255,255,0.12)"/>
      <text x="250" y="34" font-family="-apple-system, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">
        PORT OS 2026 • DESIGNED &amp; DEVELOPED BY PORT OS ARCHITECT
      </text>
    </g>
  </svg>
  `;

  // 3. STRAP BAND (width: 384, height: 768)
  const strapSvg = `
  <svg width="384" height="768" viewBox="0 0 384 768" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#090a0f"/>
        <stop offset="10%" stop-color="#141824"/>
        <stop offset="50%" stop-color="#1e2436"/>
        <stop offset="90%" stop-color="#141824"/>
        <stop offset="100%" stop-color="#090a0f"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="384" height="768" fill="url(#bandGrad)"/>
    
    <!-- Outer woven edge stitch -->
    <line x1="20" y1="0" x2="20" y2="768" stroke="#38bdf8" stroke-width="4" stroke-dasharray="10 8" opacity="0.6"/>
    <line x1="364" y1="0" x2="364" y2="768" stroke="#38bdf8" stroke-width="4" stroke-dasharray="10 8" opacity="0.6"/>

    <!-- Repeating Typography along strap -->
    <g transform="translate(192, 0)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="34" fill="#ffffff" letter-spacing="8" text-anchor="middle">
      <text x="0" y="90" fill="#38bdf8">PORT OS</text>
      <text x="0" y="160" font-size="20" fill="#94a3b8" letter-spacing="4">◆ ARCHITECT ◆</text>
      <text x="0" y="270" fill="#38bdf8">PORT OS</text>
      <text x="0" y="340" font-size="20" fill="#94a3b8" letter-spacing="4">◆ ARCHITECT ◆</text>
      <text x="0" y="450" fill="#38bdf8">PORT OS</text>
      <text x="0" y="520" font-size="20" fill="#94a3b8" letter-spacing="4">◆ ARCHITECT ◆</text>
      <text x="0" y="630" fill="#38bdf8">PORT OS</text>
      <text x="0" y="700" font-size="20" fill="#94a3b8" letter-spacing="4">◆ ARCHITECT ◆</text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(frontSvg)).png().toFile(path.join(publicDir, 'card-front.png'));
  console.log('  Created public/card-front.png');

  await sharp(Buffer.from(backSvg)).png().toFile(path.join(publicDir, 'card-back.png'));
  console.log('  Created public/card-back.png');

  await sharp(Buffer.from(strapSvg)).png().toFile(path.join(publicDir, 'band.png'));
  console.log('  Created public/band.png');

  console.log('Lanyard assets generation completed successfully.');
}

generateAssets().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
