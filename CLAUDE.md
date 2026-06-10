# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing site for **Miguel Cotto Promotions** (Puerto Rican boxing promoter). Built as a static site with Eleventy (11ty), deployed to Vercel, with a custom admin panel + serverless API for content management. Production: `mcp-website-dun.vercel.app` / `miguelcottopromotions.com`. GitHub repo (used by the admin API): `mcottojr-design/MCP-WEBSITE`.

## Commands

```bash
npm install          # install Eleventy
npm start            # eleventy --serve  (local dev w/ hot reload)
npm run build        # eleventy → outputs to _site/
```

There is no test suite or linter. Vercel runs `npm run build` and serves `_site/` (see `vercel.json`).

The boxer roster is **data-driven** (see "Roster as data" below) — there is no generation step. `update_roster.py` is retired (it's now a no-op stub that errors if run); do not reintroduce HTML generation there.

The other top-level Python scripts (`build.py`, `init_11ty.py`, `fix_*.py`, `replace_all_logos.py`, `scale*.py`, `restore.py`, `update_events_page.py`, `update_logo.py`, `switch_to_svg.py`, `get_logos.py`, `create_story.py`) are one-shot migration/scaffolding tools from the original conversion of Stitch-exported HTML directories (`miguel_cotto_promotions_home_linked/`, `events_tickets/`, etc.) into the Eleventy `src/` tree. They are not part of the normal build and generally don't need to be run.

## Architecture

### Eleventy build (`src/` → `_site/`)

Configured in `.eleventy.js`. Input `src/`, output `_site/`, `_includes/` for layouts. Templates use Nunjucks (`.njk`) and Markdown. Custom filters: `date` (handles `MMM DD`, `MMM D`, default long form), `limit` (array slice), `boxerName` (builds a fighter's display name with the alias inserted after the first name), and `divisions` (sorted unique list of divisions from the boxers array, for the roster filter dropdown).

Pass-through copies: `src/assets/` and `src/admin/` (the admin SPA is shipped as static files alongside the site).

Pages live as front-matter HTML/Markdown in `src/`:
- `index.html`, `boxers.html`, `news.html`, `events.html`, `about.html`, `videos.html`, `profile.html`
- `sitemap.njk`
- `news/*.md` — each post has `tags: post`, layout `layouts/post.njk`. Posts in `src/drafts/` use `tags: draft` and don't appear in `collections.post`.

Layouts: `src/_includes/layouts/base.njk` (header/nav/footer/mobile menu — all pages extend this) and `src/_includes/layouts/post.njk` (article hero, gallery lightbox, prev/next nav). Tailwind is loaded from CDN (`cdn.tailwindcss.com`) with config inlined in `base.njk` (brand color `#d72323`, dark bg `#120909`, font Space Grotesk).

Global data lives in `src/_data/`:
- `events.json` — array of event cards consumed by `events.html`. At most one event has `is_main: true` (enforced by the API).
- `live_stream.json` — `{ youtube_id, title, is_live }` for the live-stream block.
- `boxers.json` — array of fighters consumed by `boxers.html` (full grid) and `index.html` (featured strip). See "Roster as data" below.

### Admin panel + serverless API

The admin is a single-file SPA at `src/admin/index.html` (~2400 lines, Quill editor, plain JS). It talks to **Vercel serverless functions** in `api/*.js` that commit changes back to the GitHub repo, which retriggers a Vercel build.

Functions (all CommonJS, plain `https` calls — no SDKs):
- `api/auth.js` — GitHub OAuth proxy for Decap CMS (the `src/admin/config.yml` flow). Uses `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI`.
- `api/posts.js` — `GET`, lists posts from `src/news/` and `src/drafts/`, parses front matter.
- `api/publish.js` — `POST`, writes a markdown file to `src/news/` (or `src/drafts/` when `draft: true`). Filename is `${date}-${slug}.md`. Handles renames via `editingPath` (deletes old file).
- `api/upload.js` — `POST`, base64 → `src/assets/${folder}/${safeName}`. `folder` is whitelisted to `news` (default) or `boxers`.
- `api/delete.js` — removes a post.
- `api/event.js` — `GET`/`POST` for `src/_data/events.json`. Server-side enforces only one `is_main`.
- `api/roster.js` — `GET`/`POST` for `src/_data/boxers.json`. Sanitizes each boxer and drops entries with no `name`.
- `api/live-stream.js` — `GET`/`POST` for `src/_data/live_stream.json`.

All admin endpoints (everything except `auth.js`) require `Authorization: Bearer ${ADMIN_PASSWORD}` and use `GITHUB_TOKEN` server-side to commit to `mcottojr-design/MCP-WEBSITE` on `main`. After a write, Vercel rebuilds — content takes ~1 minute to appear live.

Two CMS pathways coexist: the custom admin SPA (primary, hits `api/*`) and a Decap CMS config at `src/admin/config.yml` (uses `api/auth.js` + GitHub directly via editorial workflow). Touching one doesn't automatically affect the other.

### Roster as data

The boxer roster is canonical in `src/_data/boxers.json` — an array of fighters. Each entry: `{ name, alias, is_champion, division, weight, record, kos, boxrec, image, featured, frame }`. Eleventy exposes it as the `boxers` global, and two pages render it with Nunjucks loops (no generation step):
- `src/boxers.html`: the `<!-- Fighter Grid -->` loops over all boxers; the division filter dropdown is built from `boxers | divisions`. The search/filter `<script>` still operates on the rendered `.boxer-card` / `data-division` elements.
- `src/index.html`: the `<!-- Boxers Directory -->` strip loops over boxers and shows those with `featured: true` (in array order).

Editing happens in the admin **Roster** tab → `api/roster.js` → commits `boxers.json` → Vercel rebuild. `image` is the resolved path under `/assets/boxers/` (uploads go through `api/upload.js` with `folder: "boxers"`). `frame: "top"` applies top-crop framing (`bg-top scale-90` / `object-top scale-90`) for portraits that need it (e.g. Yadiel Alomar); default `""` is centered. To add a boxer, use the admin tab (or add a JSON entry + drop a portrait into `src/assets/boxers/`).

### Routing on Vercel

`vercel.json` sets `cleanUrls: true` and rewrites `/news.html → /news` etc. so the nav links in `base.njk` (which point at `/news.html`) resolve to clean URLs in production.

## Conventions

- News posts: filename `YYYY-MM-DD-slug.md`, front matter requires `layout`, `tags: post`, `title`, `date`, `image`, `category`, `excerpt`. `featured: true` promotes a post to the news-page hero (newest featured wins, falls back to newest post).
- `image_focus` (e.g. `"50% 11%"`) controls `background-position` on hero/event cards — useful for off-center crops.
- Brand styling lives inline in `base.njk`'s Tailwind config; there is no Tailwind build step or CSS file. Use the registered tokens (`primary`, `surface`, `border-muted`, `background-dark`, `font-display`).
- Don't hand-edit content under `_site/` — it's the build output.
- `Boxer Roster Images/`, `NEWS/`, and `ROSTER - Sheet1.pdf` at the repo root are working assets/source material, not part of the site build.
