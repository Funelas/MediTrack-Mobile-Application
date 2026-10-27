import {supabase} from '../lib/supabase';

/**
 * Uploads a local image file to Supabase Storage and returns the public URL.
 * Uses ArrayBuffer instead of Blob for React Native compatibility.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const {error} = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, {upsert: true, contentType: `image/${ext}`});

  if (error) throw new Error(error.message);

  const {data} = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`; // cache bust
}

/**
 * Downloads a Google profile photo and re-uploads it to Supabase Storage.
 * This avoids repeated calls to Google's CDN on every app load.
 * Uses ArrayBuffer instead of Blob for React Native compatibility.
 */
export async function cacheGoogleAvatar(userId: string, googlePhotoUrl: string): Promise<string> {
  // Check if we already have a cached version
  const {data: existing} = await supabase.storage
    .from('avatars')
    .list(userId);

  const alreadyCached = existing?.some(f => f.name.startsWith('avatar'));
  if (alreadyCached) {
    const {data} = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar.jpg`);
    console.log('[Avatar] Already cached, returning:', data.publicUrl);
    return data.publicUrl;
  }

  // Download from Google as ArrayBuffer
  const response = await fetch(googlePhotoUrl);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/avatar.jpg`;

  const {error} = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, {upsert: true, contentType: 'image/jpeg'});

  console.log('[Avatar] Upload result:', error ?? 'success');
  if (error) throw new Error(error.message);

  const {data} = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
