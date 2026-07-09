import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import MediaSizeInfo from "@/components/ui/MediaSizeInfo";
import { showInfo } from "@/components/Toast";
import { getAvailableCameras } from "@/utils";
const AutoResizeCaption = lazy(() => import("../CaptionViews"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import {
  openCameraStream,
  stopMediaStream,
} from "@/utils/device/cameraStream";
import {
  applyTrackZoom,
  buildZoomSteps,
  getTrackZoomCapability,
  nextZoomStep,
} from "@/utils/device/cameraZoom";

const MediaPreview = ({ capturedMedia }) => {
  const { post, camera } = useApp();
  const { selectedFile, preview } = post;
  const {
    streamRef,
    videoRef,
    cameraActive,
    setCameraActive,
    cameraMode,
    zoomLevel,
    setZoomLevel,
    zoomFactor,
    setZoomFactor,
    zoomSteps,
    setZoomSteps,
    deviceId,
    setDeviceId,
    selectedFrame,
  } = camera;

  const startingRef = useRef(false);
  const startGenRef = useRef(0);
  const mountedRef = useRef(true);
  const camerasCacheRef = useRef(null);
  const prevModeRef = useRef(cameraMode);
  const [digitalScale, setDigitalScale] = useState(1);

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    startingRef.current = false;
  }, [streamRef, videoRef]);

  const refreshZoomSteps = useCallback(
    async (stream) => {
      try {
        if (!camerasCacheRef.current) {
          camerasCacheRef.current = await getAvailableCameras();
        }
        const cap = getTrackZoomCapability(stream);
        const steps = buildZoomSteps({
          facingMode: cameraMode || "user",
          cameras: camerasCacheRef.current,
          trackCap: cap,
        });
        setZoomSteps(steps);
      } catch (e) {
        console.warn("zoom steps", e);
      }
    },
    [cameraMode, setZoomSteps]
  );

  const startCamera = useCallback(async () => {
    if (!cameraActive || preview || selectedFile) return;

    const gen = ++startGenRef.current;
    startingRef.current = true;

    try {
      // Fully release old stream before opening new facing (required on many phones)
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;

      // Small yield so OS releases camera lock
      await new Promise((r) => setTimeout(r, 80));
      if (gen !== startGenRef.current || !mountedRef.current) return;

      const stream = await openCameraStream({
        facingMode: cameraMode || "user",
        deviceId: deviceId || null,
      });

      if (gen !== startGenRef.current || !mountedRef.current) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;

      if (zoomFactor > 1.01) {
        const ok = await applyTrackZoom(stream, zoomFactor);
        setDigitalScale(ok ? 1 : zoomFactor);
      } else {
        setDigitalScale(1);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const p = videoRef.current.play?.();
        if (p?.catch) p.catch(() => {});
      }

      await refreshZoomSteps(stream);
    } catch (err) {
      console.error("startCamera failed:", err?.name, err?.message || err);
      if (gen !== startGenRef.current) return;

      // Flip to back failed → keep front instead of turning camera off
      if (cameraMode === "environment") {
        showInfo(
          "Không mở được camera sau. Dùng Chrome, cấp quyền Camera, thử lại."
        );
        setDeviceId(null);
        setCameraMode("user");
        return;
      }
      showInfo("Không mở được camera. Kiểm tra quyền trình duyệt.");
    } finally {
      if (gen === startGenRef.current) {
        startingRef.current = false;
      }
    }
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    preview,
    selectedFile,
    setCameraMode,
    setDeviceId,
    streamRef,
    videoRef,
    zoomFactor,
    refreshZoomSteps,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startGenRef.current += 1;
    };
  }, []);

  // When facing flips: clear lens device + zoom (don't fight startCamera)
  useEffect(() => {
    if (prevModeRef.current === cameraMode) return;
    prevModeRef.current = cameraMode;
    camerasCacheRef.current = null;
    setZoomLevel("1x");
    setZoomFactor(1);
    setDigitalScale(1);
    // Clear deviceId so openCameraStream picks correct facing
    setDeviceId(null);
  }, [cameraMode, setDeviceId, setZoomFactor, setZoomLevel]);

  useEffect(() => {
    if (!cameraActive || preview || selectedFile) {
      stopCamera();
      return;
    }
    startCamera();
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    preview,
    selectedFile,
    startCamera,
    stopCamera,
  ]);

  // Optical zoom only (same device) — apply without full restart when possible
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !cameraActive || preview || selectedFile) return;
    if (deviceId) return; // lens switch handled by startCamera via deviceId

    let cancelled = false;
    (async () => {
      if (zoomFactor <= 1.01) {
        await applyTrackZoom(stream, 1);
        if (!cancelled) setDigitalScale(1);
        return;
      }
      const ok = await applyTrackZoom(stream, zoomFactor);
      if (!cancelled) setDigitalScale(ok ? 1 : zoomFactor);
    })();
    return () => {
      cancelled = true;
    };
  }, [zoomFactor, deviceId, cameraActive, preview, selectedFile, streamRef]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  /** Apply a zoom step (lens switch and/or optical/digital). 0.5x = real ultra-wide when available. */
  const applyZoomStep = useCallback(
    async (step) => {
      if (!step) return;
      setZoomLevel(step.label);
      setZoomFactor(step.factor);
      setDigitalScale(1);

      // ----- 0.5x / multi-lens -----
      if (step.mode === "lens") {
        let targetId = step.deviceId;

        // Ultra-wide: try candidates until one opens
        if (step.factor < 0.9) {
          try {
            if (!camerasCacheRef.current) {
              camerasCacheRef.current = await getAvailableCameras();
            }
            const cams = camerasCacheRef.current;
            const candidates = [
              step.deviceId,
              ...(step.ultraCandidates || []),
              ...(cams.ultraWideDeviceIds || []),
              cams.backUltraWideCamera?.deviceId,
            ].filter(Boolean);
            const uniq = [...new Set(candidates)];

            let opened = null;
            for (const id of uniq) {
              try {
                const test = await openCameraStream({
                  facingMode: cameraMode || "environment",
                  deviceId: id,
                });
                stopMediaStream(test);
                opened = id;
                break;
              } catch (_) {
                /* try next UW camera */
              }
            }

            if (opened) {
              targetId = opened;
            } else {
              // Native zoom.min < 1 on main camera?
              if (streamRef.current) {
                const ok = await applyTrackZoom(streamRef.current, 0.5);
                if (ok) {
                  setZoomLevel("0.5x");
                  setZoomFactor(0.5);
                  return;
                }
              }
              showInfo(
                "Máy này không có camera 0.5x (góc siêu rộng) trên trình duyệt"
              );
              // stay / revert UI to 1x
              setZoomLevel("1x");
              setZoomFactor(1);
              return;
            }
          } catch (e) {
            console.error("0.5x open failed", e);
            showInfo("Không bật được 0.5x trên máy này");
            setZoomLevel("1x");
            setZoomFactor(1);
            return;
          }
        }

        // 1x / tele lens switch
        if (targetId && targetId !== deviceId) {
          setDeviceId(targetId);
          return;
        }
        if (targetId && targetId === deviceId) {
          if (streamRef.current) await applyTrackZoom(streamRef.current, 1);
          return;
        }
        // lens step without deviceId → facingMode only
        setDeviceId(null);
        return;
      }

      // ----- Optical / digital on current stream -----
      if (step.mode === "optical" || step.mode === "digital") {
        // Leaving ultra-wide → main lens for zoom-in
        if (deviceId && step.factor >= 1) {
          try {
            if (!camerasCacheRef.current) {
              camerasCacheRef.current = await getAvailableCameras();
            }
            const main =
              camerasCacheRef.current.backNormalCamera?.deviceId ||
              camerasCacheRef.current.backCameras?.[0]?.deviceId ||
              camerasCacheRef.current.frontCameras?.[0]?.deviceId;
            if (main && main !== deviceId) {
              setDeviceId(main);
              // zoom applied after stream restart via zoomFactor state
              return;
            }
          } catch (_) {
            /* ignore */
          }
        }

        if (streamRef.current) {
          if (step.factor < 1) {
            const ok = await applyTrackZoom(streamRef.current, step.factor);
            if (!ok) {
              showInfo("Máy không hỗ trợ zoom 0.5x");
              setZoomLevel("1x");
              setZoomFactor(1);
            }
            setDigitalScale(1);
            return;
          }
          if (step.mode === "optical" || step.factor > 1) {
            const ok = await applyTrackZoom(streamRef.current, step.factor);
            // Digital only for zoom-in (not fake wide)
            setDigitalScale(ok ? 1 : Math.max(1, step.factor));
          } else {
            await applyTrackZoom(streamRef.current, 1);
            setDigitalScale(1);
          }
        }
      }
    },
    [
      cameraMode,
      deviceId,
      setDeviceId,
      setZoomFactor,
      setZoomLevel,
      streamRef,
    ]
  );

  const handleCycleZoomCamera = async () => {
    try {
      if (!camerasCacheRef.current) {
        camerasCacheRef.current = await getAvailableCameras();
      }
      let steps = zoomSteps;
      if (!steps?.length && streamRef.current) {
        const cap = getTrackZoomCapability(streamRef.current);
        steps = buildZoomSteps({
          facingMode: cameraMode || "user",
          cameras: camerasCacheRef.current,
          trackCap: cap,
        });
        setZoomSteps(steps);
      }
      if (!steps?.length) {
        steps = buildZoomSteps({
          facingMode: cameraMode || "user",
          cameras: camerasCacheRef.current,
          trackCap: null,
        });
        setZoomSteps(steps);
      }

      const next = nextZoomStep(steps, zoomLevel, zoomFactor);
      if (!next) {
        showInfo("Không có mức zoom khác");
        return;
      }
      await applyZoomStep(next);
    } catch (e) {
      console.error(e);
      showInfo("Không đổi được zoom camera");
    }
  };

  const showLive =
    !preview && !selectedFile && !capturedMedia && cameraActive;

  const displaySteps =
    zoomSteps?.length > 0
      ? zoomSteps
      : [
          { label: "0.5x", factor: 0.5 },
          { label: "1x", factor: 1 },
          { label: "2x", factor: 2 },
        ];

  return (
    <>
      <div className="relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden">
        {showLive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover origin-center will-change-transform ${
              cameraMode === "user" ? "scale-x-[-1]" : ""
            }`}
            style={
              digitalScale > 1.01
                ? {
                    transform: `${
                      cameraMode === "user" ? "scaleX(-1) " : ""
                    }scale(${digitalScale})`,
                  }
                : undefined
            }
          />
        )}

        {!preview && !selectedFile && (
          <>
            <div className="absolute inset-0 top-7 px-5 z-30 pointer-events-none flex justify-between items-start text-base-content text-xs font-semibold">
              <button
                type="button"
                onClick={() => showInfo("Chức năng này sẽ sớm có mặt!")}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>

              {/* Cycle zoom — phone style */}
              <button
                type="button"
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto min-w-8 h-8 px-2 text-primary-content font-bold rounded-full bg-white/35 backdrop-blur-md flex items-center justify-center shadow"
                title="Đổi zoom (0.5x / 1x / 2x / …)"
              >
                {zoomLevel}
              </button>
            </div>

            {/* Zoom chips like native camera */}
            {showLive && displaySteps.length > 1 && (
              <div className="absolute bottom-20 left-0 right-0 z-30 pointer-events-none flex justify-center px-3">
                <div className="pointer-events-auto flex flex-row gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2 py-1.5 max-w-full overflow-x-auto">
                  {displaySteps.map((step) => {
                    const active =
                      step.label === zoomLevel ||
                      Math.abs(step.factor - zoomFactor) < 0.05;
                    return (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() => applyZoomStep(step)}
                        className={`min-w-9 h-8 px-2 rounded-full text-xs font-bold transition ${
                          active
                            ? "bg-yellow-400 text-black scale-110"
                            : "bg-white/20 text-white"
                        }`}
                      >
                        {step.label.replace("x", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedFrame?.imageSrc && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <img
                  src={selectedFrame.imageSrc}
                  alt="Khung viền camera"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
          </>
        )}

        {preview?.type === "video" && (
          <video
            src={preview.data}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {preview?.type === "image" && (
          <img
            src={preview.data}
            alt="Preview"
            className="w-full h-full object-cover select-none"
            decoding="async"
          />
        )}

        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-opacity duration-200 ${
            preview && selectedFile
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <Suspense fallback={null}>
            <AutoResizeCaption />
          </Suspense>
        </div>

        <div className="absolute inset-0 z-50 pointer-events-none">
          <BorderProgress />
        </div>
      </div>

      <div className="text-sm flex items-center justify-center pl-3">
        <MediaSizeInfo />
      </div>
    </>
  );
};

export default MediaPreview;
