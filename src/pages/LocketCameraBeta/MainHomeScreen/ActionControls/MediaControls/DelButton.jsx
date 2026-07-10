import { X } from "lucide-react";
import { useApp } from "@/context/AppContext.jsx";
import { useCallback } from "react";
import { resetAllPostData } from "@/utils";
import { usePostStore } from "@/stores";

const DelButton = () => {
  const { navigation, useloading, camera } = useApp();
  const { setIsFilterOpen } = navigation;
  const { sendLoading, uploadLoading, setUploadLoading } = useloading;

  const resetMedia = usePostStore((s) => s.resetMedia);
  const { setCameraActive } = camera;

  const handleDelete = useCallback(() => {
    // Dừng stream cũ nếu có
    if (camera.streamRef.current) {
      camera.streamRef.current.getTracks().forEach((track) => track.stop());
      camera.streamRef.current = null;
    }
    resetMedia();

    resetAllPostData(); // Call Utils để reset toàn bộ data liên quan

    setCameraActive(true); // Giữ dòng này để trigger useEffect
  }, []);

  return (
    <>
      <button
        className="cursor-pointer active:scale-95"
        onClick={handleDelete}
        disabled={sendLoading || uploadLoading}
      >
        <X size={35} />
      </button>
    </>
  );
};

export default DelButton;
