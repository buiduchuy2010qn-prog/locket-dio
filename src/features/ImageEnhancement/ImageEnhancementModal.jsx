import React, { useMemo } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_ENHANCE_MODE,
  ENHANCE_MODES,
  ENHANCE_PROVIDER,
  ENHANCE_UI,
  PROVIDER_DISCLOSURE,
} from "./constants";

/**
 * Before/After + progress UI for AI enhance.
 * Pure presentation — no camera/music imports.
 */
export default function ImageEnhancementModal({
  open,
  busy,
  progressText,
  progressPercent,
  error,
  errorCode,
  mode,
  onModeChange,
  provider,
  onProviderChange,
  cloudAvailable,
  originalUrl,
  enhancedUrl,
  offline,
  onStart,
  onCancel,
  onUseResult,
  onKeepOriginal,
  onRetry,
  onUseFreeFallback,
  onClose,
}) {
  if (!open) return null;

  const modes = useMemo(() => Object.values(ENHANCE_MODES), []);
  const showCompare = Boolean(enhancedUrl) && !busy;
  const disclosure =
    provider === ENHANCE_PROVIDER.CLOUD
      ? PROVIDER_DISCLOSURE.cloud
      : PROVIDER_DISCLOSURE.local;
  const isCreditError = errorCode === "INSUFFICIENT_CREDIT";
  const isOom = errorCode === "OOM";
  const needsNetOnce = errorCode === "MODEL_NEEDS_NETWORK";

  // Local can work offline after model cached; only block start for cloud when offline
  const startDisabled =
    busy ||
    (provider === ENHANCE_PROVIDER.CLOUD && offline) ||
    (provider === ENHANCE_PROVIDER.CLOUD && !cloudAvailable);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-3 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-enhance-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-base-100 border border-base-300 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <div>
            <h2 id="ai-enhance-title" className="font-semibold text-base">
              ✨ {ENHANCE_UI.title}
            </h2>
            <p className="text-[11px] opacity-60">
              {disclosure.provider} · {disclosure.latencyHint}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-3 overflow-y-auto flex-1 space-y-3">
          {/* Provider picker */}
          {!showCompare && (
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => onProviderChange(ENHANCE_PROVIDER.LOCAL)}
                className={`btn btn-sm justify-start h-auto py-2 rounded-xl ${
                  provider === ENHANCE_PROVIDER.LOCAL
                    ? "btn-primary"
                    : "btn-ghost bg-base-200"
                }`}
              >
                <span className="flex flex-col items-start text-left gap-0.5">
                  <span className="font-medium">{ENHANCE_UI.providerLocal}</span>
                  <span className="text-[10px] opacity-70 font-normal">
                    {ENHANCE_UI.providerLocalHint}
                  </span>
                </span>
              </button>
              {cloudAvailable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onProviderChange(ENHANCE_PROVIDER.CLOUD)}
                  className={`btn btn-sm justify-start h-auto py-2 rounded-xl ${
                    provider === ENHANCE_PROVIDER.CLOUD
                      ? "btn-primary"
                      : "btn-ghost bg-base-200"
                  }`}
                >
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-medium">{ENHANCE_UI.providerCloud}</span>
                    <span className="text-[10px] opacity-70 font-normal">
                      {ENHANCE_UI.providerCloudHint}
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Mode picker */}
          {!showCompare && (
            <div className="flex flex-wrap gap-1.5">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onModeChange(m.id)}
                  className={`btn btn-xs rounded-full ${
                    mode === m.id ? "btn-primary" : "btn-ghost bg-base-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {!showCompare && (
            <p className="text-xs opacity-70">
              {ENHANCE_MODES[mode]?.description ||
                ENHANCE_MODES[DEFAULT_ENHANCE_MODE].description}
            </p>
          )}

          {/* Preview area */}
          <div className="grid grid-cols-2 gap-2">
            <figure className="rounded-xl overflow-hidden bg-base-300 aspect-square relative">
              {originalUrl ? (
                <img
                  src={originalUrl}
                  alt="Trước"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
                  Gốc
                </div>
              )}
              <figcaption className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/55 text-white">
                Trước
              </figcaption>
            </figure>
            <figure className="rounded-xl overflow-hidden bg-base-300 aspect-square relative">
              {enhancedUrl ? (
                <img
                  src={enhancedUrl}
                  alt="Sau"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs opacity-50 px-2 text-center">
                  {busy ? "Đang xử lý…" : ENHANCE_UI.afterLabel}
                </div>
              )}
              <figcaption className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/55 text-white">
                Sau
              </figcaption>
            </figure>
          </div>

          {busy && (
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="loading loading-spinner loading-md text-primary" />
              <p className="text-sm text-center">
                {progressText || ENHANCE_UI.progress}
              </p>
              {typeof progressPercent === "number" && progressPercent > 0 && (
                <div className="w-full max-w-xs">
                  <progress
                    className="progress progress-primary w-full"
                    value={progressPercent}
                    max={100}
                  />
                  <p className="text-[10px] text-center opacity-60 mt-0.5">
                    {progressPercent}%
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {provider === ENHANCE_PROVIDER.CLOUD && offline && (
            <p className="text-sm opacity-70">{ENHANCE_UI.needNetwork}</p>
          )}

          {needsNetOnce && (
            <p className="text-xs opacity-70">{ENHANCE_UI.needNetworkOnce}</p>
          )}

          {!showCompare && !busy && (
            <p className="text-[10px] opacity-50">
              {disclosure.costHint} · {disclosure.thirdParty}
            </p>
          )}
        </div>

        <footer className="p-3 border-t border-base-300 flex flex-col gap-2 shrink-0">
          {!showCompare && !busy && !isCreditError && (
            <button
              type="button"
              className="btn btn-primary btn-sm w-full rounded-full"
              disabled={startDisabled}
              onClick={onStart}
            >
              {provider === ENHANCE_PROVIDER.CLOUD && offline
                ? "Cần kết nối mạng"
                : "Bắt đầu làm nét"}
            </button>
          )}
          {busy && (
            <button
              type="button"
              className="btn btn-ghost btn-sm w-full rounded-full"
              onClick={onCancel}
            >
              Hủy
            </button>
          )}
          {showCompare && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm w-full rounded-full"
                onClick={onUseResult}
              >
                {ENHANCE_UI.useResult}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full rounded-full bg-base-200"
                onClick={onKeepOriginal}
              >
                {ENHANCE_UI.keepOriginal}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs w-full"
                onClick={onRetry}
              >
                Thử lại
              </button>
            </>
          )}
          {!busy && isCreditError && (
            <button
              type="button"
              className="btn btn-primary btn-sm w-full rounded-full"
              onClick={onUseFreeFallback}
            >
              {ENHANCE_UI.useFreeButton}
            </button>
          )}
          {!busy && error && !isCreditError && !isOom && (
            <button
              type="button"
              className="btn btn-outline btn-sm w-full rounded-full"
              onClick={onRetry}
            >
              Thử lại
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
