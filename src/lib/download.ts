import { supabase } from './supabase'

/** Short-lived link to a private file, made by the signed-download function with the caller's own permissions (and a rate limit). */
export async function signedUrl(bucket: string, path: string, expiresIn = 60): Promise<string> {
  const { data, error } = await supabase.functions.invoke('signed-download', { body: { bucket, path, expiresIn } })
  if (error) throw error
  return (data as { url: string }).url
}

export async function openPrivateFile(bucket: string, path: string) {
  const url = await signedUrl(bucket, path)
  window.open(url, '_blank', 'noopener')
}

export async function fetchPrivateBlob(bucket: string, path: string): Promise<Blob> {
  const res = await fetch(await signedUrl(bucket, path))
  if (!res.ok) throw new Error('Could not download the file')
  return await res.blob()
}

export const safeFileName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80)
