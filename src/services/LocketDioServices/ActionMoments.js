import api from "@/libs/axios";

export const GetAllMoments = async ({
  timestamp = null,
  friendId = null,
  limit = 60,
}) => {
  try {
    const res = await api.post("/locket/getMomentV2", {
      timestamp: timestamp,
      friendId: friendId,
      limit: limit,
    });
    return res.data?.data;
  } catch (err) {
    console.warn("Failed", err);
  }
};

export const GetReactionsMoment = async (idMoment) => {
  try {
    const body = {
      data: {
        moment_uid: idMoment,
      },
    };
    const res = await api.post("/locket/getMomentReactions", body);
    const moments = res.data.data;
    return moments;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
};
