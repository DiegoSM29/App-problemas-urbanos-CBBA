import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import ReportList from '../components/ReportList';

const segments = ['Pendientes', 'Resueltos', 'Todos'];

export default function TechnicianScreen() {
  const { profile } = useAuth();
  const { reports, assignments, loading, error, diagnostic, refresh, complete } =
    useReports();
  const [segment, setSegment] = useState('Pendientes');

  const pending = reports.filter((r) => r.status !== 'Resuelto');
  const resolved = reports.filter((r) => r.status === 'Resuelto');

  const visible =
    segment === 'Pendientes'
      ? pending
      : segment === 'Resueltos'
        ? resolved
        : reports;

  const emptyText =
    segment === 'Pendientes'
      ? 'No tienes trabajos pendientes.'
      : segment === 'Resueltos'
        ? 'Aún no has resuelto reportes.'
        : 'No tienes reportes asignados.';

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>PANEL TÉCNICO</Text>
          <Text style={styles.title}>Mis asignaciones</Text>
        </View>
        <Pressable
          style={styles.refresh}
          onPress={refresh}
          disabled={loading}
        >
          <Text style={styles.refreshText}>{loading ? '···' : '↻'}</Text>
        </Pressable>
      </View>

      <Text style={styles.description}>
        {profile?.nombre ? `${profile.nombre}, ` : ''}
        aquí aparecen los reportes que el municipio te asignó. Registra el
        informe, los materiales utilizados y escribe al ciudadano cómo quedó
        el problema al terminar.
      </Text>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: `${colors.warning}18` }]}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>
            {pending.length}
          </Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: `${colors.success}18` }]}>
          <Text style={[styles.statNumber, { color: colors.success }]}>
            {resolved.length}
          </Text>
          <Text style={styles.statLabel}>Resueltos</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: `${colors.primary}18` }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>
            {reports.length}
          </Text>
          <Text style={styles.statLabel}>Asignados</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {segments.map((s) => {
          const active = segment === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSegment(s)}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
            >
              <Text
                style={active ? styles.segmentTextActive : styles.segmentText}
              >
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && <Text style={styles.note}>Cargando asignaciones…</Text>}
      {!!diagnostic && <Text style={styles.error}>{error}</Text>}
      {!!error && !diagnostic && <Text style={styles.error}>{error}</Text>}

      <ReportList
        title={`${visible.length} reporte${visible.length === 1 ? '' : 's'}`}
        reports={visible}
        category="Todos"
        technician
        onComplete={complete}
        showFilters={false}
        assignments={assignments}
        emptyText={emptyText}
        emptyActionLabel="Actualizar"
        onEmptyAction={refresh}
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
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headText: {
    flex: 1,
    paddingRight: 12,
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  refreshText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '900',
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
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  stat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
    marginTop: 2,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F3F7F8',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontWeight: '700',
    color: colors.textFaint,
    fontSize: 13,
  },
  segmentTextActive: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 13,
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
