// Mapa compartido (Leaflet + OpenStreetMap) que se inyecta en una WebView
// en Android/iOS. No usa Google Maps ni requiere API key, por lo que
// funciona en Expo Go, dev builds y producción.
//
// - Los pines muestran la información de cada incidencia al tocarlos.
// - Sin enlaces de atribución en pantalla (los inline se dibujan en RN).
import { colors, toneColor } from '../theme/colors';

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

  const initial = selectedCoords
    ? [selectedCoords.latitude, selectedCoords.longitude]
    : null;

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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var map = L.map('map', { attributionControl: false }).setView([-17.3895, -66.1568], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
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

  function sendSelect(lat, lng, fromDrag) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'select', lat: lat, lng: lng, fromDrag: !!fromDrag })
      );
    }
  }

  window.setSelected = function (lat, lng) {
    if (selectedMarker) {
      selectedMarker.setLatLng([lat, lng]);
    } else {
      selectedMarker = L.marker([lat, lng], {
        icon: selectedIcon(),
        draggable: true
      });
      selectedMarker.on('dragend', function (e) {
        var c = e.target.getLatLng();
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
  };

  map.on('click', function (e) {
    // Dibuja el marcador al instante y avisa a la app.
    window.setSelected(e.latlng.lat, e.latlng.lng);
    sendSelect(e.latlng.lat, e.latlng.lng, false);
  });

  if (initial) {
    window.setSelected(initial[0], initial[1]);
  }
})();
</script>
</body>
</html>`
    .replace('__REPORTS__', escapeForScript(pins))
    .replace('__INITIAL_SELECTED__', escapeForScript(initial));
}