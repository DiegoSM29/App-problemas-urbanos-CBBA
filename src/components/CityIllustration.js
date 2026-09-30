import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function CityIllustration() {
  return (
    <View style={styles.art}>
      <View style={styles.sun} />
      <View style={styles.mountainFar} />
      <View style={styles.mountainNear} />
      <View style={styles.buildings}>
        <View style={[styles.building, styles.tall]} />
        <View style={[styles.building, styles.wide]} />
        <View style={[styles.building, styles.small]} />
      </View>
      <Text style={styles.label}>CBBA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    top: 34,
    right: 34,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.warning,
    opacity: 0.9,
  },
  mountainFar: {
    position: 'absolute',
    bottom: 80,
    left: -30,
    width: 220,
    height: 150,
    borderRadius: 110,
    backgroundColor: '#B9DCE0',
    transform: [{ rotate: '-20deg' }],
  },
  mountainNear: {
    position: 'absolute',
    bottom: -40,
    right: -20,
    width: 260,
    height: 180,
    borderRadius: 130,
    backgroundColor: colors.accent,
    opacity: 0.35,
    transform: [{ rotate: '25deg' }],
  },
  buildings: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  building: {
    backgroundColor: '#9CC8D6',
    borderRadius: 4,
  },
  tall: {
    width: 38,
    height: 86,
  },
  wide: {
    width: 52,
    height: 62,
  },
  small: {
    width: 28,
    height: 46,
  },
  label: {
    position: 'absolute',
    bottom: 22,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.text,
    opacity: 0.5,
  },
});