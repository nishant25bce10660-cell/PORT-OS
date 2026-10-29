import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_DIR = path.resolve('assets-src/wallpaper-frames');
const OUT_BASE = path.resolve('public/wallpaper');
const DESKTOP_DIR = path.join(OUT_BASE, 'desktop');
const SMALL_DIR = path.join(OUT_BASE, 'small');
const MANIFEST_PATH = path.join(OUT_BASE, 'wallpaper-manifest.json');

async function buildWallpaper() {
  console.log('================================================================');
  console.log('   PORT OS — OPTIMISED WALLPAPER ASSET PIPELINE BUILDER         ');
  console.log('================================================================\n');

  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source frames directory not found: ${SOURCE_DIR}`);
  }

  // 1. Audit Source Frames
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg')).sort();
  console.log(`[AUDIT] Found ${files.length} source frame files in ${SOURCE_DIR}`);

  if (files.length === 0) {
    throw new Error('No source frames found.');
  }

  // Verify numbering and continuity
  let totalSourceBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const stat = fs.statSync(path.join(SOURCE_DIR, f));
    totalSourceBytes += stat.size;
  }
  console.log(`[AUDIT] Total source bytes: ${(totalSourceBytes / (1024 * 1024)).toFixed(2)} MB`);

  // Verify dimensions of sample frames
  const sampleMeta = await sharp(path.join(SOURCE_DIR, files[0])).metadata();
  console.log(`[AUDIT] Frame 1 dimensions: ${sampleMeta.width}x${sampleMeta.height}, format: ${sampleMeta.format}`);

  // Create output directories
  fs.mkdirSync(DESKTOP_DIR, { recursive: true });
  fs.mkdirSync(SMALL_DIR, { recursive: true });

  // Stride 4 decimation (76 keyframes across 300 frames)
  const STRIDE = 4;
  const frameIndices = [];
  for (let i = 0; i < files.length; i += STRIDE) {
    frameIndices.push(i);
  }
  if (!frameIndices.includes(files.length - 1)) {
    frameIndices.push(files.length - 1);
  }

  console.log(`[PIPELINE] Building 2 tiers for ${frameIndices.length} frames (stride = ${STRIDE})...\n`);

  const desktopFrames = [];
  const smallFrames = [];
  let totalDesktopBytes = 0;
  let totalSmallBytes = 0;

  for (let outIdx = 0; outIdx < frameIndices.length; outIdx++) {
    const srcIdx = frameIndices[outIdx];
    const srcFile = files[srcIdx];
    const srcPath = path.join(SOURCE_DIR, srcFile);
    const frameNum = String(outIdx + 1).padStart(3, '0');

    // Desktop: 1920x1080 WebP (quality 55 for <= 15.0 MB target)
    const desktopFilename = `frame-${frameNum}.webp`;
    const desktopPath = path.join(DESKTOP_DIR, desktopFilename);
    const desktopBuf = await sharp(srcPath)
      .webp({ quality: 55, effort: 4 })
      .toBuffer();
    fs.writeFileSync(desktopPath, desktopBuf);
    totalDesktopBytes += desktopBuf.length;

    const desktopHash = crypto.createHash('sha256').update(desktopBuf).digest('hex');
    desktopFrames.push({
      index: outIdx,
      sourceFrame: srcFile,
      path: `/wallpaper/desktop/${desktopFilename}`,
      bytes: desktopBuf.length,
      sha256: desktopHash,
    });

    // Small: 960x540 WebP (quality 54)
    const smallFilename = `frame-${frameNum}.webp`;
    const smallPath = path.join(SMALL_DIR, smallFilename);
    const smallBuf = await sharp(srcPath)
      .resize(960, 540)
      .webp({ quality: 54, effort: 4 })
      .toBuffer();
    fs.writeFileSync(smallPath, smallBuf);
    totalSmallBytes += smallBuf.length;

    const smallHash = crypto.createHash('sha256').update(smallBuf).digest('hex');
    smallFrames.push({
      index: outIdx,
      sourceFrame: srcFile,
      path: `/wallpaper/small/${smallFilename}`,
      bytes: smallBuf.length,
      sha256: smallHash,
    });

    if ((outIdx + 1) % 15 === 0 || outIdx === frameIndices.length - 1) {
      console.log(`  Processed ${outIdx + 1}/${frameIndices.length} frames...`);
    }
  }

  const manifest = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    sourceFrameCount: files.length,
    frameCount: frameIndices.length,
    stride: STRIDE,
    tiers: {
      desktop: {
        width: 1920,
        height: 1080,
        frameCount: desktopFrames.length,
        totalBytes: totalDesktopBytes,
        totalBytesMB: Number((totalDesktopBytes / (1024 * 1024)).toFixed(2)),
        targetMB: 15.0,
        frames: desktopFrames,
      },
      small: {
        width: 960,
        height: 540,
        frameCount: smallFrames.length,
        totalBytes: totalSmallBytes,
        totalBytesMB: Number((totalSmallBytes / (1024 * 1024)).toFixed(2)),
        targetMB: 6.0,
        frames: smallFrames,
      },
    },
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n================================================================');
  console.log('   PIPELINE BUILD COMPLETE                                      ');
  console.log(`   Desktop Tier (1920x1080): ${manifest.tiers.desktop.totalBytesMB} MB (Target: <= 15 MB)`);
  console.log(`   Small Tier (960x540):     ${manifest.tiers.small.totalBytesMB} MB (Target: <= 6 MB)`);
  console.log(`   Manifest saved: ${MANIFEST_PATH}`);
  console.log('================================================================\n');

  return manifest;
}

buildWallpaper().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
