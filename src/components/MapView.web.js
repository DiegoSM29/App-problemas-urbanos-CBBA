import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COCHABAMBA_REGION, MapFallback } from './MapCommon';

export { COCHABAMBA_REGION };

export default function CityMap({ reports, onSelect, height }) {
  void onSelect;
  return (
    <View style={[styles.wrap, { height: height ?? 420 }]}>
      <MapFallback reports={reports} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});