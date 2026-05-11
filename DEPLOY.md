# Host it for free — Render, ~5 minutes

This folder ships as one piece: a Python server (`serve.py`) that serves
the page AND proxies the XML feed URL. Render runs it for free, gives
you a public HTTPS URL anyone can use.

## Steps

1. **Push this folder to a GitHub repo** (any name, public or private).
   - On GitHub: *New repo* -> drag `index.html`, `serve.py`, `render.yaml`
     into the upload area -> commit.
   - Or if you use git locally: `git init && git add . && git commit -m "init"`
     then push.

2. **Sign up at <https://render.com>** (Google login is fine).

3. **New +** -> **Web Service** -> connect your GitHub account ->
   pick the repo.

4. Render reads `render.yaml` automatically. Settings auto-fill:
   - Environment: `Python`
   - Build command: `echo no-build`
   - Start command: `python serve.py`
   - Plan: `Free`

   Click **Create Web Service**.

5. Wait ~60 seconds. Your URL appears at the top:
   `https://feed-to-csv-xxxx.onrender.com`

6. Share it. Done.

## Notes

- **Free tier sleeps after 15 min idle**. First hit after sleep takes
  ~30 s to wake up. After that it's instant. Upgrade to the $7/mo
  Starter plan to keep it always-on if needed.
- **Auto-deploy on git push**: every commit redeploys in ~30 s.
- **Custom domain**: free, add it from the Render dashboard once your
  service is live (Settings -> Custom Domain).
- **Logs**: live tail in the Render dashboard. Useful if a feed URL
  starts misbehaving.

## Local dev

```bash
python serve.py            # http://localhost:8000
```

That's it. Same server runs locally and in production.
