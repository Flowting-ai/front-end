/** Largest source image accepted for an avatar before downscaling. */
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024

/**
 * Downscales an image file to fit within `maxW` × `maxH` and re-encodes it as a
 * JPEG `data:` URL. Rejects if the browser can't decode the file.
 */
export function compressImageToDataUrl(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode the image.'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxW) { height = (height * maxW) / width; width = maxW }
        if (height > maxH) { width = (width * maxH) / height; height = maxH }
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width))
        canvas.height = Math.max(1, Math.round(height))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('Could not process the image.')); return }
        context.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
