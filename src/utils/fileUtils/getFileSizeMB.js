export const getFileSizeMB = (file, fixed = 2) => {
  if (!file || typeof file.size !== "number") return "0.00";

  return (file.size / 1024 / 1024).toFixed(fixed);
};