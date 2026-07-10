const cheerio = require("cheerio");
const axios = require("axios");

function resizeAppleCover(url, size = 64) {
  if (!url || typeof url !== "string") return "";

  // Regex: tìm phần `/(\d+x\d+)(bb|bb\.jpg|bb\.png)`
  return url.replace(/\/\d+x\d+bb(\.(jpg|png))?$/, `/${size}x${size}bb.jpg`);
}

function linkType(url) {
  if (/https?:\/\/music\.apple\.com\/.+?\/song\//.test(url)) return "song";
  if (/https?:\/\/music\.apple\.com\/.+?\/album\/.+?\?i=\d+/.test(url))
    return "album-song";
  if (/https?:\/\/music\.apple\.com\/.+?\/album\//.test(url)) return "album";
  if (/https?:\/\/music\.apple\.com\/.+?\/playlist\//.test(url))
    return "playlist";
  throw new Error("Apple Music link is invalid");
}

function convertToSongLink(url) {
  const match = url.match(
    /https?:\/\/music\.apple\.com\/([^/]+)\/album\/([^/?#]+)\/\d+\?i=(\d+)/
  );
  if (!match) return url;
  const [_, region, slug, songId] = match;
  return `https://music.apple.com/${region}/song/${slug}/${songId}`;
}

/**
 * Lấy metadata chi tiết (name, artist, lyrics, preview)
 */
async function getAppleMusicMeta(url) {
  const type = linkType(url);
  let finalUrl = url;

  if (type === "album-song") {
    finalUrl = convertToSongLink(url);
    console.log(`🔁 Đã chuyển link album sang song: ${finalUrl}`);
  }

  const res = await axios.get(finalUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  const html = res.data;
  const $ = cheerio.load(html);

  const scriptTag = $('script[id="schema:song"]');
  if (!scriptTag.length) {
    console.log("❌ Không tìm thấy thẻ <script id='schema:song'> trong trang");
    return null;
  }

  const scriptContent = scriptTag.html();
  let parsed;
  try {
    parsed = JSON.parse(scriptContent);
  } catch {
    console.log("⚠️ Nội dung script không phải JSON hợp lệ");
    return null;
  }

  // ✅ Lấy dữ liệu cần thiết
  const songName = parsed.name || parsed.audio?.name || "";
  const artistName =
    parsed.audio?.byArtist?.[0]?.name ||
    parsed.audio?.inAlbum?.byArtist?.[0]?.name ||
    "Unknown Artist";
  const lyrics = parsed.lyrics?.text || "";
  const contentUrl = parsed.audio?.audio?.contentUrl || "";

  const result = {
    name: songName,
    artist: artistName,
    title: [songName, artistName].filter(Boolean).join(" - "),
    lyrics,
    previewUrl: contentUrl,
    album: parsed.audio?.inAlbum?.name || "",
    image: resizeAppleCover(parsed.image || parsed.audio?.image || ""),
    url: finalUrl,
    appleMusicUrl: url,
    apple_music_url: url,
  };

  // console.log("🎧 Kết quả trích xuất:");
  // console.log(result);

  return result;
}

module.exports = {
  getAppleMusicMeta,
  linkType,
  convertToSongLink,
};

// ✅ Test ví dụ:
// getAppleMusicMeta("https://music.apple.com/vn/album/tears/1794049581?i=1794049597&l=vi");
// getAppleMusicMeta("https://music.apple.com/vn/song/tears/1794049597?l=vi");
