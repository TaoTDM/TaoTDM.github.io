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

  /* one canvas and one scheduler show the rain and the dew. */
  var weatherCanvas = document.getElementById('weather-canvas');
  var weatherCtx = weatherCanvas.getContext('2d');
  var rainDrops = [], splashes = [], dewDrops = [];
  var weatherRAF = null, weatherMode = null, lastWeatherFrame = 0;
  var weatherResizeTimer = null, weatherSwapTimer = null, weatherSwapToken = 0;
  var weatherW = 0, weatherH = 0, gust = 0;
  var WEATHER_FRAME_MS = { rain: 0, dew: 42 };

  function makeRainDrop(fromTop) {
    var near = Math.random() < 0.4;
    return {
      x: Math.random() * (weatherW + 60) - 30,
      y: fromTop ? -20 : Math.random() * weatherH,
      len: near ? 15 + Math.random() * 12 : 7 + Math.random() * 8,
      speed: near ? 9 + Math.random() * 6 : 4 + Math.random() * 4,
      alpha: near ? 0.16 + Math.random() * 0.15 : 0.05 + Math.random() * 0.09,
      w: near ? 1.0 : 0.6
    };
  }
  function buildRain() {
    var count = Math.max(45, Math.min(230, Math.round(weatherW * weatherH / 12000)));
    rainDrops = [];
    for (var i = 0; i < count; i++) rainDrops.push(makeRainDrop(false));
  }
  function makeDew() {
    var nearEdge = Math.random() < 0.7;
    var left = Math.random() < 0.5;
    var x = nearEdge
      ? (left ? Math.random() * weatherW * 0.3 : weatherW * (0.7 + Math.random() * 0.3))
      : weatherW * (0.14 + Math.random() * 0.72);
    var radius = 1.5 + Math.random() * 3.2;
    var runner = Math.random() < 0.22;
    return {
      x: x,
      y: weatherH * (0.1 + Math.random() * 0.84),
      rx: radius,
      ry: radius * (1.05 + Math.random() * 0.5),
      alpha: 0.46 + Math.random() * 0.42,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.035 + Math.random() * 0.045,
      drift: (Math.random() - 0.5) * 0.035,
      vy: runner ? 0.15 + Math.random() * 0.24 : 0.012 + Math.random() * 0.035,
      trail: runner ? 5 + Math.random() * 13 : 0
    };
  }
  function buildDew() {
    var count = Math.max(18, Math.min(38, Math.round(weatherW * weatherH / 52000)));
    dewDrops = [];
    for (var i = 0; i < count; i++) dewDrops.push(makeDew());
  }
  function sizeWeather() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    weatherW = window.innerWidth;
    weatherH = window.innerHeight;
    weatherCanvas.width = weatherW * dpr;
    weatherCanvas.height = weatherH * dpr;
    weatherCanvas.style.width = weatherW + 'px';
    weatherCanvas.style.height = weatherH + 'px';
    weatherCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildRain();
    buildDew();
    if (reduced && weatherMode) renderWeather(performance.now(), true);
  }
  function drawRain(still) {
    gust *= 0.96;
    if (!still && Math.random() < 0.004) gust = (Math.random() - 0.3) * 2.4;
    var slant = 0.9 + gust;
    var groundY = weatherH - 18;
    for (var i = 0; i < rainDrops.length; i++) {
      var d = rainDrops[i];
      weatherCtx.strokeStyle = 'rgba(190,212,210,' + d.alpha + ')';
      weatherCtx.lineWidth = d.w;
      weatherCtx.beginPath();
      weatherCtx.moveTo(d.x, d.y);
      weatherCtx.lineTo(d.x - slant * (d.len / d.speed) * 2, d.y - d.len);
      weatherCtx.stroke();
      if (!still) {
        d.y += d.speed;
        d.x += slant * 0.6;
        if (d.w >= 1 && !d.splashed && d.y >= groundY) {
          d.splashed = true;
          if (splashes.length < 60 && Math.random() < 0.85) splashes.push({ x: d.x, r: 0.6, a: 0.45 });
        }
        if (d.y - d.len > weatherH) {
          var next = makeRainDrop(true);
          d.x = next.x; d.y = next.y; d.len = next.len;
          d.speed = next.speed; d.alpha = next.alpha; d.w = next.w;
          d.splashed = false;
        }
      }
    }
    for (var s = splashes.length - 1; s >= 0; s--) {
      var sp = splashes[s];
      if (!still) { sp.r += 0.9; sp.a -= 0.024; }
      if (sp.a <= 0) { splashes.splice(s, 1); continue; }
      weatherCtx.strokeStyle = 'rgba(200,216,214,' + sp.a.toFixed(3) + ')';
      weatherCtx.lineWidth = 0.8;
      weatherCtx.beginPath();
      weatherCtx.ellipse(sp.x, groundY, sp.r, sp.r * 0.42, 0, Math.PI, Math.PI * 2);
      weatherCtx.stroke();
    }
  }
  function drawDew(still) {
    weatherCtx.globalCompositeOperation = 'screen';
    for (var i = 0; i < dewDrops.length; i++) {
      var d = dewDrops[i];
      if (!still) {
        d.phase += d.phaseSpeed;
        d.y += d.vy;
        d.x += d.drift + Math.sin(d.phase) * 0.018;
        if (!d.trail && Math.random() < 0.00035) {
          d.trail = 6 + Math.random() * 12;
          d.vy = 0.15 + Math.random() * 0.24;
          d.ry *= 1.18;
        }
        if (d.y - d.trail > weatherH + 8) {
          var next = makeDew();
          next.y = -next.ry - next.trail;
          dewDrops[i] = d = next;
        }
      }
      var shimmer = d.alpha * (0.72 + Math.sin(d.phase) * 0.28);
      if (d.trail) {
        weatherCtx.strokeStyle = 'rgba(151,180,207,' + (shimmer * 0.20).toFixed(3) + ')';
        weatherCtx.lineWidth = Math.max(0.7, d.rx * 0.45);
        weatherCtx.beginPath();
        weatherCtx.moveTo(d.x, d.y - d.trail);
        weatherCtx.lineTo(d.x, d.y - d.ry * 0.5);
        weatherCtx.stroke();
      }
      weatherCtx.fillStyle = 'rgba(154,188,213,' + (shimmer * 0.19).toFixed(3) + ')';
      weatherCtx.beginPath();
      weatherCtx.ellipse(d.x, d.y, d.rx * 1.45, d.ry * 1.45, 0, 0, Math.PI * 2);
      weatherCtx.fill();
      weatherCtx.strokeStyle = 'rgba(225,237,243,' + (shimmer * 0.62).toFixed(3) + ')';
      weatherCtx.lineWidth = 0.65;
      weatherCtx.beginPath();
      weatherCtx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
      weatherCtx.stroke();
      weatherCtx.fillStyle = 'rgba(255,245,249,' + (shimmer * 0.92).toFixed(3) + ')';
      weatherCtx.beginPath();
      weatherCtx.arc(d.x - d.rx * 0.28, d.y - d.ry * 0.3, Math.max(0.55, d.rx * 0.2), 0, Math.PI * 2);
      weatherCtx.fill();
      weatherCtx.fillStyle = 'rgba(220,155,178,' + (shimmer * 0.34).toFixed(3) + ')';
      weatherCtx.beginPath();
      weatherCtx.arc(d.x + d.rx * 0.2, d.y + d.ry * 0.28, Math.max(0.45, d.rx * 0.15), 0, Math.PI * 2);
      weatherCtx.fill();
    }
    weatherCtx.globalCompositeOperation = 'source-over';
  }
  function renderWeather(now, still) {
    weatherCtx.clearRect(0, 0, weatherW, weatherH);
    if (weatherMode === 'rain') drawRain(still);
    else if (weatherMode === 'dew') drawDew(still);
  }
  function weatherFrame(now) {
    if (!weatherMode) return;
    var interval = WEATHER_FRAME_MS[weatherMode] || 0;
    if (!interval || now - lastWeatherFrame >= interval) {
      lastWeatherFrame = now;
      renderWeather(now, false);
    }
    weatherRAF = requestAnimationFrame(weatherFrame);
  }
  function startWeatherCanvas(mode) {
    if (weatherMode === mode && (weatherRAF || reduced)) return;
    stopWeatherCanvas();
    weatherMode = mode;
    if (reduced) { renderWeather(performance.now(), true); return; }
    weatherRAF = requestAnimationFrame(weatherFrame);
  }
  function stopWeatherCanvas() {
    if (weatherRAF) { cancelAnimationFrame(weatherRAF); weatherRAF = null; }
    weatherMode = null;
    lastWeatherFrame = 0;
    splashes.length = 0;
    weatherCtx.clearRect(0, 0, weatherW, weatherH);
  }
  window.addEventListener('resize', function() {
    clearTimeout(weatherResizeTimer);
    weatherResizeTimer = setTimeout(sizeWeather, 120);
  });
  sizeWeather();

  /* cursor lantern. a warm light moves slowly to the pointer. */
  var root = document.documentElement;
  var lantX = window.innerWidth / 2, lantY = window.innerHeight * 0.26;
  var lantTX = lantX, lantTY = lantY, lantRAF = null;
  function lanternStep() {
    lantX += (lantTX - lantX) * 0.12;
    lantY += (lantTY - lantY) * 0.12;
    root.style.setProperty('--lx', (lantX / window.innerWidth * 100).toFixed(2) + '%');
    root.style.setProperty('--ly', (lantY / window.innerHeight * 100).toFixed(2) + '%');
    if (Math.abs(lantTX - lantX) > 0.4 || Math.abs(lantTY - lantY) > 0.4) {
      lantRAF = requestAnimationFrame(lanternStep);
    } else { lantRAF = null; }
  }
  root.style.setProperty('--lx', '50%');
  root.style.setProperty('--ly', reduced ? '22%' : '26%');
  if (!reduced) {
    window.addEventListener('pointermove', function(e) {
      if (e.pointerType === 'touch') return;
      lantTX = e.clientX; lantTY = e.clientY;
      if (!lantRAF) lantRAF = requestAnimationFrame(lanternStep);
    }, { passive: true });
  }

  /* the scene atmosphere agrees with the image. the rain and the dew use the
     canvas. the dusk fog uses the css layers. */
  var HERO_IMAGES = {
    dawn: '/images/pnw-cascade-dawn-alpenglow-bg.webp',
    dusk: '/images/pnw-coast-dusk-mist-cliff-bg.webp',
    night: '/images/pnw-forest-night-inset-bg.webp'
  };
  var heroLayers = Array.prototype.slice.call(document.querySelectorAll('.hero-bg'));
  var activeHeroLayer = document.querySelector('.hero-bg.is-active') || heroLayers[0];
  var heroSwapToken = 0;
  function swapHeroScene(tod) {
    var token = ++heroSwapToken;
    if (!activeHeroLayer || activeHeroLayer.dataset.scene === tod) return;
    var incoming = heroLayers[0] === activeHeroLayer ? heroLayers[1] : heroLayers[0];
    var image = new Image();
    var revealed = false;
    function reveal() {
      if (revealed || token !== heroSwapToken || !incoming) return;
      revealed = true;
      incoming.dataset.scene = tod;
      requestAnimationFrame(function() {
        if (token !== heroSwapToken) return;
        incoming.classList.add('is-active');
        activeHeroLayer.classList.remove('is-active');
        activeHeroLayer = incoming;
      });
    }
    image.onload = reveal;
    image.onerror = reveal;
    image.src = HERO_IMAGES[tod] || HERO_IMAGES.night;
    if (image.complete) reveal();
  }
  Object.keys(HERO_IMAGES).forEach(function(key) {
    var image = new Image();
    image.src = HERO_IMAGES[key];
  });

  var watch = document.getElementById('watch-toggle');
  var mistOn = true;
  try { if (localStorage.getItem('v5-weather') === 'off') mistOn = false; } catch (e) {}
  var weatherLine = document.getElementById('weather-line');
  var sceneCue = document.getElementById('scene-cue');
  var WEATHER_BY_TOD = {
    dawn: { key: 'dew', icon: '💧', label: 'morning dew', line: 'morning dew', cue: 'cross the cloudline' },
    dusk: { key: 'fog', icon: '🌫️', label: 'coastal fog', line: 'coastal fog', cue: 'enter the mist' },
    night: { key: 'rain', icon: '🌧️', label: 'forest rain', line: 'night rain', cue: 'enter the rain' }
  };

  /* time-of-day. an emoji control with a pill that moves. */
  var TOD_ORDER = ['dawn', 'dusk', 'night'];
  var todGroup = document.querySelector('.tod');
  var todSlider = document.querySelector('.tod-slider');
  var todBtns = Array.prototype.slice.call(document.querySelectorAll('.tod-btn'));
  var currentTod = 'dawn';
  function syncSceneWeather() {
    var weather = WEATHER_BY_TOD[currentTod] || WEATHER_BY_TOD.night;
    var nextCanvasMode = weather.key === 'rain' || weather.key === 'dew' ? weather.key : null;
    root.setAttribute('data-weather', weather.key);
    clearTimeout(weatherSwapTimer);
    var swapToken = ++weatherSwapToken;
    if (!mistOn || document.hidden) {
      weatherCanvas.classList.remove('is-changing');
      stopWeatherCanvas();
    } else if (!nextCanvasMode) {
      if (!reduced && weatherMode) {
        weatherCanvas.classList.add('is-changing');
        weatherSwapTimer = setTimeout(function() {
          if (swapToken !== weatherSwapToken) return;
          stopWeatherCanvas();
          weatherCanvas.classList.remove('is-changing');
        }, 320);
      } else {
        stopWeatherCanvas();
        weatherCanvas.classList.remove('is-changing');
      }
    } else if (!reduced && weatherMode && weatherMode !== nextCanvasMode) {
      weatherCanvas.classList.add('is-changing');
      weatherSwapTimer = setTimeout(function() {
        if (swapToken !== weatherSwapToken) return;
        startWeatherCanvas(nextCanvasMode);
        requestAnimationFrame(function() { weatherCanvas.classList.remove('is-changing'); });
      }, 320);
    } else if (!reduced && !weatherMode) {
      weatherCanvas.classList.add('is-changing');
      startWeatherCanvas(nextCanvasMode);
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { weatherCanvas.classList.remove('is-changing'); });
      });
    } else {
      startWeatherCanvas(nextCanvasMode);
      weatherCanvas.classList.remove('is-changing');
    }
    if (weatherLine) weatherLine.textContent = weather.line;
    if (sceneCue) sceneCue.textContent = weather.cue;
    if (!watch) return;
    watch.textContent = mistOn ? weather.icon : '☀️';
    watch.title = mistOn
      ? weather.label + ' on — click to clear the weather'
      : 'weather cleared — click for ' + weather.label;
    watch.setAttribute('aria-label', 'toggle ' + weather.label);
    watch.setAttribute('aria-pressed', String(mistOn));
  }
  function moveTodSlider(btn) {
    if (!todSlider || !btn) return;
    todSlider.style.width = btn.offsetWidth + 'px';
    todSlider.style.transform = 'translateX(' + (btn.offsetLeft - todSlider.offsetLeft) + 'px)';
    todSlider.style.opacity = '1';
  }
  function setTod(tod, persist) {
    currentTod = tod;
    root.setAttribute('data-tod', tod);
    swapHeroScene(tod);
    var active = null;
    todBtns.forEach(function(b) {
      var on = b.getAttribute('data-tod') === tod;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      if (on) active = b;
    });
    moveTodSlider(active);
    syncSceneWeather();
    if (SCENE_SOUNDS) {
      if (soundOn) syncSceneSound();
      else updateSoundButton();
    }
    if (persist !== false) { try { localStorage.setItem('v4-tod', tod); } catch (e) {} }
  }
  /* start new visitors at dawn. returning visitors keep their last scene. */
  var savedTod = null;
  try { savedTod = localStorage.getItem('v4-tod'); } catch (e) {}
  if (TOD_ORDER.indexOf(savedTod) === -1) setTod('dawn', false);
  else setTod(savedTod);
  /* the fonts and emoji change the button widths after load. set the pill position again. */
  window.addEventListener('load', function() { moveTodSlider(todGroup && todGroup.querySelector('.tod-btn.on')); });
  window.addEventListener('resize', function() { moveTodSlider(todGroup && todGroup.querySelector('.tod-btn.on')); });
  todBtns.forEach(function(b) {
    b.addEventListener('click', function() { setTod(b.getAttribute('data-tod')); });
  });
  /* turn the wheel on the control to change dawn, dusk, or night. */
  if (todGroup) {
    todGroup.addEventListener('wheel', function(e) {
      e.preventDefault();
      var i = TOD_ORDER.indexOf(currentTod);
      i = (i + (e.deltaY > 0 ? 1 : -1) + TOD_ORDER.length) % TOD_ORDER.length;
      setTod(TOD_ORDER[i]);
    }, { passive: false });
  }

  /* weather button. set the dew, fog, or rain to on or off. keep the setting. */
  function setMist(on) {
    mistOn = on;
    if (on) {
      document.documentElement.removeAttribute('data-mist');
    } else {
      document.documentElement.setAttribute('data-mist', 'off');
    }
    syncSceneWeather();
    try { localStorage.setItem('v5-weather', on ? 'on' : 'off'); } catch (e) {}
  }
  setMist(mistOn);
  if (watch) watch.addEventListener('click', function() { setMist(!mistOn); });

  /* sounds for each theme. the two defaults are percentages, kept here so the
     balance is easy to settle after trying it in the browser. */
  var DAWN_SOUND_URL = new URL('./audio/dawn.mp3', import.meta.url).href;
  var DUSK_SOUND_URL = new URL('./audio/dusk.mp3', import.meta.url).href;
  var NIGHT_SOUND_URL = new URL('./audio/night.mp3', import.meta.url).href;
  var DAWN_MUSIC_URL = new URL('./audio/wethands-dawn.mp3', import.meta.url).href;
  var DUSK_MUSIC_URL = new URL('./audio/redswan-dusk.mp3', import.meta.url).href;
  var NIGHT_MUSIC_URL = new URL('./audio/sweden-night.mp3', import.meta.url).href;

  var DEFAULT_MUSIC_VOLUME = 45;
  var DEFAULT_AMBIENCE_VOLUME = 85;

  var SCENE_SOUNDS = {
    dawn: {
      url: DAWN_SOUND_URL, label: 'morning pine air', volume: 1,
      fallback: { noise: 'brown', highpass: 115, lowpass: 1050, gain: 0.07, rate: 0.045, wander: 170 }
    },
    dusk: {
      url: DUSK_SOUND_URL, label: 'fogbound coast', volume: 0.8,
      fallback: { noise: 'brown', highpass: 74, lowpass: 860, gain: 0.06, rate: 0.045, wander: 110 }
    },
    night: {
      url: NIGHT_SOUND_URL, label: 'forest rain', volume: 0.75,
      fallback: { noise: 'pink', highpass: 230, lowpass: 1420, gain: 0.12, rate: 0.065, wander: 150 }
    }
  };

  /* The recordings have different native loudness, so these small per-track
     trims keep the master music slider useful across all three scenes. */
  var SCENE_MUSIC = {
    dawn: { url: DAWN_MUSIC_URL, volume: 0.9 },
    dusk: { url: DUSK_MUSIC_URL, volume: 1 },
    night: { url: NIGHT_MUSIC_URL, volume: 1 }
  };

  var soundBtn = document.getElementById('sound-toggle');
  var audioControl = document.getElementById('audio-control');
  var mixerToggle = document.getElementById('mixer-toggle');
  var mixerPanel = document.getElementById('audio-mixer');
  var musicVolumeInput = document.getElementById('music-volume');
  var ambienceVolumeInput = document.getElementById('ambience-volume');
  var musicVolumeValue = document.getElementById('music-volume-value');
  var ambienceVolumeValue = document.getElementById('ambience-volume-value');
  var soundOn = false;
  var ambientAudio = null;                 /* the custom HTMLAudioElement. */
  var musicAudio = null;
  var audioCtx = null;
  var generatedSource = null, generatedLfo = null, soundGain = null;
  var generatedBaseGain = 0;
  var soundAttempt = 0;
  var musicAttempt = 0;
  var soundState = 'off';
  var musicState = 'off';
  var musicLevel = DEFAULT_MUSIC_VOLUME / 100;
  var ambienceLevel = DEFAULT_AMBIENCE_VOLUME / 100;

  function fadeAudio(el, to, ms, done) {
    var run = (el._fadeRun || 0) + 1;
    el._fadeRun = run;
    var from = el.volume, start = performance.now();
    (function step(now) {
      if (el._fadeRun !== run) return;
      var k = Math.min(1, (now - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    })(performance.now());
  }
  function stopCustomSound(ms) {
    var audio = ambientAudio;
    ambientAudio = null;
    if (!audio) return;
    if (!ms) { audio.pause(); return; }
    fadeAudio(audio, 0, ms, function() { audio.pause(); });
  }
  function stopMusic(ms) {
    var audio = musicAudio;
    musicAudio = null;
    if (!audio) return;
    if (!ms) { audio.pause(); return; }
    fadeAudio(audio, 0, ms, function() { audio.pause(); });
  }
  function stopGeneratedSound(ms) {
    var source = generatedSource;
    var lfo = generatedLfo;
    var gain = soundGain;
    generatedSource = generatedLfo = soundGain = null;
    generatedBaseGain = 0;
    if (!source) return;
    function dispose() {
      try { source.stop(); } catch (e) {}
      try { source.disconnect(); } catch (e) {}
      if (lfo) {
        try { lfo.stop(); } catch (e) {}
        try { lfo.disconnect(); } catch (e) {}
      }
      if (gain) { try { gain.disconnect(); } catch (e) {} }
    }
    if (ms && gain && audioCtx) {
      var t = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
      setTimeout(dispose, ms + 40);
    } else dispose();
  }
  function stopSceneSound(ms) {
    stopCustomSound(ms);
    stopGeneratedSound(ms);
  }
  function buildGeneratedSound(profile) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var len = Math.floor(audioCtx.sampleRate * 2);
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, brown = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      if (profile.noise === 'brown') {
        brown = (brown + white * 0.02) / 1.02;
        data[i] = brown * 3.4;
      } else {
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = profile.highpass;
    var lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = profile.lowpass; lp.Q.value = 0.5;
    soundGain = audioCtx.createGain(); soundGain.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(soundGain); soundGain.connect(audioCtx.destination);

    /* a slow filter change stops the loop sound from becoming flat. */
    var lfo = audioCtx.createOscillator();
    var lfoDepth = audioCtx.createGain();
    lfo.frequency.value = profile.rate;
    lfoDepth.gain.value = profile.wander;
    lfo.connect(lfoDepth); lfoDepth.connect(lp.frequency);
    generatedSource = src;
    generatedLfo = lfo;
    generatedBaseGain = profile.gain;
    src.start();
    lfo.start();
    var t = audioCtx.currentTime;
    soundGain.gain.linearRampToValueAtTime(profile.gain * ambienceLevel, t + 0.8);
    return true;
  }
  function startSceneSound(tod) {
    var scene = SCENE_SOUNDS[tod] || SCENE_SOUNDS.night;
    var attempt = ++soundAttempt;
    stopSceneSound(260);
    if (scene.url) {
      var audio = new Audio(scene.url);
      var failed = false;
      ambientAudio = audio;
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      soundState = 'loading';
      updateSoundButton();

      function useFallback() {
        if (failed || attempt !== soundAttempt || !soundOn) return;
        failed = true;
        audio.pause();
        if (ambientAudio === audio) ambientAudio = null;
        soundState = buildGeneratedSound(scene.fallback) ? 'fallback' : 'error';
        if (soundState === 'error' && musicState === 'error') soundOn = false;
        updateSoundButton();
      }

      audio.addEventListener('error', useFallback, { once: true });
      var play = audio.play();
      if (play && play.then) {
        play.then(function() {
          if (attempt !== soundAttempt || !soundOn) { audio.pause(); return; }
          soundState = 'playing';
          fadeAudio(audio, scene.volume * ambienceLevel, 800);
          updateSoundButton();
        }).catch(useFallback);
      } else {
        soundState = 'playing';
        fadeAudio(audio, scene.volume * ambienceLevel, 800);
      }
      return true;
    }
    var generated = buildGeneratedSound(scene.fallback);
    soundState = generated ? 'fallback' : 'error';
    return generated;
  }
  function startSceneMusic(tod) {
    var scene = SCENE_MUSIC[tod] || SCENE_MUSIC.night;
    var attempt = ++musicAttempt;
    stopMusic(260);
    if (!scene.url) {
      musicState = 'error';
      return false;
    }

    var audio = new Audio(scene.url);
    var failed = false;
    musicAudio = audio;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    musicState = 'loading';
    updateSoundButton();

    function markFailed() {
      if (failed || attempt !== musicAttempt || !soundOn) return;
      failed = true;
      audio.pause();
      if (musicAudio === audio) musicAudio = null;
      musicState = 'error';
      if (soundState === 'error') soundOn = false;
      updateSoundButton();
    }

    audio.addEventListener('error', markFailed, { once: true });
    var play = audio.play();
    if (play && play.then) {
      play.then(function() {
        if (attempt !== musicAttempt || !soundOn) { audio.pause(); return; }
        musicState = 'playing';
        fadeAudio(audio, scene.volume * musicLevel, 800);
        updateSoundButton();
      }).catch(markFailed);
    } else {
      musicState = 'playing';
      fadeAudio(audio, scene.volume * musicLevel, 800);
    }
    return true;
  }
  function updateSoundButton() {
    if (!soundBtn || !SCENE_SOUNDS) return;
    var scene = SCENE_SOUNDS[currentTod] || SCENE_SOUNDS.night;
    var loading = soundState === 'loading' || musicState === 'loading';
    soundBtn.textContent = soundOn ? (loading ? '🔈' : '🔊') : '🔇';
    var stateLabel = loading ? ' — loading'
      : soundState === 'fallback' ? ' — generated fallback'
      : soundOn ? ' — on' : ' — off';
    soundBtn.title = scene.label + ' + music' + stateLabel;
    soundBtn.setAttribute('aria-label', 'toggle scene audio');
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }
  function syncSceneSound() {
    if (soundOn) {
      var ambienceStarted = startSceneSound(currentTod);
      var musicStarted = startSceneMusic(currentTod);
      if (!ambienceStarted && !musicStarted) soundOn = false;
    }
    updateSoundButton();
  }
  function setSound(on) {
    soundOn = on;
    if (on) {
      var ambienceStarted = startSceneSound(currentTod);
      var musicStarted = startSceneMusic(currentTod);
      if (!ambienceStarted && !musicStarted) soundOn = false;
    }
    else if (!on) {
      soundAttempt++;
      musicAttempt++;
      soundState = 'off';
      musicState = 'off';
      stopSceneSound(400);
      stopMusic(400);
    }
    updateSoundButton();
  }
  function sceneAmbienceTarget() {
    var scene = SCENE_SOUNDS[currentTod] || SCENE_SOUNDS.night;
    return scene.volume * ambienceLevel;
  }
  function sceneMusicTarget() {
    var scene = SCENE_MUSIC[currentTod] || SCENE_MUSIC.night;
    return scene.volume * musicLevel;
  }
  function updateMixerLabel() {
    if (musicVolumeValue) musicVolumeValue.textContent = Math.round(musicLevel * 100) + '%';
    if (ambienceVolumeValue) ambienceVolumeValue.textContent = Math.round(ambienceLevel * 100) + '%';
    if (musicVolumeInput) musicVolumeInput.style.setProperty('--level', Math.round(musicLevel * 100) + '%');
    if (ambienceVolumeInput) ambienceVolumeInput.style.setProperty('--level', Math.round(ambienceLevel * 100) + '%');
    if (mixerToggle) {
      mixerToggle.title = 'audio levels — music ' + Math.round(musicLevel * 100)
        + '% · ambience ' + Math.round(ambienceLevel * 100) + '%';
    }
  }
  function setMusicLevel(value) {
    musicLevel = Math.max(0, Math.min(1, Number(value) / 100));
    if (musicAudio) fadeAudio(musicAudio, sceneMusicTarget(), 90);
    updateMixerLabel();
  }
  function setAmbienceLevel(value) {
    ambienceLevel = Math.max(0, Math.min(1, Number(value) / 100));
    if (ambientAudio) fadeAudio(ambientAudio, sceneAmbienceTarget(), 90);
    if (soundGain && audioCtx) {
      var t = audioCtx.currentTime;
      soundGain.gain.cancelScheduledValues(t);
      soundGain.gain.setTargetAtTime(generatedBaseGain * ambienceLevel, t, 0.03);
    }
    updateMixerLabel();
  }
  function setMixerOpen(on) {
    if (!mixerToggle || !mixerPanel) return;
    mixerPanel.hidden = !on;
    mixerToggle.setAttribute('aria-expanded', String(on));
  }
  if (soundBtn) soundBtn.addEventListener('click', function() { setSound(!soundOn); });
  if (musicVolumeInput) {
    musicVolumeInput.value = DEFAULT_MUSIC_VOLUME;
    musicVolumeInput.addEventListener('input', function() { setMusicLevel(this.value); });
  }
  if (ambienceVolumeInput) {
    ambienceVolumeInput.value = DEFAULT_AMBIENCE_VOLUME;
    ambienceVolumeInput.addEventListener('input', function() { setAmbienceLevel(this.value); });
  }
  if (mixerToggle) {
    mixerToggle.addEventListener('click', function() {
      setMixerOpen(mixerToggle.getAttribute('aria-expanded') !== 'true');
    });
  }
  document.addEventListener('click', function(e) {
    if (audioControl && !audioControl.contains(e.target)) setMixerOpen(false);
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') setMixerOpen(false);
  });
  updateMixerLabel();
  updateSoundButton();

  /* email. copy it and show a toast. */
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

  /* show the sections when you scroll. */
  var revealer = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealer.unobserve(en.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(function(el) { revealer.observe(el); });

  /* scroll-spy. highlight the rail entry that is in view. */
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.spy a'));
  if (spyLinks.length) {
    var spyMap = {};
    spyLinks.forEach(function(a) { spyMap[a.getAttribute('data-spy')] = a; });
    var spyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (!en.isIntersecting) return;
        spyLinks.forEach(function(a) { a.classList.remove('on'); });
        var a = spyMap[en.target.id];
        if (a) a.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    ['about', 'experience', 'projects', 'uni', 'honors', 'travels'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) spyObserver.observe(el);
    });
  }

  /* only the scene needs the visibility update. the status bar is removed. it
     does not start a clock or get the remote weather. */
  document.addEventListener('visibilitychange', syncSceneWeather);

  /* keep the accordions open in the dom, so the content always prints. the
     [data-x] attribute and css hide the closed content. open only one per
     plate. open them here before the travels and github listeners attach. then
     their loads start only from the clicks below. */
  document.querySelectorAll('details.fix').forEach(function(d) { d.open = true; });
  function expandFix(details) {
    var body = details.closest('.plate-body');
    if (body) body.querySelectorAll('details.fix[data-x]').forEach(function(d) {
      if (d !== details) d.removeAttribute('data-x');       /* only one open per plate. */
    });
    details.setAttribute('data-x', '');
    var log = details.querySelector('.log');                 /* play the surface animation again. */
    if (log) { log.style.animation = 'none'; void log.offsetWidth; log.style.animation = ''; }
    if (details.id === 'travels-fix') ensureMap(currentLevel);   /* load on demand. */
    else if (details.id === 'digital-fix') loadDigital();
  }
  document.querySelectorAll('details.fix > summary').forEach(function(summary) {
    summary.addEventListener('click', function(e) {
      e.preventDefault();                     /* stop the default toggle. this code controls the collapse. */
      var details = summary.parentNode;
      if (details.hasAttribute('data-x')) details.removeAttribute('data-x');
      else expandFix(details);
    });
  });

  /* easter egg. when you type a place name, the map shows it quickly. */
  var buffer = '';
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1) {
      buffer = (buffer + e.key.toLowerCase()).slice(-32);
      if (travelEgg(buffer)) buffer = '';
    }
  });

  /* plate vi. the travel map and the field notes. */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var travelsFix = document.getElementById('travels-fix');
  var travelmap = document.querySelector('.travelmap');
  var mapWorld = document.getElementById('map-world');
  var mapStates = document.getElementById('map-states');
  var mapTip = document.getElementById('map-tip');
  var fieldNote = document.getElementById('field-note');

  /* change each entry to an object, for example 'Taiwan' to {name:'Taiwan'}. index them by name. */
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

  /* vite splits the map geometry into two chunks. load them on demand. */
  function addHatch(svg) {
    svg.style.setProperty('--planned-fill', 'url(#hatch-' + svg.id + ')');
    var defs = svgEl('defs', {});
    var pat = svgEl('pattern', {
      id: 'hatch-' + svg.id, width: 5, height: 5,
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
    });
    var line = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 5, 'stroke-width': 1 });
    line.style.stroke = 'color-mix(in srgb, var(--water) 45%, transparent)';
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
    /* show the marked territories one by one. */
    marked.forEach(function(m, i) {
      if (reduced) m.el.classList.add(m.status);
      else setTimeout(function() { m.el.classList.add(m.status); }, 250 + i * 140);
    });
  }

  /* the home marker is in a group. the group scales against the zoom, so the
     marker keeps a constant size on the screen. */
  function drawHome(svg, xy) {
    if (!xy) return;
    var g = svgEl('g', {
      'class': 'home-mark',
      'data-x': xy[0], 'data-y': xy[1],
      transform: 'translate(' + xy[0] + ',' + xy[1] + ')'
    });
    /* a star with five points. */
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

  /* the countries and us states button. */
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
    /* use view transitions only on the desktop. some mobile engines record the
       old hidden svg and show an empty swap. */
    if (!reduced && !coarsePointer && document.startViewTransition) document.startViewTransition(apply);
    else apply();
    ensureMap(name);
  }
  ttCountries.addEventListener('click', function() { setLevel('countries'); });
  ttStates.addEventListener('click', function() { setLevel('states'); });

  /* zoom and pan with the wheel, a drag, or the buttons. this uses the viewBox. */
  function panZoom(svg, base) {
    var vb = { x: base[0], y: base[1], w: base[2], h: base[3] };
    var dragging = false, moved = false, sx, sy, ox, oy;
    function apply() {
      svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
      svg.classList.toggle('zoomed', vb.w < base[2] - 0.5);
      /* scale the home marker against the zoom to keep a constant size. */
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
      if (!svg.classList.contains('zoomed')) return; /* pan only when the map is zoomed. */
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

  /* hover identification and field notes. */
  travelmap.addEventListener('mousemove', function(e) {
    var name = e.target.getAttribute && e.target.getAttribute('data-name');
    if (!name) { mapTip.style.display = 'none'; return; }
    var owner = mapWorld.contains(e.target) ? levels.countries : levels.states;
    var hit = owner.index[name.toLowerCase()];
    var status = !hit ? '<span class="no">not visited</span>'
      : hit.status === 'planned' ? '<span class="plan">planned</span>'
      : '<span class="yes">visited' + (hit.entry.year ? ' ' + hit.entry.year : '') + ' \u2713</span>';
    mapTip.innerHTML = name.toLowerCase() + ' \u00b7 ' + status;
    var r = travelmap.getBoundingClientRect();
    mapTip.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + 'px';
    mapTip.style.top = (e.clientY - r.top - 26) + 'px';
    mapTip.style.display = 'block';
  });
  travelmap.addEventListener('mouseleave', function() { mapTip.style.display = 'none'; });

  function showFieldNote(entry) {
    document.getElementById('fn-title').textContent =
      'note \u00b7 ' + entry.name.toLowerCase() +
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

  /* touch browsers do not always make a click or a double-click for svg paths.
     use a short pointer gesture as a tap and open the note. */
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

  /* a single click opens the note. delay it about 220 ms, so a double-click
     (zoom) can stop it first. */
  var noteTimer = null;
  travelmap.addEventListener('click', function(e) {
    clearTimeout(noteTimer);
    if (performance.now() < suppressMapClickUntil) return;
    if (e.detail > 1) return; /* wait for the double-click zoom to complete. */
    if (activeLevel().pz.consumeDrag()) return; /* this is a pan, not a click. */
    var entry = noteEntryFor(e.target);
    if (!entry) return;
    noteTimer = setTimeout(function() { showFieldNote(entry); }, 220);
  });
  travelmap.addEventListener('dblclick', function() { clearTimeout(noteTimer); });
  document.getElementById('fn-close').addEventListener('click', function() {
    fieldNote.hidden = true;
  });

  /* github activity. load on demand with a keyless api. */
  var digitalFix = document.getElementById('digital-fix');
  var ghLoaded = false;
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' hr ago';
    var d = Math.round(s / 86400);
    if (d < 14) return d + ' days ago';
    if (d < 60) return Math.round(d / 7) + ' wk ago';
    return Math.round(d / 30) + ' mo ago';
  }
  function ghDescribe(ev) {
    var repo = (ev.repo && ev.repo.name || '/').split('/')[1] || 'a repo';
    var p = ev.payload || {};
    switch (ev.type) {
      case 'PushEvent':
        var n = p.size || (p.commits && p.commits.length) || 1;
        return 'pushed ' + n + ' commit' + (n > 1 ? 's' : '') + ' to ' + repo;
      case 'CreateEvent':
        return (p.ref_type === 'repository' ? 'created ' : 'created ' + p.ref_type + ' in ') + repo;
      case 'PullRequestEvent': return (p.action || 'opened') + ' a pull request in ' + repo;
      case 'IssuesEvent':      return (p.action || 'opened') + ' an issue in ' + repo;
      case 'IssueCommentEvent':return 'commented on ' + repo;
      case 'WatchEvent':       return 'starred ' + repo;
      case 'ForkEvent':        return 'forked ' + repo;
      case 'ReleaseEvent':     return 'released ' + repo;
      case 'DeleteEvent':      return 'deleted ' + p.ref_type + ' from ' + repo;
      default:                 return ev.type.replace('Event', '').toLowerCase() + ' · ' + repo;
    }
  }
  function loadDigital() {
    if (ghLoaded) return;
    ghLoaded = true;
    var rows = document.getElementById('gh-rows');
    var status = document.getElementById('gh-status');
    if (typeof fetch === 'undefined') { status.textContent = 'github is unreachable.'; return; }
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
        status.textContent = 'nothing recent — ';
        var a = document.createElement('a');
        a.href = 'https://github.com/TaoTDM'; a.target = '_blank'; a.rel = 'noreferrer';
        a.textContent = 'visit github directly';
        status.appendChild(a);
      });
  }
  digitalFix.addEventListener('toggle', function() {
    if (digitalFix.open) loadDigital();
  });

  /* easter egg. when you type a territory name, the map shows it quickly. */
  var eggNames = null;
  function travelEgg(buf) {
    if (!eggNames) {
      /* put the states before the countries, so 'georgia' selects the state.
         put the longest names first, so 'south korea' wins against shorter names. */
      eggNames = norm(VISITED_STATES).concat(norm(PLANNED_STATES))
        .map(function(t) { return { n: t.name.toLowerCase(), level: 'states' }; })
        .concat(norm(VISITED_COUNTRIES).concat(norm(PLANNED_COUNTRIES))
          .map(function(t) { return { n: t.name.toLowerCase(), level: 'countries' }; }))
        .sort(function(a, b) { return b.n.length - a.n.length; });
    }
    for (var i = 0; i < eggNames.length; i++) {
      var egg = eggNames[i];
      if (egg.n.length < 4 || buf.slice(-egg.n.length) !== egg.n) continue;
      expandFix(travelsFix); /* expand and start the load. */
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
  /* command palette. open it with the / key or cmd+k. */
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
      { name: 'back to top', aliases: 'home masthead', kind: 'navigate', run: function() { goTo('top'); } },
      { name: 'about', kind: 'section', run: function() { goTo('about'); } },
      { name: 'experience', kind: 'section', run: function() { goTo('experience'); } },
      { name: 'projects', kind: 'section', run: function() { goTo('projects'); } },
      { name: 'uni', kind: 'section', run: function() { goTo('uni'); } },
      { name: 'honors', kind: 'section', run: function() { goTo('honors'); } },
      { name: 'travels', kind: 'section', run: function() { expandFix(travelsFix); goTo('travels'); } },
      { name: 'digital passages', aliases: 'github activity recent', kind: 'section', run: function() { expandFix(digitalFix); goTo('travels'); } },
      { name: 'theme: dawn', aliases: 'morning sunrise pink', kind: 'scene', run: function() { setTod('dawn'); } },
      { name: 'theme: dusk', aliases: 'evening coast fog purple', kind: 'scene', run: function() { setTod('dusk'); } },
      { name: 'theme: night', aliases: 'dark forest rain', kind: 'scene', run: function() { setTod('night'); } },
      { name: 'next theme', aliases: 'cycle scene', kind: 'scene', run: function() {
        var i = (TOD_ORDER.indexOf(currentTod) + 1) % TOD_ORDER.length;
        setTod(TOD_ORDER[i]);
      } },
      { name: 'countries map', aliases: 'world international', kind: 'map', run: function() { expandFix(travelsFix); setLevel('countries'); goTo('travels'); } },
      { name: 'us states map', aliases: 'america united states', kind: 'map', run: function() { expandFix(travelsFix); setLevel('states'); goTo('travels'); } },
      { name: 'reset map view', aliases: 'map home zoom', kind: 'map', run: function() {
        expandFix(travelsFix);
        ensureMap(currentLevel).then(function() { if (activeLevel().pz) activeLevel().pz.reset(); });
        goTo('travels');
      } },
      { name: 'toggle weather', aliases: 'mist rain dew', kind: 'weather', run: function() { setMist(!mistOn); } },
      { name: 'show weather', aliases: 'enable rain fog dew', kind: 'weather', run: function() { if (!mistOn) setMist(true); } },
      { name: 'clear weather', aliases: 'disable atmosphere', kind: 'weather', run: function() { if (mistOn) setMist(false); } },
      { name: 'toggle audio', aliases: 'sound ambience music', kind: 'sound', run: function() { setSound(!soundOn); } },
      { name: 'sound on', aliases: 'play music ambience audio', kind: 'sound', run: function() { if (!soundOn) setSound(true); } },
      { name: 'mute sound', aliases: 'sound off silence', kind: 'sound', run: function() { if (soundOn) setSound(false); } },
      { name: 'close field note', aliases: 'dismiss map note', kind: 'map', run: function() { fieldNote.hidden = true; } },
      { name: 'print', aliases: 'paper pdf', kind: 'utility', run: function() { window.print(); } },
      { name: 'copy email', aliases: 'mail contact', kind: 'link', run: copyEmailToClipboard },
      { name: 'open resume', aliases: 'cv curriculum vitae', kind: 'link', run: function() { window.open(RESUME, '_blank', 'noopener'); } },
      { name: 'github', aliases: 'code repositories', kind: 'link', run: function() { window.open('https://github.com/TaoTDM', '_blank', 'noopener'); } },
      { name: 'linkedin', aliases: 'professional profile', kind: 'link', run: function() { window.open('https://www.linkedin.com/in/shi-tao-chang/', '_blank', 'noopener'); } }
    ];
    var matches = cmds.slice(), sel = 0;
    function render() {
      var q = input.value.trim().toLowerCase();
      matches = cmds.filter(function(c) {
        return (c.name + ' ' + (c.aliases || '')).indexOf(q) !== -1;
      });
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
                 e.target.tagName !== 'INPUT') {
        e.preventDefault();
        openHelm();
      }
    });
  })();
})();
