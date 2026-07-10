const spotifyURI = require("spotify-uri");
const { parse } = require("himalaya");
const axios = require("axios");
const cheerio = require("cheerio");

const TYPE = {
  ALBUM: "album",
  ARTIST: "artist",
  EPISODE: "episode",
  PLAYLIST: "playlist",
  TRACK: "track",
};

const ERROR = {
  REPORT:
    "Please report the problem at https://github.com/microlinkhq/spotify-url-info/issues.",
  NOT_DATA: "Couldn't find any data in embed page that we know how to parse.",
  NOT_SCRIPTS: "Couldn't find scripts to get the data.",
};

const SUPPORTED_TYPES = Object.values(TYPE);

const throwError = (message, html) => {
  const error = new TypeError(`${message}\n${ERROR.REPORT}`);
  // error.html = html;
  throw error;
};

const parseData = (html) => {
  const embed = parse(html);

  let scripts = embed.find((el) => el.tagName === "html");
  if (scripts === undefined) return throwError(ERROR.NOT_SCRIPTS, html);

  scripts = scripts.children
    .find((el) => el.tagName === "body")
    .children.filter(({ tagName }) => tagName === "script");

  let script = scripts.find((script) =>
    script.attributes.some(({ value }) => value === "resource")
  );

  if (script !== undefined) {
    return normalizeData({
      data: JSON.parse(Buffer.from(script.children[0].content, "base64")),
    });
  }

  script = scripts.find((script) =>
    script.attributes.some(({ value }) => value === "initial-state")
  );

  if (script !== undefined) {
    const data = JSON.parse(Buffer.from(script.children[0].content, "base64"))
      .data.entity;
    return normalizeData({ data });
  }

  script = scripts.find((script) =>
    script.attributes.some(({ value }) => value === "__NEXT_DATA__")
  );

  if (script !== undefined) {
    const string = Buffer.from(script.children[0].content);
    const data = JSON.parse(string).props.pageProps.state?.data.entity;
    if (data !== undefined) return normalizeData({ data });
  }

  return throwError(ERROR.NOT_DATA, html);
};

async function createGetData(url, opts) {
  const parsedUrl = getParsedUrl(url);
  console.log(parsedUrl);

  const embedURL = spotifyURI.formatEmbedURL(parsedUrl);

  const response = await fetch(embedURL, opts);

  const text = await response.text();
  return parseData(text);
}

function getParsedUrl(url) {
  try {
    const parsedURL = spotifyURI.parse(url);

    if (!parsedURL.type) throw new TypeError();
    return spotifyURI.formatEmbedURL(parsedURL);
  } catch (_) {
    throw new TypeError(`Couldn't parse '${url}' as valid URL`);
  }
}

// const getImages = data =>
//   data.coverArt?.sources || data.images || data.visualIdentity.image

const getDate = (data) => data.releaseDate?.isoString || data.release_date;

// const getLink = data => spotifyURI.formatOpenURL(data.uri)

function getArtistTrack(track) {
  return track.show
    ? track.show.publisher
    : []
        .concat(track.artists)
        .filter(Boolean)
        .map((a) => a.name)
        .reduce(
          (acc, name, index, array) =>
            index === 0
              ? name
              : acc + (array.length - 1 === index ? " & " : ", ") + name,
          ""
        );
}

const getTracks = (data) =>
  data.trackList ? data.trackList.map(toTrack) : [toTrack(data)];
const getImages = (data) =>
  data.coverArt?.sources || data.images || data.visualIdentity.image;

const getLink = (data) => spotifyURI.formatOpenURL(data.uri);

async function getPreview(data) {
  const [track] = getTracks(data);
  const date = getDate(data);

  const previewUrls = await getSpotifyLinks(getLink(data));

  // return {
  //   date: date ? new Date(date).toISOString() : date,
  //   title: [data.name, track.artist].filter(Boolean).join(" - "), //tên bài hát
  //   name: data.name,
  //   type: data.type, //Loại ví dụ album track
  //   track: track.name, //Tên Track
  //   description: data.description || data.subtitle || track.description,
  //   artist: track.artist, //Tên nghệ sĩ
  //   image: getImages(data)?.reduce((a, b) => (a.width > b.width ? a : b))?.url,
  //   audio: track.previewUrl, //Link nghe thử trả về là link
  //   spotify_url: getLink(data), //Link bài hát
  //   preview_url: track.previewUrl, // Link nghe thử bản là link
  //   previewUrl: track.previewUrl,
  //   //preview_url_V2: previewUrls, //Link nghe thử trả về trả về là chuỗi
  //   // embed: `https://embed.spotify.com/?uri=${data.uri}`
  // };

  return {
    date: date ? new Date(date).toISOString() : date,
    title: [data.name, track.artist].filter(Boolean).join(" - "), //tên bài hát
    name: data.name,
    type: "music",
    track: track.name, //Tên Track
    description: data.description || data.subtitle || track.description,
    artist: track.artist, //Tên nghệ sĩ
    image: getImages(data)?.reduce((a, b) => (a.width > b.width ? a : b))?.url,
    audio: track.previewUrl, //Link nghe thử trả về là link
    spotify_url: getLink(data), //Link bài hát
    preview_url: track.previewUrl, // Link nghe thử bản là link
    previewUrl: track.previewUrl,
    //preview_url_V2: previewUrls, //Link nghe thử trả về trả về là chuỗi
    // embed: `https://embed.spotify.com/?uri=${data.uri}`
  };
}
async function getSpotifyLinks(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const scdnLinks = new Set();

    $("*").each((i, element) => {
      const attrs = element.attribs;
      Object.values(attrs).forEach((value) => {
        if (value && value.includes("p.scdn.co")) {
          scdnLinks.add(value);
        }
      });
    });

    return Array.from(scdnLinks);
  } catch (error) {
    throw new Error(`Failed to fetch preview URLs: ${error.message}`);
  }
}
const toTrack = (track) => ({
  artist: getArtistTrack(track) || track.subtitle,
  duration: track.duration,
  name: track.title,
  previewUrl: track.isPlayable ? track.audioPreview.url : undefined,
  uri: track.uri,
});

const normalizeData = ({ data }) => {
  if (!data || !data.type || !data.name) {
    throw new Error("Data doesn't seem to be of the right shape to parse");
  }

  if (!SUPPORTED_TYPES.includes(data.type)) {
    throw new Error(
      `Not an ${SUPPORTED_TYPES.join(", ")}. Only these types can be parsed`
    );
  }

  data.type = data.uri.split(":")[1];

  return data;
};
async function getSpotifyTrackInfo(url) {
  try {
    console.log(url);
    // Kiểm tra định dạng URL
    const isValidSpotifyTrackUrl = (url) => {
      const regex =
        /^https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+(\?.*)?$/;
      return regex.test(url.trim());
    };

    // Nếu URL không hợp lệ, trả về lỗi 400
    if (!isValidSpotifyTrackUrl(url)) {
      return {
        status: 400,
        message:
          "URL không hợp lệ. Vui lòng cung cấp một liên kết bài hát Spotify hợp lệ.",
      };
    }
    //Lấy emb đã
    const res = await createGetData(url);
    //Lấy chi tiết bản nhạc
    const response = await getPreview(res);

    return response;
  } catch (error) {
    console.error("Lỗi khi lấy preview:", error);
  }
}

module.exports = {
  getSpotifyTrackInfo,
};
