import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import { COCHABAMBA_REGION, Legend } from './MapCommon';
import { buildMapHtml } from './mapHtml';

export { COCHABAMBA_REGION };

// Mapa real (OpenStreetMap via Leaflet en una WebView). Funciona en
// Expo Go, dev builds y producción sin necesidad de Google Maps ni API key.
export default function CityMap({
  reports,
  onSelect,
  selectedCoords,
  onOutOfBounds,
  height,
}) {
  const webRef = useRef(null);
  const skipInjectRef = useRef(false);
  const allowInitialNavRef = useRef(true);
  const hayPines = (reports ?? []).length > 0;

  // Solo se reconstruye cuando cambian los reportes (recarga la WebView).
  const html = useMemo(() => buildMapHtml(reports, []), [reports]);

  // Al cargar la página, reposiciona el marcador si ya hay uno elegido.
  const injectSelection = (coords) => {
    webRef.current?.injectJavaScript(
      `window.setSelected(${coords.latitude}, ${coords.longitude}); true;`
    );
  };

  useEffect(() => {
    if (!selectedCoords) {
      webRef.current?.injectJavaScript('window.clearSelected(); true;');
      return;
    }
    if (skipInjectRef.current) {
      // El cambio vino de arrastrar el marcador; no lo recreamos.
      skipInjectRef.current = false;
      return;
    }
    if (webRef.current) injectSelection(selectedCoords);
  }, [selectedCoords?.latitude, selectedCoords?.longitude]);

  const onMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      // El mapa de la WebView detectó un punto fuera de Cochabamba. Se
      // traspasa tal cual para que el formulario lo muestre como error.
      if (data?.type === 'out-of-bounds' && typeof data.lat === 'number') {
        onOutOfBounds?.(data.lat, data.lng);
        return;
      }
      if (!onSelect) return;
      if (data?.type === 'select' && typeof data.lat === 'number') {
        if (data.fromDrag) skipInjectRef.current = true;
        onSelect({ latitude: data.lat, longitude: data.lng });
      }
    } catch {
      // mensaje no parseable: ignorar
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        { height: height ?? 420, borderRadius: 16, overflow: 'hidden' },
      ]}
    >
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        // Evita que el mapa se pierda navegando: solo se permite la carga
        // inicial; cualquier enlace interno queda bloqueado.
        onShouldStartLoadWithRequest={(req) => {
          const url = req?.url ?? '';
          if (
            allowInitialNavRef.current &&
            (url === 'about:blank' || url.startsWith('data:'))
          ) {
            allowInitialNavRef.current = false;
            return true;
          }
          return false;
        }}
        onMessage={onMessage}
        onLoadEnd={() => {
          if (selectedCoords) injectSelection(selectedCoords);
        }}
      />
      <View pointerEvents="none" style={styles.attr}>
        <Text style={styles.attrText}>© OpenStreetMap</Text>
      </View>
      {/*
        El aviso de "toca el mapa" y la leyenda de colores se pisan si se
        muestran los dos abajo. En el mapa del formulario, que además dibuja
        las incidencias que ya están registradas, la leyenda sube arriba: es
        la que dice qué color tiene cada estado.
      */}
      {onSelect && hayPines && (
        <View style={styles.legendTop}>
          <Legend />
        </View>
      )}
      {onSelect ? (
        <View style={styles.selectHint}>
          <Text style={styles.selectHintText}>
            Toca el mapa para marcar el punto dentro de Cochabamba
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
  },
  legendWrap: {
    position: 'absolute',
    left: 10,
    bottom: 10,
  },
  legendTop: {
    position: 'absolute',
    left: 10,
    top: 10,
  },
  attr: {
    position: 'absolute',
    right: 8,
    bottom: 10,
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