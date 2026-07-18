import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePostStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";
import {
  DEFAULT_ENHANCE_MODE,
  DEFAULT_ENHANCE_PROVIDER,
  DEFAULT_LOCAL_QUALITY,
  ENHANCE_DEADLINE_MS,
  ENHANCE_PROVIDER,
  ENHANCE_UI,
} from "./constants";
import { assertEnhanceableFile } from "./validateClient";

const ImageEnhancementModal = lazy(() => import("./ImageEnhancementModal"));

/**
 * Post-capture only. Does not import camera hooks or music modules.
 * Local: Dedicated Worker + 60s hard terminate. Cloud: 60s poll + cancel.
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
  const [localQuality, setLocalQuality] = useState(DEFAULT_LOCAL_QUALITY);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(null);
  const [remainingSec, setRemainingSec] = useState(null);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [enhancedFile, setEnhancedFile] = useState(null);
  const [cloudJobId, setCloudJobId] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);

  const abortRef = useRef(null);
  const jobLockRef = useRef(false);
  const enhancedUrlRef = useRef(null);
  const activeJobIdRef = useRef(null);
  /** Generation counter — ignore late resolve after timeout/cancel */
  const genRef = useRef(0);

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

  const hardStopLocal = async () => {
    try {
      const local = await import("./localEnhance");
      local.abortLocalEnhancer?.();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    return () => {
      genRef.current += 1;
      abortRef.current?.abort();
      void hardStopLocal();
      revokeEnhancedUrl();
      import("./localEnhance")
        .then((m) => m.disposeLocalEnhancer?.())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      genRef.current += 1;
      abortRef.current?.abort();
      void hardStopLocal();
      setOpen(false);
      setError("");
      setErrorCode("");
      revokeEnhancedUrl();
      jobLockRef.current = false;
      setBusy(false);
      setProgressPercent(null);
      setRemainingSec(null);
      setSlowHint(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const openModal = async () => {
    ensureOriginalFile?.();
    setError("");
    setErrorCode("");
    setSlowHint(false);
    setRemainingSec(null);
    revokeEnhancedUrl();
    setProvider(DEFAULT_ENHANCE_PROVIDER);
    setLocalQuality(DEFAULT_LOCAL_QUALITY);
    setOpen(true);

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
    if (busy) {
      // Closing while busy = cancel (do not leave AI running)
      void cancelJob({ silent: true });
    }
    setOpen(false);
    setError("");
    setErrorCode("");
    setSlowHint(false);
    setRemainingSec(null);
  };

  const cancelJob = async ({ silent } = {}) => {
    genRef.current += 1;
    abortRef.current?.abort();
    await hardStopLocal();
    if (cloudJobId) {
      try {
        const { cancelEnhancementJob } = await import("./ImageEnhancementService");
        await cancelEnhancementJob(cloudJobId);
      } catch {
        /* ignore */
      }
    }
    setBusy(false);
    jobLockRef.current = false;
    setProgressText("");
    setProgressPercent(null);
    setRemainingSec(null);
    setSlowHint(false);
    setCloudJobId(null);
    activeJobIdRef.current = null;
    setError("");
    setErrorCode("");
    if (!silent) SonnerInfo(ENHANCE_UI.cancel);
  };

  const runEnhance = useCallback(
    async (overrides = {}) => {
      if (jobLockRef.current) return;
      const file = originalFile || selectedFile;
      const check = assertEnhanceableFile(file);
      if (!check.ok) {
        setError(check.message);
        setErrorCode("CLIENT_VALIDATION");
        return;
      }

      const useProvider = overrides.provider || provider;
      const useQuality = overrides.quality || localQuality;

      if (useProvider === ENHANCE_PROVIDER.CLOUD && !online) {
        setError(ENHANCE_UI.needNetwork);
        setErrorCode("OFFLINE");
        return;
      }

      // Kill any prior job before starting
      genRef.current += 1;
      const myGen = genRef.current;
      abortRef.current?.abort();
      await hardStopLocal();

      jobLockRef.current = true;
      setBusy(true);
      setError("");
      setErrorCode("");
      setSlowHint(false);
      revokeEnhancedUrl();
      setProgressPercent(0);
      setRemainingSec(Math.ceil(ENHANCE_DEADLINE_MS / 1000));
      setProgressText(
        useProvider === ENHANCE_PROVIDER.LOCAL
          ? ENHANCE_UI.loadingModel
          : ENHANCE_UI.progress,
      );

      const ac = new AbortController();
      abortRef.current = ac;
      const jobId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `j_${Date.now()}`;
      activeJobIdRef.current = jobId;

      try {
        let result;
        if (useProvider === ENHANCE_PROVIDER.LOCAL) {
          const { enhanceImageLocal } = await import("./localEnhance");
          result = await enhanceImageLocal(file, {
            signal: ac.signal,
            quality: useQuality,
            jobId,
            onProgress: (p) => {
              if (myGen !== genRef.current) return;
              if (typeof p.remainingMs === "number") {
                setRemainingSec(Math.ceil(p.remainingMs / 1000));
              }
              if (p.phase === "slow_hint") {
                setSlowHint(true);
                if (p.message) setProgressText(p.message);
                return;
              }
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
                if (myGen !== genRef.current) return;
                if (p.jobId) setCloudJobId(p.jobId);
                if (typeof p.remainingMs === "number") {
                  setRemainingSec(Math.ceil(p.remainingMs / 1000));
                }
                if (p.phase === "queued") {
                  setProgressText("Đang xếp hàng…");
                  setProgressPercent(10);
                } else if (p.phase === "running") {
                  setProgressText(p.message || ENHANCE_UI.progress);
                  setProgressPercent((prev) =>
                    typeof prev === "number" ? Math.min(90, prev + 3) : 40,
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

        // Drop late success if generation changed (timeout/cancel/new job)
        if (myGen !== genRef.current || ac.signal.aborted) {
          return;
        }

        const url = URL.createObjectURL(result.file);
        enhancedUrlRef.current = url;
        setEnhancedUrl(url);
        setEnhancedFile(result.file);
        setResultMeta({
          provider: result.provider || useProvider,
          model: result.model,
          quality: result.quality || useQuality,
        });
        if (result.jobId) setCloudJobId(result.jobId);
        setProgressText("");
        setProgressPercent(null);
        setRemainingSec(null);
        setSlowHint(false);
      } catch (e) {
        if (myGen !== genRef.current) return;

        if (
          e?.code === "ABORTED" ||
          e?.name === "CanceledError" ||
          e?.name === "AbortError"
        ) {
          setError("");
          setErrorCode("");
        } else if (e?.code === "TIMED_OUT" || e?.code === "TIMEOUT") {
          setErrorCode("TIMED_OUT");
          setError(ENHANCE_UI.timedOut);
          setSlowHint(false);
        } else if (e?.code === "INSUFFICIENT_CREDIT") {
          setErrorCode("INSUFFICIENT_CREDIT");
          setError(ENHANCE_UI.creditMessage);
          setCloudAvailable(false);
          setProvider(ENHANCE_PROVIDER.LOCAL);
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
          SonnerError(ENHANCE_UI.failTitle, ENHANCE_UI.failBody);
        }
      } finally {
        if (myGen === genRef.current) {
          setBusy(false);
          jobLockRef.current = false;
          abortRef.current = null;
          setProgressPercent(null);
          setRemainingSec(null);
          activeJobIdRef.current = null;
        }
      }
    },
    [localQuality, mode, online, originalFile, provider, selectedFile],
  );

  const onUseResult = () => {
    if (!enhancedFile) return;
    setActiveMediaFile(enhancedFile, {
      enabled: true,
      mode,
      model: resultMeta?.model || "local-esrgan-slim-2x",
      provider: resultMeta?.provider || provider,
      quality: resultMeta?.quality,
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
    setError("");
    setErrorCode("");
    SonnerInfo(ENHANCE_UI.keepOriginal);
  };

  const onRetry = () => {
    revokeEnhancedUrl();
    setError("");
    setErrorCode("");
    setSlowHint(false);
    void runEnhance();
  };

  const onUseFreeFallback = () => {
    setProvider(ENHANCE_PROVIDER.LOCAL);
    setError("");
    setErrorCode("");
    revokeEnhancedUrl();
    void runEnhance({ provider: ENHANCE_PROVIDER.LOCAL });
  };

  const onTrySuperfast = () => {
    setProvider(ENHANCE_PROVIDER.LOCAL);
    setLocalQuality("superfast");
    setError("");
    setErrorCode("");
    setSlowHint(false);
    revokeEnhancedUrl();
    void runEnhance({ provider: ENHANCE_PROVIDER.LOCAL, quality: "superfast" });
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
              : "AI Làm nét (miễn phí trên thiết bị · tối đa 60s)"
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
            remainingSec={remainingSec}
            slowHint={slowHint}
            error={error}
            errorCode={errorCode}
            mode={mode}
            onModeChange={setMode}
            provider={provider}
            onProviderChange={setProvider}
            localQuality={localQuality}
            onLocalQualityChange={setLocalQuality}
            cloudAvailable={cloudAvailable}
            originalUrl={originalUrl}
            enhancedUrl={enhancedUrl}
            offline={!online}
            onStart={() => runEnhance()}
            onCancel={() => cancelJob()}
            onUseResult={onUseResult}
            onKeepOriginal={onKeepOriginal}
            onRetry={onRetry}
            onUseFreeFallback={onUseFreeFallback}
            onTrySuperfast={onTrySuperfast}
            onClose={closeModal}
          />
        </Suspense>
      )}
    </>
  );
}
