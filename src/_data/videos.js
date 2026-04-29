const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || "";
const MAX_VIDEOS = 12;

module.exports = async function () {
  if (!CHANNEL_ID) {
    console.warn("[videos.js] YOUTUBE_CHANNEL_ID is not set — videos page will show fallback content.");
    return [];
  }

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  try {
    const res = await fetch(feedUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const videos = parseEntries(xml).slice(0, MAX_VIDEOS);
    console.log(`[videos.js] Loaded ${videos.length} videos from YouTube RSS.`);
    return videos;
  } catch (err) {
    console.error("[videos.js] Failed to fetch YouTube RSS:", err.message);
    return [];
  }
};

function parseEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const id = extract(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!id) continue;
    const title = decodeHtml(extract(block, /<title>([^<]+)<\/title>/));
    const published = extract(block, /<published>([^<]+)<\/published>/);
    const thumbnail = extract(block, /<media:thumbnail\s+url="([^"]+)"/);
    const description = decodeHtml(extract(block, /<media:description>([\s\S]*?)<\/media:description>/));
    entries.push({
      id,
      title,
      published,
      thumbnail,
      description,
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
    });
  }
  return entries;
}

function extract(s, re) {
  const m = s.match(re);
  return m ? m[1] : "";
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
