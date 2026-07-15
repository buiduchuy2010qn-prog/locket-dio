import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import BouncyLoader from "@/components/uikit/Loading/Bouncy";
import { RiEmotionHappyLine } from "react-icons/ri";
import { TbMoodCrazyHappy } from "react-icons/tb";
import { instanceAuth } from "@/libs/instanceAuth";

const StatusServer = ({ isStatusServer, setIsStatusServer }) => {
  const { t } = useTranslation("public");

  useEffect(() => {
    let intervalId;

    const checkServer = async () => {
      try {
        // Prefer Railway API health (stable on Vercel rewrites).
        // Fallback: auth root without trailing-slash issues.
        let ok = false;
        try {
          const health = await fetch("/dio-api/health", {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          ok = health.ok;
        } catch {
          /* try auth below */
        }
        if (!ok) {
          const response = await instanceAuth.get("", { timeout: 10000 });
          ok = response.status === 200;
        }
        setIsStatusServer(ok);
      } catch {
        setIsStatusServer(false);
      }
    };

    checkServer();
    intervalId = setInterval(checkServer, 10000);

    return () => clearInterval(intervalId);
  }, [setIsStatusServer]);

  return (
    <div className="flex items-center gap-2 text-sm">
      {isStatusServer === null ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-warning animate-bounce"></div>
          </div>
          <span className="text-orange-600 font-medium flex items-center">
            {t("server.checking")} <BouncyLoader size={20} color="orange" />
          </span>
        </>
      ) : isStatusServer ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-success animate-ping"></div>
            <div className="status status-success"></div>
          </div>
          <span className="text-green-600 font-medium flex items-center">
            {t("server.online")} <RiEmotionHappyLine className="ml-1" />
          </span>
        </>
      ) : (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-error animate-pulse"></div>
          </div>
          <span className="text-red-600 font-medium flex items-center">
            {t("server.offline")} <TbMoodCrazyHappy className="ml-1" />
          </span>
        </>
      )}
    </div>
  );
};

export default StatusServer;
