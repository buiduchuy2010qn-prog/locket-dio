import React from "react";
import { Link } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

function InfoUser({ user }) {
  return (
    <div className="flex flex-row justify-between items-center px-4 pb-2">
      <div className="flex flex-col items-start">
        <p className="text-xl font-semibold whitespace-nowrap truncate max-w-[250px]">
          {user?.displayName || "Name"}
        </p>
        <a
          href={`https://locket.cam/${user?.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link underline font-semibold flex items-center truncate max-w-[250px]"
        >
          @{user?.username} <Link className="ml-2" size={18} />
        </a>
      </div>
      <div className="flex justify-center items-center avatar w-16 h-16 select-none flex-shrink-0">
        <div className="rounded-full shadow-md border-3 border-amber-400 p-0.5">
          <Avatar
            src={user?.profilePicture}
            alt="Profile"
            className="w-13 h-13 rounded-full"
          />
          <img
            src="https://cdn.locket-dio.com/v1/caption/caption-icon/locket_gold_badge.png"
            alt="Gold Badge"
            className="absolute bottom-0 right-0 w-6 h-6 p-0.5 bg-base-100 rounded-full"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}

export default InfoUser;
