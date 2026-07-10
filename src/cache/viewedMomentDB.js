import { markAsViewedMoment } from "@/services";
import db from "./configDB";

export const isMomentViewed = async (momentId) => {
  const viewed = await db.viewedMoments.get(momentId);
  return !!viewed;
};

export const markMomentViewedOnce = async ({ id, user, celebrity }) => {
  if (!id) return false;

  const existed = await db.viewedMoments.get(id);
  if (existed) return false;

  // gọi API
  await markAsViewedMoment(id, celebrity);

  // lưu local
  await db.viewedMoments.put({
    id,
    user,
    viewedAt: Date.now(),
  });

  return true;
};
