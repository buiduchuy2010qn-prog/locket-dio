const fetchMusicApi = async (url, platform = "apple") => {
  try {
    const response = await fetch("https://api-beta.locket-dio.com/api/getInfoMusicV3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        platform,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }


    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("fetchMusicApi:", error.message);
    throw error;
  }
};

module.exports = {
  fetchMusicApi,
};
