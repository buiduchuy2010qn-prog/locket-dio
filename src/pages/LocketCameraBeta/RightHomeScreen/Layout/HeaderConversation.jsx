import React from "react";
import clsx from "clsx";
import { ChevronLeft, RefreshCw } from "lucide-react";

const getRelayStatus = (relayStatus) => {
  if (relayStatus === "open") return "success";
  if (relayStatus === "connecting") return "warning";
  return "error";
};

const getDioStatus = (isConnected) => {
  if (isConnected === true) return "success";
  if (isConnected === "connecting") return "info";
  return "error";
};

const HeaderConversation = ({
  setIsHomeOpen,
  setSelectedChat,
  isConnected,
  relayStatus,
  sendReconnect,
}) => {
  return (
    <div className="relative flex items-center shadow-lg justify-between px-4 py-2 text-base-content">
      <button
        onClick={() => {
          setIsHomeOpen(false);
          setSelectedChat(null);
        }}
        className="btn p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer z-10"
      >
        <ChevronLeft size={30} />
      </button>

      <div className="flex items-center gap-4">
        {relayStatus === "open" && (
          <button
            onClick={sendReconnect}
            className="btn btn-ghost btn-xs rounded-full gap-1 text-warning"
            title="Reconnect relay service"
          >
            <RefreshCw size={14} />
            Reconnect
          </button>
        )}

        <div className="flex items-center gap-3">
          <ServiceStatus
            label="Dio Service"
            status={getDioStatus(isConnected)}
          />

          <ServiceStatus
            label="Relay"
            labelStatus={relayStatus}
            status={getRelayStatus(relayStatus)}
          />
        </div>
      </div>
    </div>
  );
};

const ServiceStatus = ({ label, labelStatus, status = "info" }) => {
  const style = STATUS_CLASS[status] ?? STATUS_CLASS.info;

  return (
    <div className="flex items-center gap-1.5">
      <div className="inline-grid *:[grid-area:1/1]">
        <div className={clsx("status animate-ping", style.dot)} />
        <div className={clsx("status", style.dot)} />
      </div>

      <span className={clsx("text-xs font-semibold", style.text)}>
        {label}
        {labelStatus && (
          <span className="ml-1">({labelStatus})</span>
        )}
      </span>
    </div>
  );
};

const STATUS_CLASS = {
  success: {
    dot: "status-success",
    text: "text-success",
  },
  error: {
    dot: "status-error",
    text: "text-error",
  },
  warning: {
    dot: "status-warning",
    text: "text-warning",
  },
  info: {
    dot: "status-info",
    text: "text-info",
  },
};
export default HeaderConversation;
