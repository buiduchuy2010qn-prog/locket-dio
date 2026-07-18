import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePostStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";
import {
  DEFAULT_ENHANCE_MODE,
  DEFAULT_ENHANCE_PROVIDER,
  ENHANCE_PROVIDER,
  ENHANCE_UI,
} from "./constants";
import { assertEnhanceableFile } from "./validateClient";

const ImageEnhancementModal = lazy(() => import("./ImageEnhancementModal"));

/**
 * Post-capture only. Does not import camera hooks or music modules.
 * Default: on-device ESRGAN Slim 2x. Cloud (Replicate) optional.
 * Upscaler/TF.js loaded only after user starts enhance (dynamic import).
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
  const [provider, setProvider] = useState(DEFAULT_ENHANCE_PROVIDER);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [enhancedFile, setEnhancedFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);

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
    setResultMeta(null);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeEnhancedUrl();
      // Dispose on-device model when leaving capture UI entirely
      import("./localEnhance")
        .then((m) => m.disposeLocalEnhancer?.())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New capture session → clear compare state + abort background AI
  useEffect(() => {
    if (!selectedFile) {
      abortRef.current?.abort();
      setOpen(false);
      setError("");
      setErrorCode("");
      revokeEnhancedUrl();
      jobLockRef.current = false;
      setBusy(false);
      setProgressPercent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const openModal = async () => {
    ensureOriginalFile?.();
    setError("");
    setErrorCode("");
    revokeEnhancedUrl();
    setProvider(DEFAULT_ENHANCE_PROVIDER);
    setOpen(true);

    // Probe cloud availability only when opening modal (auth required)
    if (online) {
      try {
        const { fetchEnhancementStatus } = await import("./ImageEnhancementService");
        const st = await fetchEnhancementStatus();
        setCloudAvailable(Boolean(st.cloudAvailable));
      } catch {
        setCloudAvailable(false);
      }
    } else {
      setCloudAvailable(false);
    }
  };

  const closeModal = () => {
    if (busy) return;
    setOpen(false);
    setError("");
    setErrorCode("");
  };

  const cancelJob = async () => {
    abortRef.current?.abort();
    try {
      const local = await import("./localEnhance");
      local.abortLocalEnhancer?.();
    } catch {
      /* ignore */
    }
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
    setProgressPercent(null);
    setJobId(null);
    SonnerInfo(ENHANCE_UI.cancel);
  };

  const runEnhance = useCallback(
    async (overrideProvider) => {
      if (jobLockRef.current || busy) return;
      const file = originalFile || selectedFile;
      const check = assertEnhanceableFile(file);
      if (!check.ok) {
        setError(check.message);
        setErrorCode("CLIENT_VALIDATION");
        return;
      }

      const useProvider = overrideProvider || provider;

      if (useProvider === ENHANCE_PROVIDER.CLOUD && !online) {
        setError(ENHANCE_UI.needNetwork);
        setErrorCode("OFFLINE");
        return;
      }

      jobLockRef.current = true;
      setBusy(true);
      setError("");
      setErrorCode("");
      revokeEnhancedUrl();
      setProgressText(
        useProvider === ENHANCE_PROVIDER.LOCAL
          ? ENHANCE_UI.loadingModel
          : ENHANCE_UI.progress,
      );
      setProgressPercent(0);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        let result;
        if (useProvider === ENHANCE_PROVIDER.LOCAL) {
          // Dynamic import — TF/Upscaler not in boot path
          const { enhanceImageLocal } = await import("./localEnhance");
          result = await enhanceImageLocal(file, {
            signal: ac.signal,
            onProgress: (p) => {
              if (typeof p.percent === "number") setProgressPercent(p.percent);
              if (p.message) setProgressText(p.message);
              else if (p.phase === "loading_model")
                setProgressText(ENHANCE_UI.loadingModel);
              else if (p.phase === "done") setProgressText("Hoàn tất");
            },
          });
        } else {
          const { enhanceImageCloud, normalizeEnhanceError } = await import(
            "./ImageEnhancementService"
          );
          try {
            result = await enhanceImageCloud(file, mode, {
              signal: ac.signal,
              onProgress: (p) => {
                if (p.jobId) setJobId(p.jobId);
                if (p.phase === "queued") {
                  setProgressText("Đang xếp hàng…");
                  setProgressPercent(10);
                } else if (p.phase === "running") {
                  setProgressText(p.message || ENHANCE_UI.progress);
                  setProgressPercent((prev) =>
                    typeof prev === "number" ? Math.min(90, prev + 5) : 40,
                  );
                } else if (p.phase === "done") {
                  setProgressText("Hoàn tất");
                  setProgressPercent(100);
                }
              },
            });
          } catch (cloudErr) {
            throw normalizeEnhanceError(cloudErr);
          }
        }

        const url = URL.createObjectURL(result.file);
        enhancedUrlRef.current = url;
        setEnhancedUrl(url);
        setEnhancedFile(result.file);
        setResultMeta({
          provider: result.provider || useProvider,
          model: result.model,
        });
        if (result.jobId) setJobId(result.jobId);
        setProgressText("");
        setProgressPercent(null);
      } catch (e) {
        if (
          e?.code === "ABORTED" ||
          e?.name === "CanceledError" ||
          e?.name === "AbortError"
        ) {
          setError("");
          setErrorCode("");
        } else if (e?.code === "INSUFFICIENT_CREDIT") {
          setErrorCode("INSUFFICIENT_CREDIT");
          setError(ENHANCE_UI.creditMessage);
          // Hide Cloud for this session — free on-device still available
          setCloudAvailable(false);
          setProvider(ENHANCE_PROVIDER.LOCAL);
          // Do NOT auto-run local — user taps "Dùng bản miễn phí"
        } else if (e?.code === "PROVIDER_NOT_CONFIGURED") {
          setCloudAvailable(false);
          setProvider(ENHANCE_PROVIDER.LOCAL);
          setErrorCode("PROVIDER_NOT_CONFIGURED");
          setError(
            e?.message ||
              "Cloud chưa sẵn sàng. Dùng chế độ miễn phí trên thiết bị.",
          );
        } else if (e?.code === "OOM") {
          setErrorCode("OOM");
          setError(ENHANCE_UI.oom);
        } else if (e?.code === "MODEL_NEEDS_NETWORK") {
          setErrorCode("MODEL_NEEDS_NETWORK");
          setError(ENHANCE_UI.needNetworkOnce);
        } else {
          setErrorCode(e?.code || "FAILED");
          setError(
            e?.userMessage ||
              e?.message ||
              "AI làm nét thất bại — ảnh gốc được giữ nguyên.",
          );
          if (e?.code !== "INSUFFICIENT_CREDIT") {
            SonnerError(ENHANCE_UI.failTitle, ENHANCE_UI.failBody);
          }
        }
      } finally {
        setBusy(false);
        jobLockRef.current = false;
        abortRef.current = null;
        setProgressPercent(null);
      }
    },
    [busy, mode, online, originalFile, provider, selectedFile],
  );

  const onUseResult = () => {
    if (!enhancedFile) return;
    setActiveMediaFile(enhancedFile, {
      enabled: true,
      mode,
      model: resultMeta?.model || "local-esrgan-slim-2x",
      provider: resultMeta?.provider || provider,
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
    setErrorCode("");
    void runEnhance();
  };

  /** After cloud credit error — switch to local only when user confirms */
  const onUseFreeFallback = () => {
    setProvider(ENHANCE_PROVIDER.LOCAL);
    setError("");
    setErrorCode("");
    revokeEnhancedUrl();
    void runEnhance(ENHANCE_PROVIDER.LOCAL);
  };

  if (!isImage || !selectedFile) return null;

  return (
    <>
      <div className="w-full flex justify-center px-3 mb-1" data-ai-enhance-slot="true">
        <button
          type="button"
          className="btn btn-xs rounded-full bg-base-200 gap-1 disabled:opacity-50"
          title={
            enhancement?.enabled
              ? "Đã dùng AI — bấm để xem lại / hoàn tác"
              : "AI Làm nét (miễn phí trên thiết bị)"
          }
          onClick={() => {
            openModal();
          }}
        >
          {ENHANCE_UI.button}
          {enhancement?.enabled ? (
            <span className="text-[9px] opacity-70">{ENHANCE_UI.buttonActive}</span>
          ) : (
            <span className="text-[9px] opacity-70">· Free</span>
          )}
        </button>
        {enhancement?.enabled && (
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
            progressPercent={progressPercent}
            error={error}
            errorCode={errorCode}
            mode={mode}
            onModeChange={setMode}
            provider={provider}
            onProviderChange={setProvider}
            cloudAvailable={cloudAvailable}
            originalUrl={originalUrl}
            enhancedUrl={enhancedUrl}
            offline={!online}
            onStart={() => runEnhance()}
            onCancel={cancelJob}
            onUseResult={onUseResult}
            onKeepOriginal={onKeepOriginal}
            onRetry={onRetry}
            onUseFreeFallback={onUseFreeFallback}
            onClose={closeModal}
          />
        </Suspense>
      )}
    </>
  );
}
