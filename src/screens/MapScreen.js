import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import CityMap from '../components/MapView';

export default function MapScreen({ desktop }) {
  const { isAdmin } = useAuth();
  const { reports, loading } = useReports();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>UBICACIÓN · COCHABAMBA</Text>
      <Text style={styles.title}>Mapa de incidencias</Text>
      <Text style={styles.description}>
        {isAdmin
          ? 'Todas las incidencias reportadas hacia el municipio.'
          : 'Incidencias visibles en la ciudad. Los pines cambian de color según el estado.'}
      </Text>

      {loading && <Text style={styles.note}>Cargando mapa…</Text>}

      <CityMap reports={reports} height={desktop ? 520 : 440} />

      <Text style={styles.count}>
        {reports.length} incidencia{reports.length === 1 ? '' : 's'}{' '}
        registrada{reports.length === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 34,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 18,
  },
  note: {
    color: colors.textFaint,
    marginBottom: 10,
  },
  count: {
    marginTop: 14,
    fontSize: 12,
    color: colors.textFaint,
    fontWeight: '700',
  },
});