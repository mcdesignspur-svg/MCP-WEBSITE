/**
 * MCP Admin API - Get or update the boxer roster in GitHub
 *
 * Storage: src/_data/boxers.json (array of boxers).
 * Each boxer: { name, alias, is_champion, division, weight, record, kos, boxrec, image, featured, frame }
 *
 * GET  -> returns { boxers: [...] }
 * POST -> body { boxers: [...] } replaces the entire list (atomic)
 *
 * The Eleventy build renders src/boxers.html and the homepage roster strip
 * directly from this file, so a successful POST triggers a Vercel rebuild and
 * the new records appear live in ~1 minute.
 */

const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const REPO = "mcottojr-design/MCP-WEBSITE";
const BRANCH = "main";
const FILE_PATH = "src/_data/boxers.json";

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

function sanitizeBoxer(b) {
  return {
    name: String(b.name || ""),
    alias: String(b.alias || ""),
    is_champion: !!b.is_champion,
    division: String(b.division || ""),
    weight: String(b.weight || ""),
    record: String(b.record || ""),
    kos: String(b.kos || ""),
    boxrec: String(b.boxrec || ""),
    image: String(b.image || ""),
    featured: !!b.featured,
    frame: b.frame === "top" ? "top" : "",
  };
}

function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  // Keep only entries that have at least a name.
  return arr.map(sanitizeBoxer).filter((b) => b.name);
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
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : [];
        return res.status(200).json({ boxers: list });
      }
      if (result.status === 404) return res.status(200).json({ boxers: [] });
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

    const boxers = normalizeList(req.body && req.body.boxers);
    const content = JSON.stringify(boxers, null, 2) + "\n";
    const encoded = Buffer.from(content).toString("base64");

    try {
      let sha;
      const existing = await githubRequest("GET", `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
      if (existing.status === 200) sha = existing.body.sha;

      const commitBody = {
        message: "Update roster via admin dashboard",
        content: encoded,
        branch: BRANCH,
        ...(sha && { sha }),
      };

      const result = await githubRequest("PUT", `/repos/${REPO}/contents/${FILE_PATH}`, commitBody);
      if (result.status === 200 || result.status === 201) {
        return res.status(200).json({ success: true, boxers });
      }
      return res.status(500).json({ error: "GitHub update failed", details: result.body });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
