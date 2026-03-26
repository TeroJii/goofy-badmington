# Copilot Instructions

## Project Overview

Goofy Badminton is a browser-based 2D badminton game built with plain HTML, CSS, and JavaScript (HTML5 Canvas). There is no build step, no bundler, and no backend — just static files served directly in any modern browser.

## Technology Stack

- **HTML5** — semantic markup, Canvas element for the game viewport
- **CSS3** — layout and visual styling (no preprocessors)
- **Vanilla JavaScript (ES2020+)** — game logic, Canvas 2D rendering, keyboard input
- No frameworks, no npm packages, no build tools

## Code Style & Best Practices

### General
- Use `'use strict';` at the top of every JavaScript file.
- Prefer `const` over `let`; avoid `var`.
- Use descriptive, camelCase names for variables and functions; use SCREAMING_SNAKE_CASE for module-level constants.
- Keep functions small and focused on a single responsibility.
- Add JSDoc comments (`/** … */`) to all public functions, documenting parameters and return values.

### HTML
- Use semantic elements where appropriate (`<h1>`, `<p>`, etc.).
- Always include `lang` on `<html>`, `charset` and `viewport` meta tags.
- Keep `index.html` minimal; load a single `<script src="game.js">` at the end of `<body>`.

### CSS
- Apply a CSS reset (`* { box-sizing: border-box; margin: 0; padding: 0; }`).
- Use custom properties (CSS variables) for repeated color values and spacing.
- Prefer Flexbox for layout.

### JavaScript / Canvas
- Validate DOM element existence with `instanceof` checks before use (see existing canvas guard).
- Pre-render static backgrounds to an offscreen canvas; blit each frame with `drawImage` to minimise per-frame Canvas API calls.
- Use `requestAnimationFrame` for the game loop — never `setInterval` or `setTimeout`.
- Group related constants at the top of the file with clear section comments.
- Avoid global mutable state beyond the minimal game-state objects (`player`, `keys`).

## Architecture

```
index.html   — page shell and canvas element
style.css    — all visual styling
game.js      — entire game: constants, state, input, rendering, game loop
```

All game logic lives in `game.js`. If the file grows large, extract logical sections into ES modules (e.g. `renderer.js`, `physics.js`) and load them with `<script type="module">`.

## Running Locally

Open `index.html` directly in a browser, or serve with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Testing

There is currently no automated test suite. Manual testing is done by opening `index.html` in a browser and verifying gameplay. When adding automated tests in future, prefer lightweight vanilla solutions (e.g. Node's built-in test runner) that require no additional dependencies.
