import { NextRequest, NextResponse } from 'next/server';
import { getAppEnv } from '@/lib/db/client';
import { getPhoto } from '@/lib/db/photos';

/**
 * Streams an R2 object to the browser. Used when the bucket is private and no
 * PHOTO_PUBLIC_BASE_URL custom domain is configured.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const env = getAppEnv();
  if (!env) {
    return NextResponse.json({ error: 'Photo storage is not configured' }, { status: 503 });
  }

  const photo = await getPhoto(env, id);
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const object = await env.PHOTOS.get(photo.r2_key);
  if (!object) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
