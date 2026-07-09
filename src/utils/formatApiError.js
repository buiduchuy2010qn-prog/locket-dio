/**
 * Rút message chữ từ lỗi axios / API Dio (message đôi khi là object).
 */
export function formatApiError(err, fallback = "Lỗi không xác định") {
  if (err == null) return fallback;
  if (typeof err === "string") return err.slice(0, 200);
  if (typeof err === "number" || typeof err === "boolean") return String(err);

  const data = err?.response?.data ?? err?.data ?? null;
  const status = err?.response?.status || err?.status || data?.status;

  const candidates = [
    data?.message,
    data?.error?.message,
    data?.error,
    data?.msg,
    data?.detail,
    err?.message,
    data,
  ];

  for (const c of candidates) {
    const text = coerceErrorText(c);
    if (text) {
      const prefix = status ? `${status}: ` : "";
      // tránh "400: Request failed with status code 400"
      if (/^Request failed with status code/i.test(text) && data) {
        const nested = coerceErrorText(data.message) || coerceErrorText(data.error);
        if (nested) return `${prefix}${nested}`.slice(0, 200);
      }
      return `${prefix}${text}`.slice(0, 200);
    }
  }

  try {
    if (data && typeof data === "object") {
      return `${status ? status + ": " : ""}${JSON.stringify(data)}`.slice(0, 200);
    }
  } catch {
    /* ignore */
  }

  return status ? `Lỗi HTTP ${status}` : fallback;
}

function coerceErrorText(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t && t !== "[object Object]" ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // Dio / Firebase-style nested errors
    const nested =
      coerceErrorText(value.message) ||
      coerceErrorText(value.error) ||
      coerceErrorText(value.msg) ||
      coerceErrorText(value.vi) ||
      coerceErrorText(value.en) ||
      coerceErrorText(value.code) ||
      coerceErrorText(value.status);
    if (nested) return nested;
    try {
      const s = JSON.stringify(value);
      if (s && s !== "{}" && s !== "null") return s;
    } catch {
      /* ignore */
    }
  }
  return null;
}
