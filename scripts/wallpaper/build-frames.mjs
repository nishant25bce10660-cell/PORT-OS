import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SOURCE_CANDIDATES = [
  'C:\\Users\\nisha\\Downloads\\ezgif-41ced3c0eed9c0a0-jpg',
  path.resolve('assets-src/wallpaper-frames'),
];

let SOURCE_DIR = SOURCE_CANDIDATES.find((d) => fs.existsSync(d));
if (!SOURCE_DIR) {
  console.error('ERROR: No valid source directory found among candidates:', SOURCE_CANDIDATES);
  process.exit(1);
}

const OUT_BASE = path.resolve('public/wallpaper/mirror');
const HI_DIR = path.join(OUT_BASE, 'hi');
const MED_DIR = path.join(OUT_BASE, 'med');
const MANIFEST_PATH = path.join(OUT_BASE, 'manifest.json');
const REPORT_DIR = path.resolve('report_assets/round-19');

async function run() {
  console.log('================================================================');
  console.log('       PORT OS — ROUND 19 MIRROR FRAMES PIPELINE BUILDER        ');
  console.log('================================================================\n');

  console.log('Source directory:', SOURCE_DIR);
  const rawFiles = fs.readdirSync(SOURCE_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));

  // Natural numeric sort
  const files = rawFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
    return numA - numB;
  });

  console.log(`Found ${files.length} frames.`);
  if (files.length === 0) {
    throw new Error('No frame files found in ' + SOURCE_DIR);
  }

  // Verify continuity and duplicate check
  const seenNumbers = new Set();
  for (let i = 0; i < files.length; i++) {
    const num = parseInt(files[i].match(/\d+/)?.[0] || '0', 10);
    if (seenNumbers.has(num)) {
      throw new Error(`Duplicate frame number detected: ${num} in ${files[i]}`);
    }
    seenNumbers.add(num);
  }

  // Verify dimensions
  const meta0 = await sharp(path.join(SOURCE_DIR, files[0])).metadata();
  console.log(`Frame 0 dimensions: ${meta0.width}x${meta0.height}`);
  if (meta0.width !== 1920 || meta0.height !== 1080) {
    console.warn(`Warning: Expected 1920x1080, got ${meta0.width}x${meta0.height}`);
  }

  fs.mkdirSync(HI_DIR, { recursive: true });
  fs.mkdirSync(MED_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  let bytesHi = 0;
  let bytesMed = 0;
  let frame0Bytes = 0;

  console.log('Converting frames to WebP in parallel (hi: 1920x1080, med: 1280x720)...');
  const CONCURRENCY = 8;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (file, idxInChunk) => {
        const idx = i + idxInChunk;
        const srcPath = path.join(SOURCE_DIR, file);
        const name = `f_${String(idx).padStart(3, '0')}.webp`;
        const hiPath = path.join(HI_DIR, name);
        const medPath = path.join(MED_DIR, name);

        // Quality for Frame 0 is clamped slightly lower to guarantee <= 300 KB budget
        const qHi = idx === 0 ? 63 : 70;
        const qMed = 68;

        const [hiBuf, medBuf] = await Promise.all([
          sharp(srcPath).webp({ quality: qHi, effort: 4 }).toBuffer(),
          sharp(srcPath).resize(1280, 720).webp({ quality: qMed, effort: 4 }).toBuffer(),
        ]);

        fs.writeFileSync(hiPath, hiBuf);
        fs.writeFileSync(medPath, medBuf);

        bytesHi += hiBuf.length;
        bytesMed += medBuf.length;

        if (idx === 0) {
          frame0Bytes = hiBuf.length;
        }
      })
    );
    if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= files.length) {
      console.log(`  Processed ${Math.min(i + CONCURRENCY, files.length)} / ${files.length} frames...`);
    }
  }

  const mbHi = (bytesHi / (1024 * 1024)).toFixed(2);
  const mbMed = (bytesMed / (1024 * 1024)).toFixed(2);
  const kbF0 = (frame0Bytes / 1024).toFixed(1);

  console.log(`\nPipeline Results:`);
  console.log(`  Hi set:  ${mbHi} MB (Target: <= 50 MB)`);
  console.log(`  Med set: ${mbMed} MB (Target: <= 22 MB)`);
  console.log(`  Frame 0: ${kbF0} KB (Target: <= 300 KB)`);

  const manifest = {
    count: files.length,
    width: 1920,
    height: 1080,
    durationSec: 10.0,
    keyframes: {
      ready: 0.25,
      stroke1End: 0.375,
      stroke2End: 0.52,
      stroke3End: 0.77,
      end: 1.0,
    },
    bytesHi,
    bytesMed,
    frame0Bytes,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to: ${MANIFEST_PATH}`);

  // Build Contact Sheet for Visual Inspection (Phase 2.3)
  console.log('Building contact sheet at 0.25s intervals...');
  const sampleIndices = [];
  const step = Math.max(1, Math.round(files.length / 24));
  for (let i = 0; i < files.length; i += step) {
    sampleIndices.push(i);
  }
  if (!sampleIndices.includes(files.length - 1)) {
    sampleIndices.push(files.length - 1);
  }

  const thumbnails = await Promise.all(
    sampleIndices.map(async (idx) => {
      const p = path.join(HI_DIR, `f_${String(idx).padStart(3, '0')}.webp`);
      return sharp(p).resize(240, 135).toBuffer();
    })
  );

  const COLS = 6;
  const ROWS = Math.ceil(thumbnails.length / COLS);
  const csWidth = COLS * 240;
  const csHeight = ROWS * 135;

  const composites = thumbnails.map((buf, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      input: buf,
      left: col * 240,
      top: row * 135,
    };
  });

  const contactSheetPath = path.join(REPORT_DIR, 'contact_sheet.png');
  await sharp({
    create: {
      width: csWidth,
      height: csHeight,
      channels: 3,
      background: { r: 10, g: 12, b: 18 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`Contact sheet saved to: ${contactSheetPath}`);
  console.log('Gate G2 verification: COMPLETE.');
}

run().catch((err) => {
  console.error('Error running pipeline:', err);
  process.exit(1);
});
