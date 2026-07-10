import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import BouncyLoader from "@/components/ui/Loading/Bouncy";
import { RiEmotionHappyLine } from "react-icons/ri";
import { TbMoodCrazyHappy } from "react-icons/tb";
import { instanceAuth } from "@/libs/instanceAuth";

const StatusServer = ({ isStatusServer, setIsStatusServer }) => {
  const { t } = useTranslation("public");

  useEffect(() => {
    let intervalId;

    const checkServer = async () => {
      try {
        const response = await instanceAuth.get("/", {
          timeout: 10000,
        });
        setIsStatusServer(response.status === 200);
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
