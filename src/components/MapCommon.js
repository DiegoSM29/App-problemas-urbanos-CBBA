import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, toneColor, statusColor, statuses } from '../theme/colors';
import { COCHABAMBA_CENTER } from '../lib/region';

// El centro y el límite geográfico viven en src/lib/region.js. El mapa web y
// el nativo importan de los dos sitios, sin repetir números.
export const COCHABAMBA_REGION = {
  ...COCHABAMBA_CENTER,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function Legend() {
  return (
    <View style={styles.legend}>
      {statuses.map((s) => (
        <Text key={s} style={styles.legendItem}>
          <Text style={{ color: statusColor[s] }}>●</Text> {s}
        </Text>
      ))}
    </View>
  );
}

export function MapFallback({ reports }) {
  return (
    <View style={styles.fallback}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>Mapa de incidencias</Text>
        <Text style={styles.fallbackNote}>
          En web se muestra un resumen geolocalizado. Abre la app en tu celular
          (Android/iOS) para ver el mapa interactivo.
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {reports.map((r) => (
          <View key={r.id} style={styles.pin}>
            <Text
              style={[
                styles.dot,
                { color: toneColor[r.tone] ?? colors.primary },
              ]}
            >
              ●
            </Text>
            <View style={styles.pinText}>
              <Text style={styles.pinTitle} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={styles.pinMeta} numberOfLines={1}>
                {r.lat != null && r.lng != null
                  ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`
                  : r.place}
              </Text>
            </View>
          </View>
        ))}
        {!reports.length && (
          <Text style={styles.pinTitle}>No hay incidencias ubicadas.</Text>
        )}
      </ScrollView>
      <Legend />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: colors.hero,
    borderRadius: 16,
    padding: 18,
    paddingBottom: 46,
  },
  fallbackHeader: {
    marginBottom: 14,
  },
  fallbackTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  fallbackNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },
  list: {
    flex: 1,
  },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dot: {
    fontSize: 18,
  },
  pinText: {
    flex: 1,
  },
  pinTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pinMeta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  legendItem: {
    fontSize: 11,
    color: colors.text,
  },
});