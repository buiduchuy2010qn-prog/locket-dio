import { Sparkles } from "lucide-react";
import { useAppNavigation, useAppLoading } from "@/context/AppContext";

const OverlayButton = () => {
  const navigation = useAppNavigation();
  const useloading = useAppLoading();
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
