import { useContext } from "react";
import { AuthContext } from "@/context/AuthLocket";

// Client unlock: treat all plan feature flags as enabled
const UNLIMITED_MB = 200;

export const useFeatureVisible = (_type) => {
  // Full features open for everyone on this client
  return true;
};

export const useGetCode = (type) => {
  const { userPlan } = useContext(AuthContext);
  const code = userPlan?.customer_code;
  return code;
};

export const getMaxUploads = () => {
  // Ignore server plan caps — no size/storage gate on UI
  return {
    image: UNLIMITED_MB,
    video: UNLIMITED_MB,
    storage_limit_mb: -1, // -1 = unlimited
  };
};

export const getVideoRecordLimit = () => {
  // Long video recording (seconds)
  return 60;
};
