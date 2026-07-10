import { SonnerInfo } from "@/components/ui/SonnerToast";
import { useTranslation } from "react-i18next";

const ButtonCreateGroup = ({ onClick, hasUserGroup }) => {
  const { t } = useTranslation("main");
  const handleClick = () => {
    if (hasUserGroup) {
      SonnerInfo(t("right.group_already_owned"));
      return;
    }

    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className="
        fixed bottom-5 right-5
        w-13 h-13
        rounded-full
        text-white
        flex items-center justify-center
        shadow-lg
        transition-all duration-200
        active:scale-95
        z-50
        bg-secondary hover:bg-secondary/90
      "
      title={hasUserGroup ? t("right.group_already_created_title") : t("right.create_new_group_title")}
    >
      <img src="./icons/edit_title.png" alt="" className="w-6 h-6" />
    </button>
  );
};

export default ButtonCreateGroup;
