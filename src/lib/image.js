// Resize + compress an image in the browser before upload (saves mobile data and storage).
export async function prepareImage(file, { max = 1600, quality = 0.86 } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|avif|gif)$/i.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.')
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is too large (max 20 MB).')
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await createImageBitmap(file)
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality))
  const type = blob && blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
  const out = blob && blob.type === 'image/webp' ? blob : await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
  const ext = type === 'image/webp' ? 'webp' : 'jpg'
  return new File([out], `${(file.name || 'image').replace(/\.[^.]+$/, '')}.${ext}`, { type })
}

export const fileToDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = () => rej(new Error('Could not read the image.'))
    r.readAsDataURL(file)
  })

export const imgSrc = (url) => url || '/sample-products/placeholder.svg'
