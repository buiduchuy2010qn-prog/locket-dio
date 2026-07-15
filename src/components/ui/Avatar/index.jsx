import React, { useState } from "react";
import clsx from "clsx";
import LoadingRing from "@/components/ui/Loading/ring";
import { getAvatarOrFallback, imageFallback } from "@/utils";

export default function Avatar({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingRing size={40} stroke={2} color="blue" />
        </div>
      )}

      <img
        src={getAvatarOrFallback(src)}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={imageFallback()}
        className={clsx(
          "transition-opacity duration-300",
          {
            "opacity-100": loaded,
            "opacity-0": !loaded,
          },
          className,
        )}
      />
    </div>
  );
}
