/**
 * MCP Admin API - Upload an image to GitHub
 */

const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const REPO = "mcottojr-design/MCP-WEBSITE";
const BRANCH = "main";

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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { filename, content, folder } = req.body;
  if (!filename || !content) return res.status(400).json({ error: "filename and content are required" });

  // Whitelist the target subfolder under src/assets (defaults to news for back-compat).
  const dir = folder === "boxers" ? "boxers" : "news";
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "-").toLowerCase();
  const filePath = `src/assets/${dir}/${safeName}`;

  // Check if exists
  let sha;
  const existing = await githubRequest("GET", `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`);
  if (existing.status === 200) sha = existing.body.sha;

  const result = await githubRequest("PUT", `/repos/${REPO}/contents/${filePath}`, {
    message: `📸 Upload image: ${safeName}`,
    content,
    branch: BRANCH,
    ...(sha && { sha }),
  });

  if (result.status === 200 || result.status === 201) {
    return res.status(200).json({
      success: true,
      path: `/assets/${dir}/${safeName}`,
      url: result.body.content?.download_url,
    });
  }

  return res.status(500).json({ error: "Upload failed", details: result.body });
};
