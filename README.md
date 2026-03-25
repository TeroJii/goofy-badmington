# goofy-badmington

A browser-based 2D badminton game built with plain HTML, CSS, and JavaScript (HTML5 Canvas). No backend, no build step — just open `index.html` in any modern browser.

## Play

👉 **[Play on GitHub Pages](https://terojii.github.io/goofy-badmington/)**

## Controls

| Key | Action |
|-----|--------|
| ← Arrow | Move player left |
| → Arrow | Move player right |

## Development

Clone the repo and open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## CI/CD

Every push or merge to `main` automatically deploys the latest version to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.
