import {
  VISITED_COUNTRIES,
  VISITED_STATES,
  PLANNED_COUNTRIES,
  PLANNED_STATES,
  HOME_PORT
} from './travel-data.js?v=20260720-2';

document.documentElement.classList.add('js-ready');

(function() {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- night watch toggle ---- */
  var watch = document.getElementById('watch-toggle');
  function setWatch(w) {
    if (w === 'night') {
      document.documentElement.setAttribute('data-watch', 'night');
      watch.textContent = '[day watch]';
    } else {
      document.documentElement.removeAttribute('data-watch');
      watch.textContent = '[night watch]';
    }
    try { localStorage.setItem('v3-watch', w); } catch (e) {}
  }
  try { if (localStorage.getItem('v3-watch') === 'night') setWatch('night'); } catch (e) {}
  watch.addEventListener('click', function() {
    setWatch(document.documentElement.hasAttribute('data-watch') ? 'day' : 'night');
  });

  /* ---- email: copy with toast ---- */
  var email = 'tao' + '@' + 'taotdm.com';
  var toast = document.getElementById('toast');
  var toastTimer;
  function copyEmailToClipboard() {
    if (!navigator.clipboard) return false;
    navigator.clipboard.writeText(email).then(function() {
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 1600);
    });
    return true;
  }
  function copyEmail(e) {
    if (copyEmailToClipboard()) e.preventDefault();
  }
  ['email-link', 'email-link-2'].forEach(function(id) {
    var el = document.getElementById(id);
    el.setAttribute('href', 'mailto:' + email);
    el.addEventListener('click', copyEmail);
  });

  /* ---- reveal on scroll ---- */
  var revealer = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealer.unobserve(en.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(function(el) { revealer.observe(el); });

  /* ---- weather bearing: the compass ring updates only when data changes ---- */
  var windRing = document.getElementById('wind-ring');
  function setWindRing(direction, speed) {
    if (!Number.isFinite(direction) || !Number.isFinite(speed)) return;
    direction = ((direction % 360) + 360) % 360;
    speed = Math.max(0, Math.min(80, speed));
    windRing.style.transform = 'rotate(' + direction.toFixed(1) + 'deg)';
    windRing.style.opacity = Math.min(0.95, 0.42 + speed / 35).toFixed(2);
  }

  /* ---- scroll: compass bearing (spring-damped pendulum) + ruler marker ----
     The needle doesn't jump straight to its target angle. Every animation
     frame it's pulled toward the target by a spring and slowed by damping,
     so a fast scroll makes it swing past the resting bearing and wobble
     back — same physics whether that happens mid-scroll or right at the
     very top/bottom of the page, no special-casing needed. */
  var needle = document.getElementById('needle');
  var latMarker = document.getElementById('lat-marker');
  var bearing = { angle: 0, vel: 0, target: 0 };
  var springRunning = false;
  var STIFFNESS = 0.04;   // how hard the spring pulls toward the target
  var DAMPING = 0.79;     // fraction of velocity kept each frame (lower = settles faster, less swing)

  function stepSpring() {
    var diff = bearing.target - bearing.angle;
    bearing.vel = (bearing.vel + diff * STIFFNESS) * DAMPING;
    bearing.angle += bearing.vel;
    needle.style.transform = 'rotate(' + bearing.angle + 'deg)';
    if (Math.abs(diff) > 0.05 || Math.abs(bearing.vel) > 0.05) {
      requestAnimationFrame(stepSpring);
    } else {
      bearing.angle = bearing.target;
      bearing.vel = 0;
      needle.style.transform = 'rotate(' + bearing.angle + 'deg)';
      springRunning = false;
    }
  }

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? h.scrollTop / max : 0;
    latMarker.style.top = (p * (h.clientHeight - 12)) + 'px';
    if (reduced) {
      needle.style.transform = 'rotate(' + (p * 360) + 'deg)';
      return;
    }
    bearing.target = p * 360;
    if (!springRunning) {
      springRunning = true;
      requestAnimationFrame(stepSpring);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---- ship's time (austin) ---- */
  var clock = document.getElementById('clock');
  var fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var localtime = document.getElementById('localtime');
  var fmtLocal = new Intl.DateTimeFormat('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function tickClock() {
    clock.textContent = fmt.format(new Date());
    localtime.textContent = fmtLocal.format(new Date());
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---- observed conditions: NWS station data with Open-Meteo fallback ---- */
  var conditions = document.getElementById('conditions');
  var weatherTxt = 'fair weather';
  var sunTxt = '';
  var weatherMeta = null;
  var weatherLoading = false;
  var weatherLoadedAt = 0;
  var NWS_STATION_CACHE = 'v3-nws-station';
  var NWS_STATION_TTL = 7 * 86400000;
  var NWS_MAX_AGE = 90 * 60000;
  var OPEN_METEO_MAX_AGE = 2 * 3600000;
  var DEFAULT_WEATHER = {
    source: 'charted fallback',
    sourceCode: 'fallback',
    station: '',
    description: 'fair weather',
    temperature: null,
    windDirection: 135,
    windSpeed: 6,
    observedAt: null
  };
  var sunFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  var WMO = { 0: 'clear skies', 1: 'fair weather', 2: 'passing clouds', 3: 'overcast',
    45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain',
    65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow',
    73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'showers', 81: 'showers',
    82: 'heavy showers', 95: 'thunderstorms', 96: 'thunderstorms', 99: 'hail & thunder' };
  var windDirs = ['n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse',
                  's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw'];

  function moonTxt() {
    var syn = 29.53058867;
    var d = ((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn;
    var names = ['new moon', 'wax crescent', 'first qtr', 'wax gibbous',
                 'full moon', 'wan gibbous', 'last qtr', 'wan crescent'];
    return '☾ ' + names[Math.floor(((d + syn / 16) % syn) / (syn / 8))];
  }
  function renderConditions() {
    conditions.textContent = [weatherTxt, sunTxt, moonTxt()].filter(Boolean).join(' · ');
  }

  function fetchJson(url, options) {
    options = options || {};
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function() { controller.abort(); }, 8000) : 0;
    var requestOptions = {};
    Object.keys(options).forEach(function(key) { requestOptions[key] = options[key]; });
    if (controller) requestOptions.signal = controller.signal;
    return fetch(url, requestOptions).then(function(r) {
      if (!r.ok) throw new Error('weather request failed: ' + r.status);
      return r.json();
    }).finally(function() {
      if (timeout) clearTimeout(timeout);
    });
  }

  function finite(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function quantityValue(q) {
    return q && finite(q.value) ? q.value : null;
  }

  function quantityToF(q) {
    var value = quantityValue(q);
    if (value === null) return null;
    if (q.unitCode && q.unitCode.indexOf('degC') !== -1) return value * 9 / 5 + 32;
    return value;
  }

  function quantityToKnots(q) {
    var value = quantityValue(q);
    if (value === null) return null;
    var unit = q.unitCode || '';
    if (unit.indexOf('km_h-1') !== -1) return value / 1.852;
    if (unit.indexOf('m_s-1') !== -1) return value * 1.943844;
    if (unit.indexOf('mi_h-1') !== -1) return value * 0.868976;
    return value;
  }

  function readStationCache() {
    try {
      var cached = JSON.parse(localStorage.getItem(NWS_STATION_CACHE));
      if (cached && cached.url && Date.now() - cached.savedAt < NWS_STATION_TTL) return cached;
    } catch (e) {}
    return null;
  }

  function writeStationCache(station) {
    try {
      localStorage.setItem(NWS_STATION_CACHE, JSON.stringify(station));
    } catch (e) {}
  }

  function clearStationCache() {
    try { localStorage.removeItem(NWS_STATION_CACHE); } catch (e) {}
  }

  function resolveNwsStation(force) {
    var cached = !force && readStationCache();
    if (cached) return Promise.resolve(cached);
    var headers = { Accept: 'application/geo+json' };
    return fetchJson('https://api.weather.gov/points/30.2672,-97.7431', { headers: headers })
      .then(function(point) {
        var stationsUrl = point.properties && point.properties.observationStations;
        if (!stationsUrl) throw new Error('NWS station list unavailable');
        return fetchJson(stationsUrl, { headers: headers });
      })
      .then(function(stations) {
        var feature = stations.features && stations.features[0];
        if (!feature || !feature.id) throw new Error('NWS station unavailable');
        var p = feature.properties || {};
        var station = {
          url: feature.id,
          id: p.stationIdentifier || feature.id.split('/').pop(),
          name: p.name || '',
          savedAt: Date.now()
        };
        writeStationCache(station);
        return station;
      });
  }

  function fetchNwsObservation(station) {
    return fetchJson(station.url + '/observations/latest', {
      headers: { Accept: 'application/geo+json' }
    }).then(function(observation) {
      var p = observation.properties || {};
      return {
        source: 'National Weather Service',
        sourceCode: 'nws',
        station: p.stationId || station.id,
        stationName: p.stationName || station.name,
        description: (p.textDescription || '').toLowerCase(),
        temperature: quantityToF(p.temperature),
        windDirection: quantityValue(p.windDirection),
        windSpeed: quantityToKnots(p.windSpeed),
        observedAt: Date.parse(p.timestamp)
      };
    });
  }

  function loadNwsWeather() {
    return resolveNwsStation(false)
      .then(fetchNwsObservation)
      .catch(function() {
        clearStationCache();
        return resolveNwsStation(true).then(fetchNwsObservation);
      });
  }

  function loadOpenMeteoWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=30.2672&longitude=-97.7431' +
      '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m' +
      '&minutely_15=wind_speed_10m,wind_direction_10m&forecast_minutely_15=4' +
      '&daily=sunrise,sunset&forecast_days=1&timezone=America%2FChicago&timeformat=unixtime' +
      '&temperature_unit=fahrenheit&wind_speed_unit=kn&models=best_match';
    return fetchJson(url).then(function(w) {
      var c = w.current || {};
      var minute = w.minutely_15 || {};
      var daily = w.daily || {};
      var windDirection = finite(c.wind_direction_10m) ? c.wind_direction_10m : null;
      var windSpeed = finite(c.wind_speed_10m) ? c.wind_speed_10m : null;
      if ((!finite(windDirection) || !finite(windSpeed)) &&
          minute.wind_direction_10m && minute.wind_speed_10m) {
        windDirection = finite(minute.wind_direction_10m[0]) ? minute.wind_direction_10m[0] : null;
        windSpeed = finite(minute.wind_speed_10m[0]) ? minute.wind_speed_10m[0] : null;
      }
      return {
        source: 'Open-Meteo best match',
        sourceCode: 'open-meteo',
        station: '',
        stationName: '',
        description: WMO[c.weather_code] || 'weather uncertain',
        temperature: finite(c.temperature_2m) ? c.temperature_2m : null,
        windDirection: windDirection,
        windSpeed: windSpeed,
        observedAt: finite(c.time) ? c.time * 1000 : null,
        sunrise: daily.sunrise && finite(daily.sunrise[0]) ? daily.sunrise[0] * 1000 : null,
        sunset: daily.sunset && finite(daily.sunset[0]) ? daily.sunset[0] * 1000 : null
      };
    });
  }

  function isFresh(weather, maxAge) {
    if (!weather || !finite(weather.windDirection) || !finite(weather.windSpeed) ||
        !finite(weather.observedAt)) return false;
    var age = Date.now() - weather.observedAt;
    return age >= -5 * 60000 && age <= maxAge;
  }

  function weatherAgeText(weather) {
    if (!finite(weather.observedAt)) return 'deterministic fallback';
    var minutes = Math.max(0, Math.round((Date.now() - weather.observedAt) / 60000));
    var verb = weather.sourceCode === 'open-meteo' ? 'valid' : 'observed';
    if (minutes < 2) return verb + ' just now';
    if (minutes < 60) return verb + ' ' + minutes + ' min ago';
    return verb + ' ' + Math.round(minutes / 60) + ' hr ago';
  }

  function updateWeatherMetadata() {
    if (!weatherMeta) return;
    var parts = [weatherMeta.source];
    if (weatherMeta.station) parts.push(weatherMeta.station);
    parts.push(weatherAgeText(weatherMeta));
    conditions.title = parts.join(' · ');
    conditions.dataset.weatherSource = weatherMeta.sourceCode;
    conditions.dataset.weatherStation = weatherMeta.station || '';
    conditions.dataset.weatherObserved = finite(weatherMeta.observedAt)
      ? new Date(weatherMeta.observedAt).toISOString() : '';
  }

  function applyWeather(selected, openMeteo) {
    var display = {
      description: selected.description || (openMeteo && openMeteo.description) || 'fair weather',
      temperature: finite(selected.temperature) ? selected.temperature
        : openMeteo && finite(openMeteo.temperature) ? openMeteo.temperature : null,
      windDirection: selected.windDirection,
      windSpeed: selected.windSpeed
    };
    var dir = windDirs[Math.round(display.windDirection / 22.5) % 16];
    weatherTxt = display.description +
      (finite(display.temperature) ? ' · ' + Math.round(display.temperature) + '°f' : '') +
      ' · ' + dir + ' ' + Math.round(display.windSpeed) + 'kt';
    if (openMeteo && finite(openMeteo.sunrise) && finite(openMeteo.sunset)) {
      sunTxt = '↑' + sunFmt.format(new Date(openMeteo.sunrise)) +
        ' ↓' + sunFmt.format(new Date(openMeteo.sunset));
    }
    weatherMeta = selected;
    setWindRing(selected.windDirection, selected.windSpeed);
    updateWeatherMetadata();
    renderConditions();
  }

  function loadWeather() {
    if (typeof fetch === 'undefined') {
      applyWeather(DEFAULT_WEATHER, null);
      return;
    }
    if (weatherLoading) return;
    weatherLoading = true;
    Promise.all([
      loadNwsWeather().catch(function() { return null; }),
      loadOpenMeteoWeather().catch(function() { return null; })
    ]).then(function(results) {
      var nws = results[0];
      var openMeteo = results[1];
      var selected = isFresh(nws, NWS_MAX_AGE) ? nws
        : isFresh(openMeteo, OPEN_METEO_MAX_AGE) ? openMeteo
        : DEFAULT_WEATHER;
      applyWeather(selected, openMeteo);
      weatherLoadedAt = Date.now();
    }).finally(function() {
      weatherLoading = false;
    });
  }

  renderConditions();
  setWindRing(DEFAULT_WEATHER.windDirection, DEFAULT_WEATHER.windSpeed);
  loadWeather();
  setInterval(loadWeather, 15 * 60000);
  setInterval(updateWeatherMetadata, 60000);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && Date.now() - weatherLoadedAt > 15 * 60000) loadWeather();
  });

  /* ---- only one log open per plate feels tidier ---- */
  var printing = false;
  document.querySelectorAll('.plate-body').forEach(function(body) {
    body.addEventListener('toggle', function(e) {
      if (!e.target.open || printing) return;
      /* restart the surfacing animation explicitly — relying on the
         display:none -> block switch to replay it is flaky once other
         overlays/animations have run */
      var log = e.target.querySelector('.log');
      if (log) {
        log.style.animation = 'none';
        void log.offsetWidth;
        log.style.animation = '';
      }
      body.querySelectorAll('details.fix[open]').forEach(function(d) {
        if (d !== e.target) d.open = false;
      });
    }, true);
  });

  /* ---- printing: open every entry, restore afterwards ---- */
  var printOpened = [];
  window.addEventListener('beforeprint', function() {
    printing = true;
    printOpened = [];
    document.querySelectorAll('details.fix:not([open])').forEach(function(d) {
      printOpened.push(d);
      d.open = true;
    });
  });
  window.addEventListener('afterprint', function() {
    printOpened.forEach(function(d) { d.open = false; });
    printOpened = [];
    printing = false;
  });

  /* ---- sextant easter egg ---- */
  var overlay = document.getElementById('overlay');
  var inset = document.getElementById('inset');
  var buffer = '';
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { overlay.classList.remove('open'); return; }
    if (overlay.classList.contains('open')) return;
    if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1) {
      buffer = (buffer + e.key.toLowerCase()).slice(-32);
      if (buffer.slice(-7) === 'sextant') { buffer = ''; overlay.classList.add('open'); }
      else if (travelEgg(buffer)) { buffer = ''; }
    }
  });
  overlay.addEventListener('click', function(e) {
    if (!inset.contains(e.target)) overlay.classList.remove('open');
  });
  document.getElementById('inset-close').addEventListener('click', function() {
    overlay.classList.remove('open');
  });

  /* ---- plate vi: chart of travels + field notes ---- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var travelsFix = document.getElementById('travels-fix');
  var travelmap = document.querySelector('.travelmap');
  var mapWorld = document.getElementById('map-world');
  var mapStates = document.getElementById('map-states');
  var mapTip = document.getElementById('map-tip');
  var fieldNote = document.getElementById('field-note');

  /* normalise entries ('Taiwan' -> {name:'Taiwan'}) and index by name */
  function norm(list) {
    return list.map(function(e) { return typeof e === 'string' ? { name: e } : e; });
  }
  function indexEntries(visited, planned) {
    var m = {};
    visited.forEach(function(e) { m[e.name.toLowerCase()] = { entry: e, status: 'visited' }; });
    planned.forEach(function(e) { m[e.name.toLowerCase()] = { entry: e, status: 'planned' }; });
    return m;
  }
  var vCountries = norm(VISITED_COUNTRIES), vStates = norm(VISITED_STATES);
  var levels = {
    countries: {
      svg: mapWorld,
      index: indexEntries(vCountries, norm(PLANNED_COUNTRIES)),
      built: false,
      loading: null
    },
    states: {
      svg: mapStates,
      index: indexEntries(vStates, norm(PLANNED_STATES)),
      built: false,
      loading: null
    }
  };
  var currentLevel = mapWorld.hasAttribute('hidden') ? 'states' : 'countries';
  var coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  function activeLevel() {
    return levels[currentLevel];
  }

  document.getElementById('travel-count').textContent =
    vStates.length + (vStates.length === 1 ? ' state' : ' states') +
    ' \u00b7 ' + vCountries.length + (vCountries.length === 1 ? ' country' : ' countries');

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ---- map geometry is split into two Vite chunks and loaded on demand ---- */
  function addHatch(svg) {
    svg.style.setProperty('--planned-fill', 'url(#hatch-' + svg.id + ')');
    var defs = svgEl('defs', {});
    var pat = svgEl('pattern', {
      id: 'hatch-' + svg.id, width: 5, height: 5,
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
    });
    var line = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 5, 'stroke-width': 1 });
    line.style.stroke = 'color-mix(in srgb, var(--blue) 45%, transparent)';
    pat.appendChild(line);
    defs.appendChild(pat);
    svg.appendChild(defs);
  }

  function buildMap(level, paths) {
    addHatch(level.svg);
    var marked = [];
    var frag = document.createDocumentFragment();
    paths.forEach(function(t) {
      var p = svgEl('path', { d: t.d, 'data-name': t.n, 'class': 'terr' });
      var hit = level.index[t.n.toLowerCase()];
      if (hit) {
        if (hit.entry.note) p.classList.add('noted');
        marked.push({ el: p, status: hit.status });
      }
      frag.appendChild(p);
    });
    level.svg.appendChild(frag);
    /* scratch-off reveal: marked territories develop one by one */
    marked.forEach(function(m, i) {
      if (reduced) m.el.classList.add(m.status);
      else setTimeout(function() { m.el.classList.add(m.status); }, 250 + i * 140);
    });
  }

  /* the marker lives in a group whose scale is countered on zoom, so it
     keeps a constant on-screen size instead of swallowing texas */
  function drawHome(svg, xy) {
    if (!xy) return;
    var g = svgEl('g', {
      'class': 'home-mark',
      'data-x': xy[0], 'data-y': xy[1],
      transform: 'translate(' + xy[0] + ',' + xy[1] + ')'
    });
    /* same five-point star as the cartouche's "you are here" */
    g.appendChild(svgEl('path', {
      'class': 'star',
      d: 'M0 -8 L2.4 -3 L7.8 -2.4 L3.8 1.4 L4.8 6.8 L0 4.2 L-4.8 6.8 L-3.8 1.4 L-7.8 -2.4 L-2.4 -3 Z',
      transform: 'scale(1.8)'
    }));
    svg.appendChild(g);
  }

  function ensureMap(name) {
    var level = levels[name];
    if (level.built) return Promise.resolve(level);
    if (level.loading) return level.loading;

    var geometry = name === 'countries'
      ? import('./world-paths.js?v=20260720-2')
      : import('./us-states-paths.js?v=20260720-2');
    level.loading = geometry.then(function(module) {
      var paths = name === 'countries' ? module.WORLD_PATHS : module.US_STATE_PATHS;
      buildMap(level, paths);
      if (name === 'countries') {
        drawHome(mapWorld, module.lonLatToXY(HOME_PORT.lon, HOME_PORT.lat));
      } else {
        drawHome(mapStates, HOME_PORT.statesXY);
      }
      level.built = true;
      return level;
    }).catch(function(error) {
      level.loading = null;
      throw error;
    });
    return level.loading;
  }

  travelsFix.addEventListener('toggle', function() {
    if (travelsFix.open) ensureMap(currentLevel);
  });

  /* ---- countries / us states toggle ---- */
  var ttCountries = document.getElementById('tt-countries');
  var ttStates = document.getElementById('tt-states');
  function setLevel(name) {
    var apply = function() {
      var world = name === 'countries';
      currentLevel = name;
      mapWorld.toggleAttribute('hidden', !world);
      mapStates.toggleAttribute('hidden', world);
      ttCountries.classList.toggle('on', world);
      ttStates.classList.toggle('on', !world);
      ttCountries.setAttribute('aria-pressed', String(world));
      ttStates.setAttribute('aria-pressed', String(!world));
      mapTip.style.display = 'none';
    };
    /* View Transitions are intentionally desktop-only: mobile engines can
       snapshot an SVG's old hidden state and leave the replacement blank. */
    if (!reduced && !coarsePointer && document.startViewTransition) document.startViewTransition(apply);
    else apply();
    ensureMap(name);
  }
  ttCountries.addEventListener('click', function() { setLevel('countries'); });
  ttStates.addEventListener('click', function() { setLevel('states'); });

  /* ---- zoom + pan (wheel, drag, buttons; viewBox-based) ---- */
  function panZoom(svg, base) {
    var vb = { x: base[0], y: base[1], w: base[2], h: base[3] };
    var dragging = false, moved = false, sx, sy, ox, oy;
    function apply() {
      svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
      svg.classList.toggle('zoomed', vb.w < base[2] - 0.5);
      /* counter-scale the home marker so it stays a constant screen size */
      var k = vb.w / base[2];
      svg.querySelectorAll('.home-mark').forEach(function(g) {
        g.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ',' +
          g.getAttribute('data-y') + ') scale(' + k + ')');
      });
    }
    function clamp() {
      vb.x = Math.max(base[0], Math.min(base[0] + base[2] - vb.w, vb.x));
      vb.y = Math.max(base[1], Math.min(base[1] + base[3] - vb.h, vb.y));
    }
    function zoomAt(cx, cy, f) {
      var r = svg.getBoundingClientRect();
      var px = vb.x + (cx - r.left) / r.width * vb.w;
      var py = vb.y + (cy - r.top) / r.height * vb.h;
      var w = Math.min(base[2], Math.max(base[2] / 12, vb.w * f));
      var h = w * base[3] / base[2];
      vb.x = px - (px - vb.x) * (w / vb.w);
      vb.y = py - (py - vb.y) * (h / vb.h);
      vb.w = w; vb.h = h;
      clamp(); apply();
    }
    svg.addEventListener('wheel', function(e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.25 : 0.8);
    }, { passive: false });
    svg.addEventListener('dblclick', function(e) { zoomAt(e.clientX, e.clientY, 0.55); });
    svg.addEventListener('pointerdown', function(e) {
      moved = false;
      if (!svg.classList.contains('zoomed')) return; /* pan only when zoomed */
      dragging = true;
      sx = e.clientX; sy = e.clientY; ox = vb.x; oy = vb.y;
    });
    svg.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      var r = svg.getBoundingClientRect();
      if (!moved) {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) <= 5) return;
        moved = true;
        svg.setPointerCapture(e.pointerId);
        svg.classList.add('panning');
      }
      vb.x = ox - (e.clientX - sx) / r.width * vb.w;
      vb.y = oy - (e.clientY - sy) / r.height * vb.h;
      clamp(); apply();
    });
    svg.addEventListener('pointerup', function() {
      dragging = false;
      svg.classList.remove('panning');
    });
    svg.addEventListener('pointercancel', function() {
      dragging = false;
      moved = false;
      svg.classList.remove('panning');
    });
    return {
      zoom: function(f) {
        var r = svg.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
      },
      reset: function() { vb = { x: base[0], y: base[1], w: base[2], h: base[3] }; apply(); },
      consumeDrag: function() { var m = moved; moved = false; return m; }
    };
  }
  levels.countries.pz = panZoom(mapWorld, [0, 35, 1000, 656]);
  levels.states.pz = panZoom(mapStates, [0, 0, 975, 610]);
  document.getElementById('mz-in').addEventListener('click', function() { activeLevel().pz.zoom(0.7); });
  document.getElementById('mz-out').addEventListener('click', function() { activeLevel().pz.zoom(1.45); });
  document.getElementById('mz-reset').addEventListener('click', function() { activeLevel().pz.reset(); });

  /* ---- hover identification + field notes ---- */
  travelmap.addEventListener('mousemove', function(e) {
    var name = e.target.getAttribute && e.target.getAttribute('data-name');
    if (!name) { mapTip.style.display = 'none'; return; }
    var owner = mapWorld.contains(e.target) ? levels.countries : levels.states;
    var hit = owner.index[name.toLowerCase()];
    var status = !hit ? '<span class="no">uncharted</span>'
      : hit.status === 'planned' ? '<span class="plan">on the itinerary</span>'
      : '<span class="yes">charted' + (hit.entry.year ? ' ' + hit.entry.year : '') + ' \u2713</span>';
    mapTip.innerHTML = name.toLowerCase() + ' \u00b7 ' + status;
    var r = travelmap.getBoundingClientRect();
    mapTip.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + 'px';
    mapTip.style.top = (e.clientY - r.top - 26) + 'px';
    mapTip.style.display = 'block';
  });
  travelmap.addEventListener('mouseleave', function() { mapTip.style.display = 'none'; });

  function showFieldNote(entry) {
    document.getElementById('fn-title').textContent =
      'field note \u00b7 ' + entry.name.toLowerCase() +
      (entry.year ? ' \u00b7 ' + entry.year : '');
    document.getElementById('fn-body').textContent = entry.note;
    fieldNote.hidden = false;
  }

  function noteEntryFor(target) {
    var territory = target && target.closest ? target.closest('.terr[data-name]') : null;
    if (!territory) return null;
    var owner = mapWorld.contains(territory) ? levels.countries
      : mapStates.contains(territory) ? levels.states : null;
    if (!owner) return null;
    var hit = owner.index[territory.getAttribute('data-name').toLowerCase()];
    return hit && hit.entry.note ? hit.entry : null;
  }

  /* Touch browsers do not consistently synthesize click/dblclick for SVG
     paths. Treat a short pointer gesture as a tap and open the note directly. */
  var touchStart = null;
  var suppressMapClickUntil = 0;
  travelmap.addEventListener('pointerdown', function(e) {
    if (e.pointerType === 'mouse') return;
    touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  travelmap.addEventListener('pointerup', function(e) {
    if (e.pointerType === 'mouse' || !touchStart || touchStart.id !== e.pointerId) return;
    var moved = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) > 10;
    touchStart = null;
    suppressMapClickUntil = performance.now() + 500;
    if (moved || activeLevel().pz.consumeDrag()) return;
    var entry = noteEntryFor(e.target);
    if (entry) showFieldNote(entry);
  });
  travelmap.addEventListener('pointercancel', function(e) {
    if (touchStart && touchStart.id === e.pointerId) touchStart = null;
  });

  /* a single click opens the note, but hold it ~220ms so a double-click
     (zoom) can cancel it \u2014 otherwise dbl-clicking a noted state like
     connecticut flashed the note open then zoomed out from under it */
  var noteTimer = null;
  travelmap.addEventListener('click', function(e) {
    clearTimeout(noteTimer);
    if (performance.now() < suppressMapClickUntil) return;
    if (e.detail > 1) return; /* wait for dblclick zoom to finish */
    if (activeLevel().pz.consumeDrag()) return; /* a pan, not a click */
    var entry = noteEntryFor(e.target);
    if (!entry) return;
    noteTimer = setTimeout(function() { showFieldNote(entry); }, 220);
  });
  travelmap.addEventListener('dblclick', function() { clearTimeout(noteTimer); });
  document.getElementById('fn-close').addEventListener('click', function() {
    fieldNote.hidden = true;
  });

  /* ---- digital passages: recent github activity (lazy, keyless API) ---- */
  var digitalFix = document.getElementById('digital-fix');
  var ghLoaded = false;
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min past';
    if (s < 86400) return Math.round(s / 3600) + ' hr past';
    var d = Math.round(s / 86400);
    if (d < 14) return d + ' days past';
    if (d < 60) return Math.round(d / 7) + ' wk past';
    return Math.round(d / 30) + ' mo past';
  }
  function ghDescribe(ev) {
    var repo = (ev.repo && ev.repo.name || '/').split('/')[1] || 'a chart';
    var p = ev.payload || {};
    switch (ev.type) {
      case 'PushEvent':
        var n = p.size || (p.commits && p.commits.length) || 1;
        return 'charted ' + n + ' commit' + (n > 1 ? 's' : '') + ' to ' + repo;
      case 'CreateEvent':
        return (p.ref_type === 'repository' ? 'founded ' : 'hoisted ' + p.ref_type + ' in ') + repo;
      case 'PullRequestEvent': return (p.action || 'opened') + ' a pull request in ' + repo;
      case 'IssuesEvent':      return (p.action || 'opened') + ' an issue in ' + repo;
      case 'IssueCommentEvent':return 'left word on ' + repo;
      case 'WatchEvent':       return 'starred ' + repo;
      case 'ForkEvent':        return 'forked ' + repo;
      case 'ReleaseEvent':     return 'published a release of ' + repo;
      case 'DeleteEvent':      return 'struck ' + p.ref_type + ' from ' + repo;
      default:                 return ev.type.replace('Event', '').toLowerCase() + ' · ' + repo;
    }
  }
  function loadDigital() {
    if (ghLoaded) return;
    ghLoaded = true;
    var rows = document.getElementById('gh-rows');
    var status = document.getElementById('gh-status');
    if (typeof fetch === 'undefined') { status.textContent = 'the wireless is down.'; return; }
    fetch('https://api.github.com/users/TaoTDM/events/public?per_page=8')
      .then(function(r) { if (!r.ok) throw 0; return r.json(); })
      .then(function(events) {
        var seen = {}, list = [];
        events.forEach(function(ev) {
          var d = ghDescribe(ev);
          if (seen[d]) return; seen[d] = 1;
          list.push({ d: d, t: ev.created_at });
        });
        list = list.slice(0, 6);
        if (!list.length) throw 0;
        rows.innerHTML = list.map(function(x) {
          return '<div class="lb-row"><span class="dot c">●</span>' +
            '<span class="nm">' + x.d + '</span><span class="leader"></span>' +
            '<span class="yr">' + ago(x.t) + '</span></div>';
        }).join('');
      })
      .catch(function() {
        status.textContent = 'the wireless is quiet — ';
        var a = document.createElement('a');
        a.href = 'https://github.com/TaoTDM'; a.target = '_blank'; a.rel = 'noreferrer';
        a.textContent = 'visit the harbour directly';
        status.appendChild(a);
      });
  }
  digitalFix.addEventListener('toggle', function() {
    if (digitalFix.open) loadDigital();
  });

  /* ---- easter egg: typing a territory's name flashes it ---- */
  var eggNames = null;
  function travelEgg(buf) {
    if (!eggNames) {
      /* states before countries so 'georgia' prefers the state;
         longest names first so 'south korea' beats hypothetical suffixes */
      eggNames = norm(VISITED_STATES).concat(norm(PLANNED_STATES))
        .map(function(t) { return { n: t.name.toLowerCase(), level: 'states' }; })
        .concat(norm(VISITED_COUNTRIES).concat(norm(PLANNED_COUNTRIES))
          .map(function(t) { return { n: t.name.toLowerCase(), level: 'countries' }; }))
        .sort(function(a, b) { return b.n.length - a.n.length; });
    }
    for (var i = 0; i < eggNames.length; i++) {
      var egg = eggNames[i];
      if (egg.n.length < 4 || buf.slice(-egg.n.length) !== egg.n) continue;
      travelsFix.open = true; /* triggers the lazy build */
      setLevel(egg.level);
      var lvl = activeLevel();
      lvl.pz.reset();
      ensureMap(egg.level).then(function() {
        var el = null;
        lvl.svg.querySelectorAll('.terr').forEach(function(t) {
          if (t.getAttribute('data-name').toLowerCase() === egg.n) el = t;
        });
        if (!el) return;
        travelsFix.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        el.classList.remove('flash');
        void el.getBBox();
        el.classList.add('flash');
        setTimeout(function() { el.classList.remove('flash'); }, 2200);
      });
      return true;
    }
    return false;
  }
  /* ---- command palette · ship's helm ( / or ⌘K ) ---- */
  (function helm() {
    var ov = document.getElementById('helm-overlay');
    var input = document.getElementById('helm-input');
    var listEl = document.getElementById('helm-list');
    var emptyEl = document.getElementById('helm-empty');
    var RESUME = 'https://drive.google.com/file/d/1yYBWq4fe3GDF-m5aIS8u1w9jd3sg-gN8/view?usp=sharing';
    function goTo(id) {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    var cmds = [
      { name: 'about', kind: 'plate', run: function() { goTo('about'); } },
      { name: 'experience', kind: 'plate', run: function() { goTo('experience'); } },
      { name: 'projects', kind: 'plate', run: function() { goTo('projects'); } },
      { name: 'uni', kind: 'plate', run: function() { goTo('uni'); } },
      { name: 'honors', kind: 'plate', run: function() { goTo('honors'); } },
      { name: 'travels', kind: 'plate', run: function() { goTo('travels'); } },
      { name: 'chart of travels', kind: 'chart', run: function() { travelsFix.open = true; goTo('travels'); } },
      { name: 'countries map', kind: 'view', run: function() { travelsFix.open = true; setLevel('countries'); goTo('travels'); } },
      { name: 'us states map', kind: 'view', run: function() { travelsFix.open = true; setLevel('states'); goTo('travels'); } },
      { name: 'toggle night watch', kind: 'helm', run: function() { setWatch(document.documentElement.hasAttribute('data-watch') ? 'day' : 'night'); } },
      { name: 'print the chart', kind: 'helm', run: function() { window.print(); } },
      { name: 'copy email', kind: 'hail', run: copyEmailToClipboard },
      { name: 'open resume', kind: 'hail', run: function() { window.open(RESUME, '_blank', 'noopener'); } },
      { name: 'github', kind: 'hail', run: function() { window.open('https://github.com/TaoTDM', '_blank', 'noopener'); } },
      { name: 'linkedin', kind: 'hail', run: function() { window.open('https://www.linkedin.com/in/shi-tao-chang/', '_blank', 'noopener'); } },
      { name: 'the sextant', kind: '???', run: function() { overlay.classList.add('open'); } }
    ];
    var matches = cmds.slice(), sel = 0;
    function render() {
      var q = input.value.trim().toLowerCase();
      matches = cmds.filter(function(c) { return c.name.indexOf(q) !== -1; });
      if (sel >= matches.length) sel = Math.max(0, matches.length - 1);
      listEl.innerHTML = '';
      matches.forEach(function(c, i) {
        var row = document.createElement('div');
        row.className = 'helm-cmd' + (i === sel ? ' sel' : '');
        row.innerHTML = '<span class="cname">' + c.name + '</span><span class="kind">' + c.kind + '</span>';
        row.addEventListener('mouseenter', function() { sel = i; render(); });
        row.addEventListener('click', function() { runCmd(c); });
        listEl.appendChild(row);
      });
      emptyEl.style.display = matches.length ? 'none' : 'block';
    }
    function openHelm() { input.value = ''; sel = 0; render(); ov.classList.add('open'); input.focus(); }
    function closeHelm() { ov.classList.remove('open'); }
    function runCmd(c) { closeHelm(); c.run(); }
    input.addEventListener('input', function() { sel = 0; render(); });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, matches.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
      else if (e.key === 'Enter' && matches[sel]) { runCmd(matches[sel]); }
      else if (e.key === 'Escape') { closeHelm(); }
    });
    ov.addEventListener('click', function(e) {
      if (!document.getElementById('helm').contains(e.target)) closeHelm();
    });
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ov.classList.contains('open') ? closeHelm() : openHelm();
      } else if (e.key === '/' && !ov.classList.contains('open') &&
                 e.target.tagName !== 'INPUT' && !overlay.classList.contains('open')) {
        e.preventDefault();
        openHelm();
      }
    });
  })();
})();
