import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthLocket";
import { getMaxUploads } from "../hooks/useFeature";
import { getPostedMoments, getQueuePayloads } from "@/process/uploadQueue";

export const defaultPostOverlay = {
  overlay_id: "standard",
  color_top: "",
  color_bottom: "",
  text_color: "#FFFFFF",
  icon: "",
  caption: "",
  type: "default",
};

export const usePost = () => {
  const { userPlan } = useContext(AuthContext);
  const [selectedColors, setSelectedColors] = useState({
    top: "", // Trong suốt
    bottom: "", // Trong suốt
    text: "#FFFFFF",
    // type: "none"
  });
  const [postOverlay, setPostOverlay] = useState(defaultPostOverlay);

  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [isTextColor, setTextColor] = useState(null);
  const [isSizeMedia, setSizeMedia] = useState(null);

  const [recentPosts, setRecentPosts] = useState([]);
  const [uploadPayloads, setuploadPayloads] = useState([]); // payloads chờ upload

  const [audience, setAudience] = useState("all"); // "all" | "selected"
  const [selectedRecipients, setSelectedRecipients] = useState([]); // array userId hoặc object bạn bè

  const [maxImageSizeMB, setMaxImageSizeMB] = useState(200); // Full unlock
  const [maxVideoSizeMB, setMaxVideoSizeMB] = useState(200); // Full unlock

  const { image, video } = getMaxUploads();

  useEffect(() => {
    // Always apply high client limits (ignore free-plan caps from API)
    setMaxImageSizeMB(image || 200);
    setMaxVideoSizeMB(video || 200);
  }, [userPlan, image, video]);

  useEffect(() => {
    const fetchData = async () => {
        // Lấy các post đã đăng
        const posted = await getPostedMoments();
        setRecentPosts(posted);

        // Lấy tất cả payload từ queue DB
        const currentPayloads = await getQueuePayloads();
        // Lọc những payload chưa xong (queued, retrying, processing)
        const pendingPayloads = currentPayloads.filter(
          (p) => p.status !== "done" && p.status !== "failed"
        );
        setuploadPayloads(pendingPayloads);
    };

    fetchData();
  }, []); // chỉ chạy 1 lần khi component mount

  const [selectedMoment, setSelectedMoment] = useState(null);
  const [selectedMomentId, setSelectedMomentId] = useState(null);

  const [selectedQueue, setSelectedQueue] = useState(null);

  const [selectedFriendUid, setSelectedFriendUid] = useState(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionInfo, setReactionInfo] = useState({
    emoji: "💛",
    moment_id: null,
    intensity: 1000,
  });
  const [restoreStreak, setRestoreStreak] = useState(null)

  return {
    caption,
    setCaption,
    selectedColors,
    setSelectedColors,
    selectedFile,
    setSelectedFile,
    imageToCrop,
    setImageToCrop,
    preview,
    setPreview,
    isTextColor,
    setTextColor,
    isSizeMedia,
    setSizeMedia,
    postOverlay,
    setPostOverlay,
    recentPosts,
    setRecentPosts,
    audience,
    setAudience,
    selectedRecipients,
    setSelectedRecipients,
    maxImageSizeMB,
    setMaxImageSizeMB,
    maxVideoSizeMB,
    setMaxVideoSizeMB,
    uploadPayloads,
    setuploadPayloads,
    selectedMoment,
    setSelectedMoment,
    selectedMomentId,
    setSelectedMomentId,
    selectedQueue,
    setSelectedQueue,
    selectedFriendUid,
    setSelectedFriendUid,
    reactionInfo,
    setReactionInfo,
    showEmojiPicker,
    setShowEmojiPicker,
    restoreStreak, setRestoreStreak
  };
};
