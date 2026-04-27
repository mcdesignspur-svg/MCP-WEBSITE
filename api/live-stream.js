/**
 * MCP Admin API - Get or update the homepage live stream block.
 *
 * Storage: src/_data/live_stream.json
 * Schema: { youtube_id: string, title: string, is_live: boolean }
 *
 * GET  -> returns the current settings.
 * POST -> body { youtube_id, title, is_live } replaces the file.
 *         If youtube_id is empty, the live stream section is hidden on the home.
 */

const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const REPO = "mcottojr-design/MCP-WEBSITE";
const BRANCH = "main";
const FILE_PATH = "src/_data/live_stream.json";

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.github.com",
      path,
      method,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "MCP-Admin/1.0",
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) }),
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Accept a full YouTube URL, a watch link, a youtu.be link, a /live/ link, or a bare id.
function extractYouTubeId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  // Already looks like an id (11 chars of YouTube alphabet)
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\//, "").split("/")[0] || "";
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      // /embed/<id>, /live/<id>, /shorts/<id>
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && ["embed", "live", "shorts"].includes(parts[0])) {
        return parts[1];
      }
    }
  } catch {
    // Not a URL — fall through and just return the raw string.
  }
  return raw;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const result = await githubRequest("GET", `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
      if (result.status === 200) {
        const content = Buffer.from(result.body.content, "base64").toString();
        return res.status(200).json(JSON.parse(content));
      }
      if (result.status === 404) {
        return res.status(200).json({ youtube_id: "", title: "", is_live: false });
      }
      return res.status(result.status).json({ error: "File not found", details: result.body });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const data = {
      youtube_id: extractYouTubeId(body.youtube_id),
      title: String(body.title || ""),
      is_live: !!body.is_live,
    };

    const content = JSON.stringify(data, null, 2) + "\n";
    const encoded = Buffer.from(content).toString("base64");

    try {
      let sha;
      const existing = await githubRequest("GET", `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
      if (existing.status === 200) sha = existing.body.sha;

      const commitBody = {
        message: "Update live stream via admin dashboard",
        content: encoded,
        branch: BRANCH,
        ...(sha && { sha }),
      };

      const result = await githubRequest("PUT", `/repos/${REPO}/contents/${FILE_PATH}`, commitBody);
      if (result.status === 200 || result.status === 201) {
        return res.status(200).json({ success: true, ...data });
      }
      return res.status(500).json({ error: "GitHub update failed", details: result.body });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
