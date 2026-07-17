import { Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext.jsx";

const OverlayButton = () => {
  const { navigation, useloading, camera } = useApp();
  const { setIsFilterOpen } = navigation;
  const { sendLoading, uploadLoading, setUploadLoading } = useloading;

  return (
    <button
      type="button"
      className="pillSideBtn"
      onClick={() => {
        setIsFilterOpen(true);
      }}
      disabled={uploadLoading}
      aria-label="Hiệu ứng"
      title="Hiệu ứng"
    >
      <Sparkles size={27} strokeWidth={2} />
    </button>
  );
};

export default OverlayButton;
