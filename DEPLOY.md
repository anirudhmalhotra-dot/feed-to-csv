# Deploy on Cloudflare Pages — free, never sleeps

Free, public URL, no cold-start delay, streams big feeds. The
proxy lives in `functions/api/feed.js` and Cloudflare auto-routes it.

## Steps

1. Go to <https://dash.cloudflare.com/sign-up> and sign in (Google works).
2. Left sidebar → **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**.
3. Authorize Cloudflare to read GitHub. Scope to **just this repo**
   (`anirudhmalhotra-dot/feed-to-csv`) if you want.
4. Pick the repo → **Begin setup**. Build settings:

   | Field | Value |
   |---|---|
   | Project name | `feed-to-csv` (or anything; this becomes your subdomain) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *(leave blank)* |
   | Build output directory | `/` |

5. Click **Save and Deploy**. ~30 seconds later:
   ```
   https://feed-to-csv.pages.dev
   ```
   Share that link.

## What you get on the free tier

- Static page: unlimited bandwidth.
- Function (`/api/feed`): 100,000 requests / day.
- **No sleep**, no cold start — always instant.
- Streaming responses with no wall-clock limit, so a 1 GB Joveo
  feed flows through fine.
- Auto-redeploys on every `git push` to `main`.

## Local dev

`serve.py` still works for local testing (it has its own /api/feed
proxy). The Cloudflare function only kicks in when the site is
running on Pages.

```bash
python serve.py     # http://localhost:8000
```

## Custom domain (optional)

Cloudflare Pages → your project → **Custom domains** → **Set up a
custom domain**. Free if the domain's already on Cloudflare DNS.
