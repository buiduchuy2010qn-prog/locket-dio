import { isIOS } from "@/utils";
import MediaPreviewAndroid from "./Android";
import MediaPreviewIOS from "./IOS";

/**
 * Thin shell: Safari/iOS needs a separate preview module for gesture/video quirks.
 * Shared multi-platform lens/zoom logic lives in utils/device/cameraLens.js
 * (feature detection: enumerateDevices, deviceId exact, getCapabilities().zoom).
 * Android.jsx also serves desktop Chrome/Edge/Firefox.
 */
const MediaPreview = isIOS() ? MediaPreviewIOS : MediaPreviewAndroid;

export default MediaPreview;
