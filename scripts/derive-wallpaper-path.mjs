import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const FRAMES_DIR = path.resolve('assets-src/wallpaper-frames');
const OUT_PATH = path.resolve('public/wallpaper/wallpaper-path.json');

async function derivePath() {
  console.log('================================================================');
  console.log('   PORT OS — DERIVE WALLPAPER PATH & GEOMETRY FROM FRAMES       ');
  console.log('================================================================\n');

  const files = fs.readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).sort();
  console.log(`Analyzing ${files.length} frames...`);

  // 1. Read Frame 1 (clean steamy mirror baseline)
  const f1Path = path.join(FRAMES_DIR, files[0]);
  const f1Meta = await sharp(f1Path).metadata();
  const width = f1Meta.width;   // 1920
  const height = f1Meta.height; // 1080
  const f1Raw = await sharp(f1Path).raw().toBuffer(); // 1920*1080*3 bytes

  // 2. Read Final Frame (cleared N)
  const fnPath = path.join(FRAMES_DIR, files[files.length - 1]);
  const fnRaw = await sharp(fnPath).raw().toBuffer();

  // Find bounding box of changed pixels between Frame 1 and Final Frame
  let minX = width, maxX = 0, minY = height, maxY = 0;
  const THRESHOLD = 35; // local luminance diff
  const diffMap = new Uint8Array(width * height);

  for (let y = 50; y < height - 50; y++) {
    for (let x = 300; x < width - 300; x++) {
      const idx = (y * width + x) * 3;
      const r1 = f1Raw[idx], g1 = f1Raw[idx+1], b1 = f1Raw[idx+2];
      const rn = fnRaw[idx], gn = fnRaw[idx+1], bn = fnRaw[idx+2];
      const lum1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
      const lumn = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;
      const diff = Math.abs(lumn - lum1);

      if (diff > THRESHOLD) {
        diffMap[y * width + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Measured "N" bounding box:`);
  console.log(`  X: [${minX}, ${maxX}] (span: ${maxX - minX} px, center: ${((minX + maxX)/2).toFixed(1)} px)`);
  console.log(`  Y: [${minY}, ${maxY}] (span: ${maxY - minY} px, center: ${((minY + maxY)/2).toFixed(1)} px)`);

  // 3. Sample frames to locate hand-tip progression along the 3 strokes
  // Stroke 1 (Left Leg, moving UP): ~ Frames 25 to 100
  // Stroke 2 (Diagonal, moving DOWN-RIGHT): ~ Frames 101 to 160
  // Stroke 3 (Right Leg, moving UP): ~ Frames 161 to 215
  // Retraction: Frames 216 to 255
  // Rest: Frames 256 to 300

  // Measure center line of Stroke 1 (Left leg) and Stroke 3 (Right leg)
  // Find column with maximum vertical wipe around left side
  let maxColSumLeft = 0, leftCol = minX + 50;
  for (let x = minX; x < minX + 250; x++) {
    let colSum = 0;
    for (let y = minY; y <= maxY; y++) {
      colSum += diffMap[y * width + x];
    }
    if (colSum > maxColSumLeft) {
      maxColSumLeft = colSum;
      leftCol = x;
    }
  }

  // Find column with maximum vertical wipe around right side
  let maxColSumRight = 0, rightCol = maxX - 50;
  for (let x = maxX - 250; x <= maxX; x++) {
    let colSum = 0;
    for (let y = minY; y <= maxY; y++) {
      colSum += diffMap[y * width + x];
    }
    if (colSum > maxColSumRight) {
      maxColSumRight = colSum;
      rightCol = x;
    }
  }

  console.log(`Measured stroke leg centers:`);
  console.log(`  Left leg center X:  ${leftCol} px (normalized: ${(leftCol/width).toFixed(4)})`);
  console.log(`  Right leg center X: ${rightCol} px (normalized: ${(rightCol/width).toFixed(4)})`);
  console.log(`  Top Y:              ${minY} px (normalized: ${(minY/height).toFixed(4)})`);
  console.log(`  Bottom Y:           ${maxY} px (normalized: ${(maxY/height).toFixed(4)})`);

  // Compare against Round 19 constants
  console.log('\n--- Comparison against Round 19 Hardcoded Constants ---');
  console.log(`  Round 19 Left X:  580 px  | Measured: ${leftCol} px  (delta = ${leftCol - 580} px)`);
  console.log(`  Round 19 Right X: 1120 px | Measured: ${rightCol} px (delta = ${rightCol - 1120} px)`);
  console.log(`  Round 19 Top Y:   160 px  | Measured: ${minY} px     (delta = ${minY - 160} px)`);
  console.log(`  Round 19 Bottom Y:880 px  | Measured: ${maxY} px     (delta = ${maxY - 880} px)`);

  // 4. Build Polyline Points
  // Stroke 1: (leftCol, maxY) -> (leftCol, minY)
  // Stroke 2: (leftCol, minY) -> (rightCol, maxY)
  // Stroke 3: (rightCol, maxY) -> (rightCol, minY)
  const points = [];
  let totalLength = 0;

  // Stroke 1 points (25 steps)
  const s1Points = [];
  const s1Len = maxY - minY;
  for (let i = 0; i <= 25; i++) {
    const t = i / 25;
    const y = maxY - t * s1Len;
    s1Points.push({
      stroke: 1,
      x: leftCol,
      y: Math.round(y),
      normX: Number((leftCol / width).toFixed(4)),
      normY: Number((y / height).toFixed(4)),
      arcLength: totalLength + t * s1Len,
      frameIdx76: Math.round(6 + t * 19), // frames 25-100 in 300 = 6-25 in 76
      frameIdx300: Math.round(25 + t * 75),
    });
  }
  totalLength += s1Len;

  // Stroke 2 points (25 steps)
  const s2Points = [];
  const dx = rightCol - leftCol;
  const dy = maxY - minY;
  const s2Len = Math.hypot(dx, dy);
  for (let i = 1; i <= 25; i++) {
    const t = i / 25;
    const x = leftCol + t * dx;
    const y = minY + t * dy;
    s2Points.push({
      stroke: 2,
      x: Math.round(x),
      y: Math.round(y),
      normX: Number((x / width).toFixed(4)),
      normY: Number((y / height).toFixed(4)),
      arcLength: totalLength + t * s2Len,
      frameIdx76: Math.round(26 + t * 14), // frames 101-160 in 300 = 26-40 in 76
      frameIdx300: Math.round(101 + t * 59),
    });
  }
  totalLength += s2Len;

  // Stroke 3 points (25 steps)
  const s3Points = [];
  const s3Len = maxY - minY;
  for (let i = 1; i <= 25; i++) {
    const t = i / 25;
    const y = maxY - t * s3Len;
    s3Points.push({
      stroke: 3,
      x: rightCol,
      y: Math.round(y),
      normX: Number((rightCol / width).toFixed(4)),
      normY: Number((y / height).toFixed(4)),
      arcLength: totalLength + t * s3Len,
      frameIdx76: Math.round(41 + t * 13), // frames 161-215 in 300 = 41-54 in 76
      frameIdx300: Math.round(161 + t * 54),
    });
  }
  totalLength += s3Len;

  const allPoints = [...s1Points, ...s2Points, ...s3Points];

  // Normalized arc lengths (0 to 1)
  allPoints.forEach(p => {
    p.progress = Number((p.arcLength / totalLength).toFixed(4));
  });

  const pathData = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    sceneWidth: width,
    sceneHeight: height,
    boundingBox: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      center: {
        x: Number(((minX + maxX) / 2).toFixed(1)),
        y: Number(((minY + maxY) / 2).toFixed(1)),
      },
      safeRegion: {
        minX: Math.max(0, minX - 80),
        maxX: Math.min(width, maxX + 80),
        minY: Math.max(0, minY - 80),
        maxY: Math.min(height, maxY + 80),
      },
    },
    strokeCentres: {
      leftCol,
      rightCol,
      topY: minY,
      bottomY: maxY,
    },
    strokeBoundaries: {
      stroke1: {
        startFrame300: 25,
        endFrame300: 100,
        startFrame76: 6,
        endFrame76: 25,
        startProgress: 0.0,
        endProgress: Number((s1Len / totalLength).toFixed(4)),
      },
      stroke2: {
        startFrame300: 101,
        endFrame300: 160,
        startFrame76: 26,
        endFrame76: 40,
        startProgress: Number((s1Len / totalLength).toFixed(4)),
        endProgress: Number(((s1Len + s2Len) / totalLength).toFixed(4)),
      },
      stroke3: {
        startFrame300: 161,
        endFrame300: 215,
        startFrame76: 41,
        endFrame76: 54,
        startProgress: Number(((s1Len + s2Len) / totalLength).toFixed(4)),
        endProgress: 1.0,
      },
    },
    autonomousPhase: {
      retraction: {
        startFrame300: 216,
        endFrame300: 255,
        startFrame76: 55,
        endFrame76: 64,
      },
      settling: {
        startFrame300: 256,
        endFrame300: 300,
        startFrame76: 65,
        endFrame76: 76,
      },
    },
    totalArcLength: Math.round(totalLength),
    points: allPoints,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(pathData, null, 2), 'utf8');
  console.log(`[SUCCESS] Saved derived path to ${OUT_PATH}`);
  return pathData;
}

derivePath().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
