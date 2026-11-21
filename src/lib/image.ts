/** Shrinks a photo before upload (max 1600 px, JPEG 80%): a 5 MB phone photo becomes ~250 KB, which keeps storage and download traffic low. Non-images and small files pass through unchanged. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 300_000) return file
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h); bmp.close?.()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}
