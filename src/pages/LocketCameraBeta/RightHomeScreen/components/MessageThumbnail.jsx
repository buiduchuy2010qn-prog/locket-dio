import { useEffect, useState } from "react";
import clsx from "clsx";

const MessageThumbnail = ({ src }) => {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!src) return;

    setStatus("loading");

    const img = new Image();

    img.onload = () => setStatus("loaded");
    img.onerror = () => setStatus("error");

    img.src = src;
  }, [src]);

  return (
    <>
      {status === "loading" && (
        <div className="w-64 h-64 rounded-4xl skeleton shrink-0" />
      )}

      {status === "error" && (
        <div className="w-64 h-64 rounded-4xl bg-base-200 shadow-sm flex items-center justify-center text-center text-sm text-base-content/60 px-4 shrink-0">
          Locket này đã bị xoá
        </div>
      )}

      <img
        src={src}
        alt=""
        className={clsx("w-64 h-64 rounded-4xl object-cover shadow-sm", {
          hidden: status !== "loaded",
        })}
      />
    </>
  );
};

export default MessageThumbnail;
