import { NextRequest, NextResponse } from 'next/server';
import { getCenterBySlug } from '@/lib/utils/centers';
import { getAppEnv } from '@/lib/db/client';
import { insertPhoto, listPhotos } from '@/lib/db/photos';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { MAX_PHOTOS_PER_CENTER } from '@/lib/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/** Magic-byte signatures — file.type is attacker-controlled, so verify the bytes. */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Photo storage is not configured' }, { status: 503 });
  }

  const photos = await listPhotos(env, slug);
  return NextResponse.json({ photos, max: MAX_PHOTOS_PER_CENTER });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const center = getCenterBySlug(slug);
  if (!center) {
    return NextResponse.json({ error: 'Center not found' }, { status: 404 });
  }

  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Photo storage is not configured' }, { status: 503 });
  }

  const limit = await checkRateLimit(env.PHOTO_RATE_LIMITER, clientKey(request, 'photo'));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a minute and try again.' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const token = form.get('cf-turnstile-response');
  const verification = await verifyTurnstile(
    typeof token === 'string' ? token : null,
    env.TURNSTILE_SECRET_KEY,
    request.headers.get('cf-connecting-ip') ?? undefined,
  );
  if (!verification.success) {
    return NextResponse.json(
      { error: 'Human verification failed. Please refresh and try again.' },
      { status: 403 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 413 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(buffer);
  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, or WebP images are allowed' },
      { status: 415 },
    );
  }

  const r2Key = `photos/${slug}/${crypto.randomUUID()}.${EXTENSION[contentType]}`;
  await env.PHOTOS.put(r2Key, buffer, { httpMetadata: { contentType } });

  const photo = await insertPhoto(env, slug, r2Key, contentType, buffer.byteLength);
  if (!photo) {
    await env.PHOTOS.delete(r2Key);
    return NextResponse.json(
      { error: `This center already has the maximum of ${MAX_PHOTOS_PER_CENTER} photos` },
      { status: 409 },
    );
  }

  return NextResponse.json({ photo }, { status: 201 });
}
