import React from "react";
import { useTranslation } from "react-i18next";

export const SystemMessage = ({ content, actorUid, targetUid, getName }) => {
  const { t } = useTranslation("main");
  const actorName = getName(actorUid);
  const targetName = getName(targetUid);

  let sysText = "";
  if (content.type === "userAddedToGroup") {
    sysText = actorName
      ? targetName
        ? t("right.sys_added_by_actor_to_target", { actor: actorName, target: targetName })
        : t("right.sys_added_by_actor", { actor: actorName })
      : targetName
        ? t("right.sys_added_target", { target: targetName })
        : t("right.sys_added_member");
  } else if (content.type === "userRemovedFromGroup") {
    sysText = actorName
      ? targetName
        ? t("right.sys_removed_by_actor_from_target", { actor: actorName, target: targetName })
        : t("right.sys_removed_by_actor", { actor: actorName })
      : targetName
        ? t("right.sys_removed_target", { target: targetName })
        : t("right.sys_removed_member");
  } else if (content.type === "groupNameChanged") {
    sysText = actorName
      ? t("right.sys_name_changed_by_actor", { actor: actorName, name: content.name || "" })
      : t("right.sys_name_changed", { name: content.name || "" });
  } else if (content.type === "groupImageChanged") {
    sysText = actorName
      ? t("right.sys_photo_changed_by_actor", { actor: actorName })
      : t("right.sys_photo_changed");
  }
  
  return (
    <div className="text-center text-[11px] text-base-content/50 font-semibold py-2">{sysText}</div>
  );
};
