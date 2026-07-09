/**
 * IndexedDB media store — localStorage can't hold large photos/videos.
 * Posts keep mediaId; actual blob/data lives here.
 */

const DB_NAME = 'locket_dio_media_v1'
const STORE = 'media'
const mem = new Map() // session cache: id -> objectURL

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('No IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IDB open failed'))
  })
}

export async function putMedia(id, blobOrDataUrl, mime = 'image/jpeg') {
  let blob
  if (typeof blobOrDataUrl === 'string') {
    if (blobOrDataUrl.startsWith('data:')) {
      blob = await (await fetch(blobOrDataUrl)).blob()
    } else if (blobOrDataUrl.startsWith('blob:')) {
      blob = await (await fetch(blobOrDataUrl)).blob()
    } else {
      // remote URL — keep as-is, no store
      return { id, url: blobOrDataUrl, external: true }
    }
  } else {
    blob = blobOrDataUrl
  }

  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ id, blob, mime: blob.type || mime, createdAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[mediaStore] IDB put failed, using memory only', e)
  }

  if (mem.has(id)) {
    try { URL.revokeObjectURL(mem.get(id)) } catch { /* ignore */ }
  }
  const url = URL.createObjectURL(blob)
  mem.set(id, url)
  return { id, url, external: false }
}

export async function getMediaUrl(id) {
  if (!id) return null
  if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:'))) {
    return id
  }
  if (mem.has(id)) return mem.get(id)

  try {
    const db = await openDb()
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (!row?.blob) return null
    const url = URL.createObjectURL(row.blob)
    mem.set(id, url)
    return url
  } catch {
    return null
  }
}

export async function deleteMedia(id) {
  if (!id || id.startsWith?.('http') || id.startsWith?.('data:')) return
  if (mem.has(id)) {
    try { URL.revokeObjectURL(mem.get(id)) } catch { /* ignore */ }
    mem.delete(id)
  }
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* ignore */ }
}

/** Compress image dataURL for smaller storage */
export async function compressImageDataUrl(dataUrl, maxSide = 1080, quality = 0.82) {
  if (!dataUrl?.startsWith?.('data:image')) return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width: w, height: h } = img
      const scale = Math.min(1, maxSide / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
