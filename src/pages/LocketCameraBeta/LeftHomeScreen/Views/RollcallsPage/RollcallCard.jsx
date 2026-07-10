import React, { useState } from "react";
import RollcallHeader from "./RollcallHeader";
import RollcallImages from "./RollcallImages";
import RollcallComments from "./RollcallComments";
import { useTranslation } from "react-i18next";

function RollcallCard({ post }) {
  const { t } = useTranslation("main");
  const [openComments, setOpenComments] = useState(false);
  const [activeItem, setActiveItem] = useState(post.items?.[0] || null);

  return (
    <div className="bg-base-100 p-4 rounded-xl shadow flex flex-col gap-3">
      <RollcallHeader post={post} activeItem={activeItem}/>
      <hr />
      <RollcallImages items={post.items} onActiveChange={setActiveItem}/>
      <span className="text-xs opacity-50">
        {new Date(post.created_at._seconds * 1000).toLocaleString()}
      </span>

      {post.comments?.length > 0 && (
        <button
          onClick={() => setOpenComments((v) => !v)}
          className="text-sm text-blue-500"
        >
          {openComments ? t("left.hide_comments") : t("left.view_comments")}
        </button>
      )}

      {openComments && <RollcallComments comments={post.comments} />}
    </div>
  );
}

export default RollcallCard;
