import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import ReportList from '../components/ReportList';

export default function ReportsScreen({ admin }) {
  const { isAdmin } = useAuth();
  const { reports, technicians, loading, error, changeStatus, assign } =
    useReports();
  const [category, setCategory] = useState('Todos');

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        {admin ? 'GESTIÓN MUNICIPAL' : 'SEGUIMIENTO CIUDADANO'}
      </Text>
      <Text style={styles.title}>
        {admin ? 'Todos los reportes' : 'Mis reportes'}
      </Text>
      <Text style={styles.description}>
        {admin
          ? 'Aquí ves todos los reportes enviados hacia el municipio. Actualiza el estado de cada incidencia para informar a la ciudadanía.'
          : 'Consulta el avance de las incidencias que has reportado y su estado actual.'}
      </Text>

      {loading && <Text style={styles.note}>Cargando reportes…</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <ReportList
        title={`${reports.length} reporte${reports.length === 1 ? '' : 's'}`}
        reports={reports}
        category={category}
        onCategoryChange={setCategory}
        admin={admin}
        technicians={admin ? technicians : undefined}
        onAssign={admin && isAdmin ? assign : undefined}
        onStatusChange={isAdmin ? changeStatus : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 30,
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
    marginBottom: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
});