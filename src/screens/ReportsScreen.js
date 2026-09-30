import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import ReportList from '../components/ReportList';
import EditReportModal from '../components/EditReportModal';
import ReopenReportModal from '../components/ReopenReportModal';
import EmptyState from '../components/EmptyState';

export default function ReportsScreen({ admin }) {
  const { isAdmin } = useAuth();
  const {
    reports,
    technicians,
    assignments,
    loading,
    error,
    diagnostic,
    refresh,
    changeStatus,
    assign,
    edit,
    reopen,
  } = useReports();
  const [category, setCategory] = useState('Todos');
  const [editing, setEditing] = useState(null);
  const [reopening, setReopening] = useState(null);

  // Solo el ciudadano (no admin) puede corregir sus propios reportes.
  const citizen = !admin && !isAdmin;

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>
            {admin ? 'GESTIÓN MUNICIPAL' : 'SEGUIMIENTO CIUDADANO'}
          </Text>
          <Text style={styles.title}>
            {admin ? 'Todos los reportes' : 'Mis reportes'}
          </Text>
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
        {admin
          ? 'Aquí ves todos los reportes enviados hacia el municipio. Actualiza el estado de cada incidencia para informar a la ciudadanía.'
          : 'Consulta el avance de las incidencias que has reportado y su estado actual.'}
      </Text>

      {loading && <Text style={styles.note}>Cargando reportes…</Text>}

      {/*
        Antes, un fallo de permisos y un "no hay nada" se veían igual:
        una línea de texto. Con el panel del administrador vacío eso es
        un callejón sin salida, así que el error técnico se muestra con
        una pista de qué ejecutar.
      */}
      {!!diagnostic && (
        <EmptyState
          icon="⚠"
          tone="error"
          title="No se pudieron cargar los reportes"
          description={diagnostic.hint ?? error ?? diagnostic.message}
          actionLabel="Reintentar"
          onAction={refresh}
        />
      )}

      {!!error && !diagnostic && <Text style={styles.error}>{error}</Text>}

      {!diagnostic && (
        <ReportList
          title={`${reports.length} reporte${reports.length === 1 ? '' : 's'}`}
          reports={reports}
          category={category}
          onCategoryChange={setCategory}
          admin={admin}
          citizen={citizen}
          onEdit={citizen ? setEditing : undefined}
          onReopen={citizen ? setReopening : undefined}
          technicians={admin ? technicians : undefined}
          onAssign={admin && isAdmin ? assign : undefined}
          onStatusChange={isAdmin ? changeStatus : undefined}
          assignments={assignments}
          emptyText={
            admin
              ? 'Todavía no llegó ningún reporte de la ciudadanía.'
              : 'Todavía no has reportado ninguna incidencia.'
          }
          emptyActionLabel={admin ? 'Actualizar' : undefined}
          onEmptyAction={refresh}
        />
      )}

      <EditReportModal
        report={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSave={edit}
      />

      <ReopenReportModal
        report={reopening}
        visible={!!reopening}
        onClose={() => setReopening(null)}
        onSave={reopen}
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
