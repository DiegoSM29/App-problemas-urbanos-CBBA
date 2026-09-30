// Mapa compartido (Leaflet + OpenStreetMap) que se inyecta en una WebView
// en Android/iOS. No usa Google Maps ni requiere API key, por lo que
// funciona en Expo Go, dev builds y producción.
//
// - Los pines muestran la información de cada incidencia al tocarlos.
// - Sin enlaces de atribución en pantalla (los inline se dibujan en RN).
// - El mapa está acotado a Cochabamba: no se puede desplazar hacia otro
//   departamento ni otro país, y un punto fuera del límite se rechaza.
import { colors, toneColor } from '../theme/colors';
import {
  COCHABAMBA_CENTER,
  COCHABAMBA_BOUNDS,
  LEAFLET_MAX_BOUNDS,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  isInsideCochabamba,
} from '../lib/region';

const LF_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LF_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// JSON.stringify no escapa "<", lo cual puede romper el bloque <script>
// si algún texto contiene "</script>". Lo escapamos a \u003c.
export function escapeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildMapHtml(reports = [], selectedCoords = null) {
  const pins = (reports || [])
    .filter((r) => r.lat != null && r.lng != null)
    // Un pin fuera del área que atiende el municipio no se dibuja: con el
    // mapa acotado quedaría en un trozo al que ya no se puede llegar.
    .filter((r) => isInsideCochabamba(r.lat, r.lng))
    .map((r) => ({
      lat: r.lat,
      lng: r.lng,
      title: r.title ?? '',
      place: r.place ?? '',
      category: r.category ?? '',
      status: r.status ?? '',
      time: r.time ?? '',
      color: toneColor[r.tone] ?? colors.primary,
    }));

  const initial =
    selectedCoords &&
    isInsideCochabamba(selectedCoords.latitude, selectedCoords.longitude)
      ? [selectedCoords.latitude, selectedCoords.longitude]
      : null;

  // El límite viaja dentro del HTML: el mapa de la WebView corre en un
  // contexto aparte y no puede importar nada de este archivo.
  const config = {
    center: [COCHABAMBA_CENTER.latitude, COCHABAMBA_CENTER.longitude],
    zoom: DEFAULT_ZOOM,
    maxBounds: LEAFLET_MAX_BOUNDS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    south: COCHABAMBA_BOUNDS.south,
    west: COCHABAMBA_BOUNDS.west,
    north: COCHABAMBA_BOUNDS.north,
    east: COCHABAMBA_BOUNDS.east,
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="${LF_CSS}"/>
<script src="${LF_JS}"></script>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
  .leaflet-container { background: #DDF1FA; font-family: system-ui, sans-serif; }
  .inc-pop { font-size: 13px; line-height: 1.4; }
  .inc-pop .t { font-weight: 700; color: #123653; }
  .inc-pop .m { color: #526D79; }
  .leaflet-popup-content-wrapper { border-radius: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var reports = __REPORTS__;
  var initial = __INITIAL_SELECTED__;
  var cfg = __CONFIG__;

  // Mismo criterio que src/lib/region.js: un punto vale si cae dentro del
  // rectángulo de Cochabamba.
  function inside(lat, lng) {
    return lat >= cfg.south && lat <= cfg.north
      && lng >= cfg.west && lng <= cfg.east;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // maxBounds + maxBoundsViscosity acotan la vista a Cochabamba: el mapa no
  // se deja arrastrar hacia otro departamento ni hacia otro país.
  var map = L.map('map', {
    attributionControl: false,
    maxBounds: cfg.maxBounds,
    maxBoundsViscosity: 1,
    minZoom: cfg.minZoom,
    maxZoom: cfg.maxZoom
  }).setView(cfg.center, cfg.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: cfg.maxZoom,
    attribution: ''
  }).addTo(map);

  function dotIcon(color, size) {
    size = size || 16;
    return L.divIcon({
      className: '',
      html:
        '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
        'background:' + color + ';border:2px solid #FFFFFF;' +
        'box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  function selectedIcon() {
    return L.divIcon({
      className: '',
      html: '<div style="font-size:28px;line-height:28px;">📍</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 26]
    });
  }

  (reports || []).forEach(function (r) {
    var pop =
      '<div class="inc-pop">' +
      '<div class="t">' + esc(r.title) + '</div>' +
      (r.category ? '<div class="m">' + esc(r.category) + ' · ' + esc(r.status) + '</div>' : '') +
      (r.place ? '<div class="m">📍 ' + esc(r.place) + '</div>' : '') +
      (r.time ? '<div class="m">🕒 ' + esc(r.time) + '</div>' : '') +
      '</div>';
    var m = L.marker([r.lat, r.lng], { icon: dotIcon(r.color) });
    m.bindPopup(pop, { maxWidth: 230 });
    m.addTo(map);
  });

  var selectedMarker = null;
  // Último punto aceptado, para devolver el marcador ahí si se arrastra
  // fuera de la ciudad.
  var lastValid = null;

  function sendSelect(lat, lng, fromDrag) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'select', lat: lat, lng: lng, fromDrag: !!fromDrag })
      );
    }
  }

  // Avisa de un intento de marcar fuera de Cochabamba. La app lo muestra como
  // error; aquí no se dibuja nada.
  function sendOutOfBounds(lat, lng) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'out-of-bounds', lat: lat, lng: lng })
      );
    }
  }

  window.setSelected = function (lat, lng) {
    lastValid = [lat, lng];
    if (selectedMarker) {
      selectedMarker.setLatLng([lat, lng]);
    } else {
      selectedMarker = L.marker([lat, lng], {
        icon: selectedIcon(),
        draggable: true
      });
      selectedMarker.on('dragend', function (e) {
        var c = e.target.getLatLng();
        if (!inside(c.lat, c.lng)) {
          if (lastValid) selectedMarker.setLatLng([lastValid[0], lastValid[1]]);
          sendOutOfBounds(c.lat, c.lng);
          return;
        }
        lastValid = [c.lat, c.lng];
        sendSelect(c.lat, c.lng, true);
      });
      selectedMarker.addTo(map);
    }
    // Solo centra en el punto; conserva el nivel de zoom actual para que
    // el usuario no tenga que volver a acercar el mapa tras marcar.
    map.panTo([lat, lng]);
  };

  window.clearSelected = function () {
    if (selectedMarker) {
      map.removeLayer(selectedMarker);
      selectedMarker = null;
    }
    lastValid = null;
  };

  map.on('click', function (e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;
    if (!inside(lat, lng)) {
      sendOutOfBounds(lat, lng);
      return;
    }
    // Dibuja el marcador al instante y avisa a la app.
    window.setSelected(lat, lng);
    sendSelect(lat, lng, false);
  });

  if (initial) {
    window.setSelected(initial[0], initial[1]);
  }
})();
</script>
</body>
</html>`
    .replace('__REPORTS__', escapeForScript(pins))
    .replace('__INITIAL_SELECTED__', escapeForScript(initial))
    .replace('__CONFIG__', escapeForScript(config));
}