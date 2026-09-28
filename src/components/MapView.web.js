import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, toneColor } from '../theme/colors';
import { COCHABAMBA_REGION, Legend } from './MapCommon';

export { COCHABAMBA_REGION };

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dotIcon(color, size) {
  size = size || 16;
  return L.divIcon({
    className: '',
    html:
      '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
      'background:' + color + ';border:2px solid #FFFFFF;' +
      'box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const SELECTED_ICON = L.divIcon({
  className: '',
  html: '<div style="font-size:28px;line-height:28px;">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

const COCHABAMBA = { lat: -17.3895, lng: -66.1568 };

function reportPopup(r) {
  return (
    '<div style="font-size:13px;line-height:1.4">' +
    '<b>' +
    escHtml(r.title) +
    '</b>' +
    (r.category
      ? '<div style="color:#526D79">' +
        escHtml(r.category) +
        ' · ' +
        escHtml(r.status) +
        '</div>'
      : '') +
    (r.place
      ? '<div style="color:#526D79">📍 ' + escHtml(r.place) + '</div>'
      : '') +
    (r.time
      ? '<div style="color:#526D79">🕒 ' + escHtml(r.time) + '</div>'
      : '') +
    '</div>'
  );
}

// Mapa real (Leaflet + OpenStreetMap) en el navegador. Las posiciones del
// clic/marcador son exactas (Leaflet convierte el clic a lat/lng).
export default function CityMap({ reports, onSelect, selectedCoords, height }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const reportLayerRef = useRef(null);
  const selectedRef = useRef(null);
  const skipInjectRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  // Inicializa Leaflet una sola vez sobre el nodo DOM del View.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { attributionControl: false }).setView(
      [COCHABAMBA.lat, COCHABAMBA.lng],
      13
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '',
    }).addTo(map);
    map.on('click', (e) => {
      if (onSelectRef.current) {
        placeSelected(map, e.latlng.lat, e.latlng.lng);
        onSelectRef.current({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      }
    });
    mapRef.current = map;
    setReady(true);
    // Leaflet debe recalcular su tamaño una vez que el contenedor ya tiene
    // dimensiones, si no los tiles pueden quedar fuera de lugar.
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Pines de los reportes existentes: al tocarlos muestran la información.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (reportLayerRef.current) reportLayerRef.current.clearLayers();
    const layer = L.layerGroup();
    (reports || [])
      .filter((r) => r.lat != null && r.lng != null)
      .forEach((r) => {
        const m = L.marker([r.lat, r.lng], {
          icon: dotIcon(toneColor[r.tone] ?? colors.primary),
        });
        m.bindPopup(reportPopup(r), { maxWidth: 230 });
        layer.addLayer(m);
      });
    layer.addTo(map);
    reportLayerRef.current = layer;
    return () => {
      map.removeLayer(layer);
      reportLayerRef.current = null;
    };
  }, [reports, ready]);

  // Coloca o desplaza el marcador sin perder el zoom actual del mapa.
  const placeSelected = (map, lat, lng) => {
    if (selectedRef.current) {
      selectedRef.current.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], {
        icon: SELECTED_ICON,
        draggable: !!onSelectRef.current,
      });
      if (onSelectRef.current) {
        m.on('dragend', (e) => {
          const c = e.target.getLatLng();
          skipInjectRef.current = true;
          onSelectRef.current?.({ latitude: c.lat, longitude: c.lng });
        });
      }
      m.addTo(map);
      selectedRef.current = m;
    }
    map.panTo([lat, lng]);
  };

  // Marcador seleccionado (rojo/📍) + centrado conservando el zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (skipInjectRef.current) {
      // El cambio vino de arrastrar el marcador; ya está en su lugar.
      skipInjectRef.current = false;
      return;
    }
    if (!selectedCoords) {
      if (selectedRef.current) {
        map.removeLayer(selectedRef.current);
        selectedRef.current = null;
      }
      return;
    }
    placeSelected(map, selectedCoords.latitude, selectedCoords.longitude);
  }, [selectedCoords?.latitude, selectedCoords?.longitude, ready]);

  return (
    <View
      style={[
        styles.wrap,
        { height: height ?? 420, borderRadius: 16, overflow: 'hidden' },
      ]}
    >
      <View ref={containerRef} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.attr}>
        <Text style={styles.attrText}>© OpenStreetMap</Text>
      </View>
      {onSelect ? (
        <View style={styles.selectHint}>
          <Text style={styles.selectHintText}>
            Toca el mapa para marcar la ubicación de la incidencia
          </Text>
        </View>
      ) : (
        <View style={styles.legendWrap}>
          <Legend />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.hero,
  },
  selectHint: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 64,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectHintText: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    zIndex: 1000,
  },
  legendWrap: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    zIndex: 1000,
  },
  attr: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    zIndex: 1000,
  },
  attrText: {
    fontSize: 9,
    color: 'rgba(18,54,83,0.65)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});