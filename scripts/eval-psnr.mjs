import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

function calculatePSNR(bufA, bufB) {
  let mse = 0;
  const len = Math.min(bufA.length, bufB.length);
  for (let i = 0; i < len; i++) {
    const diff = bufA[i] - bufB[i];
    mse += diff * diff;
  }
  mse /= len;
  if (mse === 0) return 100;
  return 10 * Math.log10((255 * 255) / mse);
}

async function evaluate() {
  const samplePath = path.resolve('assets-src/wallpaper-frames/ezgif-frame-050.jpg');
  const origRaw = await sharp(samplePath).raw().toBuffer();

  for (const q of [50, 60, 65, 70]) {
    const dWebp = await sharp(samplePath).webp({ quality: q, effort: 5 }).toBuffer();
    const decRaw = await sharp(dWebp).raw().toBuffer();
    const psnr = calculatePSNR(origRaw, decRaw);

    const sWebp = await sharp(samplePath).resize(1280, 720).webp({ quality: q, effort: 5 }).toBuffer();
    console.log(`Quality ${q}: PSNR = ${psnr.toFixed(2)} dB, Desktop 1-frame = ${(dWebp.length/1024).toFixed(1)} KB, Small 1-frame = ${(sWebp.length/1024).toFixed(1)} KB`);
  }
}

evaluate().catch(console.error);
