# TaoTDM.github.io

Personal portfolio published as a static GitHub Pages site.

## Project structure

- `index.html` — document structure and interactive SVG markup
- `assets/site.css` — site presentation and responsive/print rules
- `assets/travel-data.js` — visited and planned location content
- `assets/site.js` — interface, weather, map, and compass behavior
- `assets/*-paths.js` — map geometry data
- `fonts/` and `images/` — local visual assets

## Local preview

From the repository root:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Updating the travel chart

Edit the arrays in `assets/travel-data.js`. Location names must match the map
geometry names in `assets/world-paths.js` or `assets/us-states-paths.js`.
Optional `year` and `note` fields supply the map tooltip and click-through field
note without requiring changes to the rendering code.
