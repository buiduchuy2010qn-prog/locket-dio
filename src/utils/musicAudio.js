/**
 * Global music audio — 1 thẻ Audio dùng chung toàn app.
 * Tránh React effect cleanup pause/load lại làm mất tiếng giữa chừng.
 */

let audio = null;
/** @type {string|null} */
let currentKey = null;
/** @type {Set<(s: {playing:boolean,key:string|null,loading:boolean,error:string})=>void>} */
const listeners = new Set();

const state = {
  playing: false,
  key: null,
  loading: false,
  error: "",
};

function emit() {
  const snap = { ...state };
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* ignore */
    }
  });
}

function ensureAudio() {
  if (typeof window === "undefined") return null;
  if (audio) return audio;

  audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  try {
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
  } catch {
    /* ignore */
  }
  // Không set crossOrigin — iTunes CDN cho phép phát anonymous

  audio.addEventListener("play", () => {
    state.playing = true;
    state.loading = false;
    state.error = "";
    emit();
  });
  audio.addEventListener("pause", () => {
    state.playing = false;
    emit();
  });
  audio.addEventListener("ended", () => {
    // loop=true thường không fire; fallback restart
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {
        state.playing = false;
        emit();
      });
    } catch {
      state.playing = false;
      emit();
    }
  });
  audio.addEventListener("waiting", () => {
    state.loading = true;
    emit();
  });
  audio.addEventListener("canplay", () => {
    state.loading = false;
    emit();
  });
  audio.addEventListener("error", () => {
    state.playing = false;
    state.loading = false;
    state.error = "Không phát được file nghe thử";
    emit();
  });

  return audio;
}

export function subscribeMusicAudio(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getMusicAudioState() {
  return { ...state };
}

/**
 * @param {string} url
 * @param {string} key unique per moment/track
 */
export async function playMusicUrl(url, key = "default") {
  const a = ensureAudio();
  if (!a || !url) {
    state.error = "Không có file nghe thử";
    emit();
    return false;
  }

  state.loading = true;
  state.error = "";
  state.key = key;
  currentKey = key;
  emit();

  try {
    // Đổi src chỉ khi khác — tránh load lại làm giật
    const abs = (() => {
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    })();

    if (a.src !== abs) {
      a.pause();
      a.src = url;
      a.load();
    }
    a.loop = true;
    a.muted = false;
    a.volume = 1;
    await a.play();
    state.playing = true;
    state.loading = false;
    state.error = "";
    emit();
    return true;
  } catch (err) {
    console.warn("[musicAudio] play failed:", err?.message || err);
    state.playing = false;
    state.loading = false;
    state.error = "Chạm lại để nghe (trình duyệt chặn autoplay)";
    emit();
    return false;
  }
}

export function pauseMusic() {
  const a = ensureAudio();
  if (!a) return;
  try {
    a.pause();
  } catch {
    /* ignore */
  }
  state.playing = false;
  emit();
}

/**
 * Toggle play/pause cho key hiện tại.
 * @returns {Promise<'play'|'pause'|'error'>}
 */
export async function toggleMusicUrl(url, key = "default") {
  const a = ensureAudio();
  if (!a) return "error";

  // Đang phát cùng bài → pause
  if (state.playing && currentKey === key && !a.paused) {
    pauseMusic();
    return "pause";
  }

  // Đang phát bài khác → dừng rồi phát mới
  if (state.playing && currentKey !== key) {
    pauseMusic();
  }

  const ok = await playMusicUrl(url, key);
  return ok ? "play" : "error";
}

export function stopMusicIfKey(key) {
  if (currentKey === key) pauseMusic();
}
