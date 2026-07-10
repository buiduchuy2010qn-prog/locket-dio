import { useEffect, useState } from "react";
import { SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";
import { Bell, Camera, MapPin } from "lucide-react";
import { subscribePush } from "@/services";
import { useTranslation } from "react-i18next";

export default function PermissionsManager() {
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [pushData, setPushData] = useState(null);
  const { t } = useTranslation("auth");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      setSubscribed(!!sub);
    } catch (err) {
      console.error(err);
    }
  };

  const subscribeUser = async () => {
    try {
      if (!("Notification" in window)) return;
      if (!("serviceWorker" in navigator)) return;

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") return;

      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        await subscribePush();

        setSubscribed(true);

        SonnerSuccess(
          t("settings.permissions.notification.activated_title"),
          t("settings.permissions.notification.activated_desc"),
        );
        return;
      }

      await subscribePush();

      setSubscribed(true);

      SonnerSuccess(
        t("settings.permissions.notification.subscribed_title"),
        t("settings.permissions.notification.subscribed_desc"),
      );
    } catch (error) {
      console.error("Subscribe user error:", error);
    }
  };

  const requestCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        SonnerInfo(t("settings.permissions.camera.not_supported"));
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      setCameraEnabled(true);

      stream.getTracks().forEach((track) => track.stop());

      SonnerSuccess(
        t("settings.permissions.camera.granted_toast_title"),
        t("settings.permissions.camera.granted_toast_desc"),
      );
    } catch {
      SonnerInfo(t("settings.permissions.camera.denied_info"));
    }
  };

  const requestLocation = async () => {
    try {
      if (!navigator.geolocation) {
        SonnerInfo(t("settings.permissions.location.not_supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationEnabled(true);

          console.log("Location:", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });

          SonnerSuccess(
            t("settings.permissions.location.granted_toast_title"),
            t("settings.permissions.location.granted_toast_desc"),
          );
        },
        () => {
          SonnerInfo(t("settings.permissions.location.denied_info"));
        },
      );
    } catch {
      SonnerInfo(t("settings.permissions.location.cannot_get"));
    }
  };

  const handleNotificationToggle = () => {
    if (permission === "denied") {
      SonnerInfo(t("settings.permissions.notification.blocked_info"));
      return;
    }

    if (!subscribed) {
      subscribeUser();
    }
  };

  const handleCameraToggle = () => {
    if (!cameraEnabled) {
      requestCamera();
    }
  };
  const handleLocationToggle = () => {
    if (!locationEnabled) requestLocation();
  };

  const renderNotificationGuide = () => {
    if (permission === "granted" && subscribed) {
      return (
        <div className="text-xs opacity-70 text-left flex flex-col gap-1">
          <p>{t("settings.permissions.notification.granted_desc")}</p>
          <p>{t("settings.permissions.notification.granted_subscribed")}</p>
        </div>
      );
    }

    if (permission === "default") {
      return (
        <p className="text-xs opacity-70 text-left">
          {t("settings.permissions.notification.default_desc")}
        </p>
      );
    }

    if (permission === "denied") {
      return (
        <div className="text-xs text-warning text-left flex flex-col gap-1">
          <p>{t("settings.permissions.notification.denied_warn")}</p>
          <p>{t("settings.permissions.notification.denied_guide")}</p>
        </div>
      );
    }

    if (permission === "granted" && !subscribed) {
      return (
        <p className="text-xs text-left opacity-70">
          {t("settings.permissions.notification.granted_not_subscribed")}
        </p>
      );
    }

    return null;
  };

  const renderCameraGuide = () => {
    if (cameraEnabled) {
      return (
        <div className="text-xs opacity-70 text-left flex flex-col gap-1">
          <p>{t("settings.permissions.camera.granted_desc")}</p>
          <p>{t("settings.permissions.camera.granted_info")}</p>
        </div>
      );
    }

    return (
      <p className="text-xs opacity-70 text-left">
        {t("settings.permissions.camera.default_desc")}
      </p>
    );
  };

  const renderLocationGuide = () => {
    if (locationEnabled) {
      return (
        <div className="text-xs opacity-70 text-left flex flex-col gap-1">
          <p>{t("settings.permissions.location.granted_desc")}</p>
          <p>{t("settings.permissions.location.granted_info")}</p>
        </div>
      );
    }

    return (
      <p className="text-xs opacity-70 text-left">
        {t("settings.permissions.location.default_desc")}
      </p>
    );
  };

  return (
    <div className="flex-1 bg-base-100 rounded-lg p-4 shadow-sm flex flex-col gap-4">
      <h3 className="font-semibold text-lg text-center">
        {t("settings.permissions.title")}
      </h3>

      {/* Notification */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Bell className="w-5 h-5" />
          <span>{t("settings.permissions.notification.label")}</span>
        </div>

        <input
          type="checkbox"
          className="toggle toggle-info"
          checked={permission === "granted" && subscribed}
          onChange={handleNotificationToggle}
        />
        {pushData && (
          <div className="bg-base-200 p-2 rounded text-xs overflow-auto">
            <pre>{JSON.stringify(pushData, null, 2)}</pre>
          </div>
        )}
      </div>

      {renderNotificationGuide()}

      {/* Camera */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Camera className="w-5 h-5" />
          <span>{t("settings.permissions.camera.label")}</span>
        </div>

        <input
          type="checkbox"
          className="toggle toggle-info"
          checked={cameraEnabled}
          onChange={handleCameraToggle}
        />
      </div>

      {renderCameraGuide()}
      {/* Location */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-5 h-5" />
          <span>{t("settings.permissions.location.label")}</span>
        </div>

        <input
          type="checkbox"
          className="toggle toggle-info"
          checked={locationEnabled}
          onChange={handleLocationToggle}
        />
      </div>

      {renderLocationGuide()}
    </div>
  );
}
