import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePostStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";
import { DEFAULT_ENHANCE_MODE, ENHANCE_UI } from "./constants";
import { assertEnhanceableFile } from "./validateClient";

const ImageEnhancementModal = lazy(() => import("./ImageEnhancementModal"));

/**
 * Post-capture only. Does not import camera hooks or music modules.
 * Lazy-loads enhancement service + modal on first open.
 * Default path is free server-side sharp (not third-party AI).
 */
export default function ImageEnhancementButton() {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const originalFile = usePostStore((s) => s.originalFile);
  const enhancement = usePostStore((s) => s.enhancement);
  const setActiveMediaFile = usePostStore((s) => s.setActiveMediaFile);
  const revertEnhancement = usePostStore((s) => s.revertEnhancement);
  const ensureOriginalFile = usePostStore((s) => s.ensureOriginalFile);

  const isOffline = useConnectivityStore((s) => s.isOffline);
  const serverReachable = useConnectivityStore((s) => s.serverReachable);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(DEFAULT_ENHANCE_MODE);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [providerMissing, setProviderMissing] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [enhancedFile, setEnhancedFile] = useState(null);
  const [jobId, setJobId] = useState(null);

  const abortRef = useRef(null);
  const jobLockRef = useRef(false);
  const enhancedUrlRef = useRef(null);

  const isImage =
    preview?.type === "image" ||
    (selectedFile && String(selectedFile.type || "").startsWith("image/"));

  const online = !isOffline && serverReachable !== false;
  const originalUrl = preview?.type === "image" ? preview.data : null;

  const revokeEnhancedUrl = () => {
    if (enhancedUrlRef.current) {
      try {
        URL.revokeObjectURL(enhancedUrlRef.current);
      } catch {
        /* ignore */
      }
      enhancedUrlRef.current = null;
    }
    setEnhancedUrl(null);
    setEnhancedFile(null);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeEnhancedUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New capture session → clear compare state
  useEffect(() => {
    if (!selectedFile) {
      setOpen(false);
      setError("");
      revokeEnhancedUrl();
      jobLockRef.current = false;
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const openModal = () => {
    ensureOriginalFile?.();
    setError("");
    setProviderMissing(false);
    revokeEnhancedUrl();
    setOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setOpen(false);
    setError("");
  };

  const cancelJob = async () => {
    abortRef.current?.abort();
    if (jobId) {
      try {
        const { cancelEnhancementJob } = await import("./ImageEnhancementService");
        await cancelEnhancementJob(jobId);
      } catch {
        /* ignore */
      }
    }
    setBusy(false);
    jobLockRef.current = false;
    setProgressText("");
    setJobId(null);
    SonnerInfo(ENHANCE_UI.cancel);
  };

  const runEnhance = useCallback(async () => {
    if (jobLockRef.current || busy) return;
    const file = originalFile || selectedFile;
    const check = assertEnhanceableFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (!online) {
      setError(ENHANCE_UI.needNetwork);
      return;
    }

    jobLockRef.current = true;
    setBusy(true);
    setError("");
    setProviderMissing(false);
    revokeEnhancedUrl();
    setProgressText(ENHANCE_UI.progress);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { enhanceImageFile } = await import("./ImageEnhancementService");
      const result = await enhanceImageFile(file, mode, {
        signal: ac.signal,
        onProgress: (p) => {
          if (p.jobId) setJobId(p.jobId);
          if (p.phase === "queued") setProgressText("Đang xếp hàng…");
          else if (p.phase === "running")
            setProgressText(p.message || ENHANCE_UI.progress);
          else if (p.phase === "done") setProgressText("Hoàn tất");
        },
      });

      const url = URL.createObjectURL(result.file);
      enhancedUrlRef.current = url;
      setEnhancedUrl(url);
      setEnhancedFile(result.file);
      setJobId(result.jobId);
      setProgressText("");
    } catch (e) {
      if (e?.code === "ABORTED" || e?.name === "CanceledError" || e?.name === "AbortError") {
        setError("");
      } else if (
        e?.code === "PROVIDER_NOT_CONFIGURED" ||
        e?.response?.data?.code === "PROVIDER_NOT_CONFIGURED" ||
        e?.details?.code === "PROVIDER_NOT_CONFIGURED"
      ) {
        setProviderMissing(true);
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Máy chủ chưa bật làm nét.",
        );
      } else {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Làm nét thất bại — ảnh gốc được giữ nguyên.",
        );
        SonnerError(ENHANCE_UI.failTitle, ENHANCE_UI.failBody);
      }
    } finally {
      setBusy(false);
      jobLockRef.current = false;
      abortRef.current = null;
    }
  }, [busy, mode, online, originalFile, selectedFile]);

  const onUseAi = () => {
    if (!enhancedFile) return;
    setActiveMediaFile(enhancedFile, {
      enabled: true,
      mode,
      model: "free-sharp",
      createdAt: Date.now(),
    });
    SonnerSuccess(ENHANCE_UI.success);
    setOpen(false);
    revokeEnhancedUrl();
  };

  const onKeepOriginal = () => {
    revertEnhancement?.();
    revokeEnhancedUrl();
    setOpen(false);
    SonnerInfo(ENHANCE_UI.keepOriginal);
  };

  const onRetry = () => {
    revokeEnhancedUrl();
    setError("");
    setProviderMissing(false);
    void runEnhance();
  };

  if (!isImage || !selectedFile) return null;

  return (
    <>
      <div className="w-full flex justify-center px-3 mb-1" data-ai-enhance-slot="true">
        <button
          type="button"
          className="btn btn-xs rounded-full bg-base-200 gap-1 disabled:opacity-50"
          disabled={!online && !open}
          title={
            !online
              ? "Cần kết nối mạng"
              : enhancement?.enabled
                ? "Đã làm nét — bấm để xem lại / hoàn tác"
                : "Làm nét ảnh (miễn phí)"
          }
          onClick={() => {
            if (!online) {
              SonnerInfo("Cần kết nối mạng", "Bản nháp ảnh gốc vẫn lưu được.");
              return;
            }
            openModal();
          }}
        >
          {ENHANCE_UI.button}
          {!online ? (
            <span className="text-[9px] opacity-70">· Cần mạng</span>
          ) : enhancement?.enabled ? (
            <span className="text-[9px] opacity-70">{ENHANCE_UI.buttonActive}</span>
          ) : (
            <span className="text-[9px] opacity-70">· Free</span>
          )}
        </button>
        {enhancement?.enabled && online && (
          <button
            type="button"
            className="btn btn-xs btn-ghost rounded-full ml-1"
            onClick={() => {
              revertEnhancement?.();
              SonnerInfo(ENHANCE_UI.revert);
            }}
          >
            Hoàn tác
          </button>
        )}
      </div>

      {open && (
        <Suspense fallback={null}>
          <ImageEnhancementModal
            open={open}
            busy={busy}
            progressText={progressText}
            error={error}
            mode={mode}
            onModeChange={setMode}
            originalUrl={originalUrl}
            enhancedUrl={enhancedUrl}
            offline={!online}
            providerMissing={providerMissing}
            onStart={runEnhance}
            onCancel={cancelJob}
            onUseAi={onUseAi}
            onKeepOriginal={onKeepOriginal}
            onRetry={onRetry}
            onClose={closeModal}
          />
        </Suspense>
      )}
    </>
  );
}
