import React, { useEffect } from "react";
import axios from "axios";
import { useApp } from "@/context/AppContext";
import BouncyLoader from "../Loading/Bouncy";
import * as utils from "@/utils";
import { RiEmotionHappyLine } from "react-icons/ri";
import { TbMoodCrazyHappy } from "react-icons/tb";

const StatusServer = () => {
  const { useloading } = useApp();
  const { isStatusServer, setIsStatusServer } = useloading; // null: đang kiểm tra, true/false: kết quả

  useEffect(() => {
    let intervalId;

    const checkServer = async () => {
      try {
        const response = await axios.get(utils.API_URL.CHECK_SERVER, {
          timeout: 8000,
          // Không coi HTML của Static Site là server API OK
          validateStatus: (s) => s >= 200 && s < 500,
        });
        const data = response.data;
        const isJsonOk =
          response.status === 200 &&
          data != null &&
          typeof data === "object" &&
          (typeof data.message === "string" || data.success === true || data.status === "ok");
        // Fallback: body text chứa running
        const isTextOk =
          response.status === 200 &&
          typeof data === "string" &&
          /server is running/i.test(data);
        setIsStatusServer(Boolean(isJsonOk || isTextOk));
      } catch (error) {
        setIsStatusServer(false);
      }
    };

    // check lần đầu
    checkServer();

    // set interval để check lại sau mỗi 10s
    intervalId = setInterval(checkServer, 6000);

    // cleanup khi unmount
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
            Đang kiểm tra server <BouncyLoader size={20} color="orange" />
          </span>
        </>
      ) : isStatusServer ? (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-success animate-ping"></div>
            <div className="status status-success"></div>
          </div>
          <span className="text-green-600 font-medium flex items-center">
            Server đang chạy <RiEmotionHappyLine className="ml-1" />
          </span>
        </>
      ) : (
        <>
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-error animate-pulse"></div>
          </div>
          <span className="text-red-600 font-medium flex items-center">
            Server lỗi <TbMoodCrazyHappy className="ml-1" />
          </span>
        </>
      )}
    </div>
  );
};

export default StatusServer;
