import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function testDecimation() {
  const dir = path.resolve('assets-src/wallpaper-frames');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
  console.log('Total files found:', files.length);

  // Test stride 2 (150 frames), stride 3 (100 frames), stride 4 (75 frames)
  for (const stride of [2, 3, 4]) {
    const subset = files.filter((_, idx) => idx % stride === 0);
    // Include last frame always
    if (!subset.includes(files[files.length - 1])) subset.push(files[files.length - 1]);

    // Sample 10 frames to estimate total size
    let sampleDesktopBytes = 0;
    let sampleSmallBytes = 0;
    const sampleIndices = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(i => Math.min(i, subset.length - 1));

    for (const idx of sampleIndices) {
      const file = path.join(dir, subset[idx]);
      const dBuf = await sharp(file).webp({ quality: 62, effort: 4 }).toBuffer();
      const sBuf = await sharp(file).resize(1280, 720).webp({ quality: 58, effort: 4 }).toBuffer();
      sampleDesktopBytes += dBuf.length;
      sampleSmallBytes += sBuf.length;
    }

    const avgDesktop = sampleDesktopBytes / sampleIndices.length;
    const avgSmall = sampleSmallBytes / sampleIndices.length;
    const estDesktopTotalMB = (avgDesktop * subset.length) / (1024 * 1024);
    const estSmallTotalMB = (avgSmall * subset.length) / (1024 * 1024);

    console.log(`Stride ${stride} (${subset.length} frames): Est Desktop = ${estDesktopTotalMB.toFixed(2)} MB, Est Small = ${estSmallTotalMB.toFixed(2)} MB`);
  }
}

testDecimation().catch(console.error);
