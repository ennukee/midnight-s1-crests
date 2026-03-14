# Midnight S1 Crest Planner

WoW Midnight Season 1 planning tool for PvP overlays and Veteran crest allocation.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages deployment

This repo is configured to deploy to:

`https://dbowers.io/midnight-s1-crests/`

### What is already configured

- Vite `base` is set to `/midnight-s1-crests/` in `vite.config.ts`.
- A GitHub Actions workflow publishes the `dist/` folder to GitHub Pages on pushes to `main`.

### One-time GitHub setup

1. Push this repository to GitHub.
2. Open `Settings` -> `Pages` for the repository.
3. Set `Source` to `GitHub Actions`.
4. Ensure your custom domain setup for `dbowers.io` is already managed on your Pages host repo/account.

### Deploy flow

1. Push to `main`.
2. Wait for the `Deploy to GitHub Pages` workflow to finish.
3. Visit `https://dbowers.io/midnight-s1-crests/`.
