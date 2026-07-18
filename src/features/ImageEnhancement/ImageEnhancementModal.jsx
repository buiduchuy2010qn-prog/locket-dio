import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_ENHANCE_MODE,
  ENHANCE_MODES,
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
  error,
  mode,
  onModeChange,
  originalUrl,
  enhancedUrl,
  offline,
  providerMissing,
  onStart,
  onCancel,
  onUseAi,
  onKeepOriginal,
  onRetry,
  onClose,
}) {
  if (!open) return null;

  const modes = useMemo(() => Object.values(ENHANCE_MODES), []);
  const showCompare = Boolean(enhancedUrl) && !busy;

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
              ✨ AI Làm nét
            </h2>
            <p className="text-[11px] opacity-60">
              {PROVIDER_DISCLOSURE.provider} · {PROVIDER_DISCLOSURE.latencyHint}
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
                  {busy ? "Đang xử lý…" : "Sau AI"}
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
              <p className="text-sm">{progressText || "AI đang cải thiện ảnh…"}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {offline && (
            <p className="text-sm opacity-70">Cần kết nối mạng để dùng AI.</p>
          )}

          {providerMissing && (
            <div className="text-[11px] opacity-70 bg-base-200 rounded-lg p-2 space-y-0.5">
              <p className="font-medium opacity-90">Provider chưa cấu hình</p>
              <p>Model: {PROVIDER_DISCLOSURE.model}</p>
              <p>Chi phí: {PROVIDER_DISCLOSURE.costHint}</p>
              <p>Thời gian: {PROVIDER_DISCLOSURE.latencyHint}</p>
              <p>Bên thứ ba: {PROVIDER_DISCLOSURE.thirdParty}</p>
              <p>Lưu trữ: {PROVIDER_DISCLOSURE.retention}</p>
            </div>
          )}
        </div>

        <footer className="p-3 border-t border-base-300 flex flex-col gap-2 shrink-0">
          {!showCompare && !busy && (
            <button
              type="button"
              className="btn btn-primary btn-sm w-full rounded-full"
              disabled={offline || busy}
              onClick={onStart}
            >
              {offline ? "Cần kết nối mạng" : "Bắt đầu làm nét"}
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
                onClick={onUseAi}
              >
                Dùng ảnh AI
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full rounded-full bg-base-200"
                onClick={onKeepOriginal}
              >
                Giữ ảnh gốc
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
          {!busy && error && (
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
