export async function convertImageToBlob(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("https://media-service.locket-dio.com/convertImage", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Convert failed");
  }

  return await res.blob();
}