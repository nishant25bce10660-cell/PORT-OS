import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateHostAndOrigin } from '@/lib/security';

const MAX_FONT_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { fontName, fileBase64, sizeBytes } = body;

    if (!fileBase64) {
      return NextResponse.json({ error: 'Font file payload is required' }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const actualSize = sizeBytes || buffer.length;

    if (actualSize > MAX_FONT_SIZE || buffer.length > MAX_FONT_SIZE) {
      return NextResponse.json(
        { error: 'Font file exceeds 2 MB limit' },
        { status: 400 }
      );
    }

    // Check magic bytes
    if (buffer.length < 4) {
      return NextResponse.json({ error: 'Invalid font file header' }, { status: 400 });
    }

    const b0 = buffer[0];
    const b1 = buffer[1];
    const b2 = buffer[2];
    const b3 = buffer[3];

    const isTTF = (b0 === 0x00 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) ||
                  (b0 === 0x74 && b1 === 0x72 && b2 === 0x75 && b3 === 0x65); // 'true'
    const isOTTO = (b0 === 0x4f && b1 === 0x54 && b2 === 0x54 && b3 === 0x4f); // 'OTTO'
    const isWOFF = (b0 === 0x77 && b1 === 0x4f && b2 === 0x46 && b3 === 0x46); // 'wOFF'
    const isWOFF2 = (b0 === 0x77 && b1 === 0x4f && b2 === 0x46 && b3 === 0x32); // 'wOF2'

    if (!isTTF && !isOTTO && !isWOFF && !isWOFF2) {
      return NextResponse.json(
        { error: 'Invalid font format: Magic bytes do not match TTF, OTF, WOFF or WOFF2' },
        { status: 400 }
      );
    }

    const safeName = (fontName || 'CustomFont').replace(/[^a-zA-Z0-9_-]/g, '');
    const fontFormat = isWOFF2 ? 'woff2' : isWOFF ? 'woff' : isOTTO ? 'opentype' : 'truetype';

    return NextResponse.json({
      success: true,
      fontName: safeName,
      format: fontFormat,
      cssFontFace: `@font-face { font-family: '${safeName}'; src: url(data:font/${fontFormat};base64,${fileBase64}) format('${fontFormat}'); }`,
    });
  } catch (err) {
    console.error('Error uploading font:', err);
    return NextResponse.json({ error: 'Failed to process font' }, { status: 500 });
  }
}
