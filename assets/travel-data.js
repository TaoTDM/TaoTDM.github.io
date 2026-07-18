/* ==================== EDIT TRAVELS HERE =========================
   Names must match assets/world-paths.js (countries — e.g.
   'United States of America', not 'USA') or assets/us-states-paths.js
   (states — 'Texas'). `year` and `note` are optional:
     year — shown in the hover tooltip
     note — click the territory to read it
   A bare string 'Taiwan' works too.
   See README.md for the editing workflow.
   ================================================================ */
var VISITED_COUNTRIES = [
  { name: 'United States of America', year: 0,
    note: 'home waters' },
  { name: 'Taiwan', year: 2019, note: 'stunning island. visited family & soaked in the seasides' },
  { name: 'Canada', year: 2019, note: 'quebec snowstorm midway to ski resort' },
  { name: 'China', year: 2019, note: 'beijing is cool but xi\'an is cooler' }
];
var VISITED_STATES = [
  { name: 'Texas', year: 2025, note: 'home port. college, bbq, & gisense lab' },
  { name: 'New York', year: 0, note: 'long island is a place that exists' },
  { name: 'Connecticut', year: 2024, note: 'took my sat here' },
  { name: 'Vermont', year: 2024, note: 'tuff ski resorts' },
  { name: 'New Jersey', year: 2024, note: 'american dream mall' },
  { name: 'California', year: 2019, note: 'trolleys, palm trees, & frosted flakes' },
  { name: 'Nevada', year: 2019, note: 'hoover dam snow cone' },
  { name: 'Arizona', year: 2019, note: 'grand canyon was lowk scary' },
  { name: 'Michigan', year: 2025, note: 'college tours pt 1, w TNS in chat' },
  { name: 'Indiana', year: 2025, note: 'college tours pt 2, w Ivan in chat' },
  { name: 'Illinois', year: 2025, note: 'college tours pt 3, cool lake & corn' },
];
var PLANNED_COUNTRIES = [
  { name: 'New Zealand' },
  { name: 'United Kingdom' },
  { name: 'Australia' },
  { name: 'France' },
  { name: 'Netherlands' },
  { name: 'Switzerland' },
  { name: 'Iceland' },
  { name: 'Italy' },
  { name: 'Greece' },
];
var PLANNED_STATES = [
  { name: 'Washington' },
  { name: 'Oregon' },
  { name: 'Colorado' },
  { name: 'Massachusetts' },
];
var HOME_PORT = {
  lat: 30.2672, lon: -97.7431,   /* world map position */
  statesXY: [465, 495]           /* position on the albers states map */
};
/* ================== END OF TRAVELS EDIT BLOCK ================== */
