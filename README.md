# TaoTDM.github.io

Personal portfolio published as a static GitHub Pages site. A modern dark-stone
theme with an animated rain-and-mist atmosphere (jade/blue accents); the
`[clear mist]` control turns the atmosphere on and off.

## Project structure

- `index.html` — document structure and interactive SVG markup
- `assets/site.css` — site presentation, palette tokens, and responsive/print rules
- `assets/travel-data.js` — visited and planned location content
- `assets/site.js` — interface, rain canvas, weather, map, and dial behavior
- `assets/*-paths.js` — map geometry, loaded one view at a time
- `fonts/` and `images/` — local visual assets
- `vite.config.js` — production bundling and asset hashing

## Local preview

From the repository root:

```sh
npm install
npm run dev
```

Vite prints the local URL and reloads the page as files change. To check the
same optimized files that will be deployed, run:

```sh
npm run build
npm run preview
```

Pushes to `main` are built and published by the GitHub Pages workflow.

## Updating the travel chart

Edit the arrays in `assets/travel-data.js`. Location names must match the map
geometry names in `assets/world-paths.js` or `assets/us-states-paths.js`.
Optional `year` and `note` fields supply the map tooltip and click-through field
note without requiring changes to the rendering code.
