import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthLocket";
import { getQueuePayloads } from "@/process/uploadQueue";
import { useMomentsStoreV2 } from "@/stores/useMomentsStoreV2";

/**
 * Background queue worker only — no UI.
 * Syncs IndexedDB upload queue and auto-refreshes moments feed when uploads finish.
 */
const UploadingQueue = () => {
  const { setuploadPayloads, selectedFriendUid } = useApp().post;
  const { user } = useAuth();
  const fetchMoments = useMomentsStoreV2((s) => s.fetchMoments);
  const prevDoneCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const payloads = await getQueuePayloads();
        if (cancelled) return;

        setuploadPayloads(payloads);

        const doneCount = payloads.filter((p) => p.status === "done").length;
        if (doneCount > prevDoneCount.current && user) {
          prevDoneCount.current = doneCount;
          await fetchMoments(user, selectedFriendUid);
        } else {
          prevDoneCount.current = doneCount;
        }
      } catch (err) {
        console.error("❌ Queue sync:", err);
      }
    };

    tick();
    const timer = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, selectedFriendUid, fetchMoments, setuploadPayloads]);

  return null;
};

export default UploadingQueue;
