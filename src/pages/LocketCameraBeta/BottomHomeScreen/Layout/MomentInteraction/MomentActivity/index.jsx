import { useState } from "react";
import ActivityButton from "./ActivityButton";
import PrivateButton from "./PrivateButton";
import { ActivityModal } from "@/features/ActivityModal";

export default function MomentActivity({
  isPublic,
  activity,
  isLoading,
  pollCounts,
}) {
  const [showModal, setShowModal] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // isPublic === undefined: store chưa sync xong, chờ isLoading
  // isPublic === false: moment thực sự private → hiện PrivateButton
  // isPublic === true: moment public → hiện activity
  if (isPublic === false) {
    return (
      <div className="relative flex w-full items-center justify-center">
        <PrivateButton />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full">
        <ActivityButton
          activity={activity}
          isLoading={isLoading}
          onClick={() => setShowModal(true)}
        />
      </div>

      <ActivityModal
        show={showModal}
        onClose={() => setShowModal(false)}
        activity={activity}
        isLoading={isLoading}
        pollCounts={pollCounts}
        activeTooltip={activeTooltip}
        setActiveTooltip={setActiveTooltip}
      />
    </>
  );
}