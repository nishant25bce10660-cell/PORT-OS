import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function testWebP() {
  const sample = path.resolve('assets-src/wallpaper-frames/ezgif-frame-001.jpg');
  const meta = await sharp(sample).metadata();
  console.log('Sample metadata:', meta);

  for (const q of [75, 80, 85]) {
    const dBuf = await sharp(sample).webp({ quality: q, effort: 4 }).toBuffer();
    const sBuf = await sharp(sample).resize(1280, 720).webp({ quality: q, effort: 4 }).toBuffer();
    console.log(`Quality ${q}: Desktop (1920x1080) = ${(dBuf.length / 1024).toFixed(1)} KB (Total 300: ${(dBuf.length * 300 / 1024 / 1024).toFixed(2)} MB), Small (1280x720) = ${(sBuf.length / 1024).toFixed(1)} KB (Total 300: ${(sBuf.length * 300 / 1024 / 1024).toFixed(2)} MB)`);
  }
}

testWebP().catch(console.error);
