/**
 * Square 1:1 crop helpers — pan/zoom → canvas export (no stretch).
 */

/** Load image from URL/dataURL */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Cover-fit: scale image so it fills square of size `frameSize`,
 * then apply user pan (offsetX/Y in frame coords) and zoom multiplier.
 *
 * @param {HTMLImageElement} img
 * @param {object} opts
 * @param {number} opts.frameSize - output pixels (default 1080)
 * @param {number} opts.zoom - 1 = cover minimum, >1 zoom in
 * @param {number} opts.offsetX - pan in frame pixels (positive = image moves right)
 * @param {number} opts.offsetY - pan in frame pixels
 * @param {string} opts.mime - image/jpeg | image/png
 * @param {number} opts.quality - 0–1 for jpeg
 */
export async function exportSquareCrop(imgSrc, opts = {}) {
  const {
    frameSize = 1080,
    zoom = 1,
    offsetX = 0,
    offsetY = 0,
    mime = 'image/jpeg',
    quality = 0.9,
  } = opts

  const img = typeof imgSrc === 'string' ? await loadImage(imgSrc) : imgSrc
  const canvas = document.createElement('canvas')
  canvas.width = frameSize
  canvas.height = frameSize
  const ctx = canvas.getContext('2d')

  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const cover = Math.max(frameSize / iw, frameSize / ih) * Math.max(0.5, zoom)
  const dw = iw * cover
  const dh = ih * cover
  // center + pan
  const dx = (frameSize - dw) / 2 + offsetX
  const dy = (frameSize - dh) / 2 + offsetY

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, frameSize, frameSize)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)

  return canvas.toDataURL(mime, quality)
}

/** Default cover zoom so image fills the square */
export function coverZoomForImage(imgW, imgH, frame = 1) {
  // zoom=1 already means cover in exportSquareCrop
  return 1
}

/** Clamp pan so image always covers the frame */
export function clampPan(offsetX, offsetY, imgW, imgH, frameSize, zoom) {
  const cover = Math.max(frameSize / imgW, frameSize / imgH) * Math.max(0.5, zoom)
  const dw = imgW * cover
  const dh = imgH * cover
  const maxX = Math.max(0, (dw - frameSize) / 2)
  const maxY = Math.max(0, (dh - frameSize) / 2)
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, offsetY)),
  }
}
