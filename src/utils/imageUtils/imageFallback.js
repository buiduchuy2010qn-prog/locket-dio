export const imageFallback =
  (fallbackSrc = "/images/default_profile.png") =>
  (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = fallbackSrc;
  };