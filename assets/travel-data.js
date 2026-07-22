/* edit your travels here.
   the country names must agree with assets/world-paths.js. for example, use
   'United States of America', not 'USA'. the state names must agree with
   assets/us-states-paths.js. for example, use 'Texas'.
   the year and the note are optional. the hover tooltip shows the year. click
   the territory to read the note.
   a single string is also correct, for example 'Taiwan'.
   for the steps, see README.md. */
export const VISITED_COUNTRIES = [
  { name: 'United States of America', year: 0,
    note: 'home waters' },
  { name: 'Taiwan', year: 2019, note: 'stunning island. visited family & soaked in the seasides' },
  { name: 'Canada', year: 2019, note: 'quebec snowstorm midway to ski resort' },
  { name: 'China', year: 2019, note: 'beijing is cool but xi\'an is cooler' }
];
export const VISITED_STATES = [
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
export const PLANNED_COUNTRIES = [
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
export const PLANNED_STATES = [
  { name : 'Missouri' },
  { name: 'Washington' },
  { name: 'Oregon' },
  { name: 'Colorado' },
  { name: 'Massachusetts' },
];
export const HOME_PORT = {
  lat: 30.2672, lon: -97.7431,   /* the position on the world map. */
  statesXY: [465, 495]           /* the position on the albers states map. */
};
/* end of the travels edit block. */
