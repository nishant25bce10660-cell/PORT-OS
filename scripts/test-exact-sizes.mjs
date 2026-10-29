import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function testExactSizes() {
  const dir = path.resolve('assets-src/wallpaper-frames');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
  const subset = [];
  for (let i = 0; i < files.length; i += 4) {
    subset.push(files[i]);
  }
  if (!subset.includes(files[files.length - 1])) {
    subset.push(files[files.length - 1]);
  }
  console.log(`Testing exact conversion of ${subset.length} frames...`);

  let totalDesktop = 0;
  let totalSmall720 = 0;
  let totalSmall540 = 0;

  for (const f of subset) {
    const p = path.join(dir, f);
    const d = await sharp(p).webp({ quality: 60, effort: 4 }).toBuffer();
    const s720 = await sharp(p).resize(1280, 720).webp({ quality: 50, effort: 4 }).toBuffer();
    const s540 = await sharp(p).resize(960, 540).webp({ quality: 55, effort: 4 }).toBuffer();
    totalDesktop += d.length;
    totalSmall720 += s720.length;
    totalSmall540 += s540.length;
  }

  console.log(`Results for ${subset.length} frames:`);
  console.log(`- Desktop (1920x1080, q=60): ${(totalDesktop / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- Small 720p (1280x720, q=50): ${(totalSmall720 / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- Small 540p (960x540, q=55): ${(totalSmall540 / (1024 * 1024)).toFixed(2)} MB`);
}

testExactSizes().catch(console.error);
