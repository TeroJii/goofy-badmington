# goofy-badmington

A browser-based 2D badminton game built with plain HTML, CSS, and JavaScript (HTML5 Canvas). No backend, no build step — just open `index.html` in any modern browser.

## Play

👉 **[Play on GitHub Pages](https://terojii.github.io/goofy-badmington/)**

**Note:** You need a keyboard for playing the game. Mobile devices are currently not supported.

## Controls

### 1 Player game

| Key | Action |
|-----|--------|
| ← Arrow | Move left |
| → Arrow | Move right |
| ↓ Arrow | Swing bat |

### 2 Player game

| Key | Player | Action |
|-----|--------|--------|
| Z | Player 1 (left) | Move left |
| C | Player 1 (left) | Move right |
| X | Player 1 (left) | Swing bat |
| ← Arrow | Player 2 (right) | Move left |
| → Arrow | Player 2 (right) | Move right |
| ↓ Arrow | Player 2 (right) | Swing bat |

## Development

Clone the repo and open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## CI/CD

Every push or merge to `main` automatically deploys the latest version to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.
