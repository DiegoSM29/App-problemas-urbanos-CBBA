import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, toneColor } from '../theme/colors';
import { COCHABAMBA_REGION, Legend } from './MapCommon';

export { COCHABAMBA_REGION };

export default function CityMap({ reports, onSelect, height }) {
  return (
    <View style={{ height: height ?? 420, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={COCHABAMBA_REGION}
        showsUserLocation={false}
        onPress={(e) => {
          if (onSelect) onSelect(e.nativeEvent.coordinate);
        }}
      >
        {reports
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.lat, longitude: r.lng }}
              pinColor={toneColor[r.tone] ?? colors.primary}
              title={r.title}
              description={`${r.place} · ${r.status}`}
            />
          ))}
      </MapView>
      {onSelect ? (
        <View style={styles.selectHint}>
          <Text style={styles.selectHintText}>
            Toca el mapa para marcar la ubicación de la incidencia
          </Text>
        </View>
      ) : (
        <Legend />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selectHint: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectHintText: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
});