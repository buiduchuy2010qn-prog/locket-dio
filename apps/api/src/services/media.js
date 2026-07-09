import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { v2 as cloudinary } from 'cloudinary'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../../../uploads')

let cloudReady = false
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  })
  cloudReady = true
}

export function isCloudinaryEnabled() {
  return cloudReady
}

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
}

/**
 * Process & store image buffer. Compresses with sharp.
 * Falls back to local disk if Cloudinary not configured.
 */
export async function uploadImageBuffer(buffer, { folder, filename }) {
  const processed = await sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()

  const meta = await sharp(processed).metadata()

  if (cloudReady) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${config.cloudinary.folder}/${folder || 'moments'}`,
          public_id: filename,
          resource_type: 'image',
        },
        (err, res) => (err ? reject(err) : resolve(res)),
      )
      stream.end(processed)
    })
    return {
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl: result.secure_url,
      mimeType: 'image/jpeg',
      sizeBytes: processed.length,
      width: result.width || meta.width,
      height: result.height || meta.height,
      type: 'IMAGE',
    }
  }

  await ensureLocalDir()
  const name = `${filename || Date.now()}.jpg`
  const rel = path.join('uploads', name)
  const abs = path.join(LOCAL_UPLOAD_DIR, name)
  await fs.writeFile(abs, processed)
  return {
    url: `${config.apiUrl}/media/local/${name}`,
    publicId: name,
    thumbnailUrl: `${config.apiUrl}/media/local/${name}`,
    mimeType: 'image/jpeg',
    sizeBytes: processed.length,
    width: meta.width,
    height: meta.height,
    type: 'IMAGE',
  }
}

export async function uploadVideoFile(filePath, { folder, filename, durationSec }) {
  if (cloudReady) {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `${config.cloudinary.folder}/${folder || 'moments'}`,
      public_id: filename,
      resource_type: 'video',
    })
    return {
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl: result.secure_url.replace(/\.[^.]+$/, '.jpg'),
      mimeType: result.format ? `video/${result.format}` : 'video/mp4',
      sizeBytes: result.bytes,
      width: result.width,
      height: result.height,
      durationSec: durationSec ?? result.duration,
      type: 'VIDEO',
    }
  }

  await ensureLocalDir()
  const name = `${filename || Date.now()}.mp4`
  const abs = path.join(LOCAL_UPLOAD_DIR, name)
  await fs.copyFile(filePath, abs)
  return {
    url: `${config.apiUrl}/media/local/${name}`,
    publicId: name,
    thumbnailUrl: null,
    mimeType: 'video/mp4',
    sizeBytes: (await fs.stat(abs)).size,
    durationSec: durationSec || null,
    type: 'VIDEO',
  }
}

export async function deleteMedia(publicId, resourceType = 'image') {
  if (!publicId) return
  if (cloudReady) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    } catch (e) {
      console.warn('[media delete]', e.message)
    }
    return
  }
  try {
    await fs.unlink(path.join(LOCAL_UPLOAD_DIR, publicId))
  } catch { /* ignore */ }
}

export function validateUploadSize(size, maxBytes) {
  if (size > maxBytes) {
    throw new AppError(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB`, 400, 'FILE_TOO_LARGE')
  }
}

export { LOCAL_UPLOAD_DIR }
