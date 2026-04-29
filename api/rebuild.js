/**
 * MCP Rebuild Trigger - Called by the Vercel daily cron to refresh the site.
 *
 * Fires a POST to a Vercel Deploy Hook URL, which kicks off a fresh build.
 * The build re-fetches the YouTube RSS feed in src/_data/videos.js so any new
 * videos uploaded since the last deploy show up on /videos.
 *
 * Auth: Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to cron
 * invocations when CRON_SECRET is set. We verify that header so a random
 * caller can't trigger rebuilds.
 *
 * Required env vars:
 *   VERCEL_DEPLOY_HOOK_URL - the deploy hook URL from Vercel project settings
 *   CRON_SECRET            - shared secret Vercel uses to sign cron requests
 */

const https = require("https");

function postDeployHook(hookUrl) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(hookUrl);
    } catch (err) {
      return reject(new Error(`Invalid VERCEL_DEPLOY_HOOK_URL: ${err.message}`));
    }
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Length": 0 },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return res.status(500).json({ error: "VERCEL_DEPLOY_HOOK_URL is not set" });
  }

  try {
    const result = await postDeployHook(hookUrl);
    if (result.status >= 200 && result.status < 300) {
      return res.status(200).json({ ok: true, triggered: true, status: result.status });
    }
    return res.status(502).json({ error: "Deploy hook failed", status: result.status, body: result.body });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
