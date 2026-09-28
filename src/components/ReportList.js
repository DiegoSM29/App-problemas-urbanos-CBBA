import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import ReportCard from './ReportCard';
import FilterTabs from './FilterTabs';

export default function ReportList({
  reports,
  category,
  onCategoryChange,
  onStatusChange,
  admin,
  technician,
  technicians,
  onAssign,
  onComplete,
  onEdit,
  citizen,
  title,
  emptyText,
  showFilters = true,
}) {
  const visible =
    category === 'Todos'
      ? reports
      : reports.filter((r) => r.category === category);

  return (
    <View>
      {title && <Text style={styles.title}>{title}</Text>}
      {showFilters && onCategoryChange && (
        <FilterTabs value={category} onChange={onCategoryChange} />
      )}
      {visible.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          admin={admin}
          technician={technician}
          technicians={technicians}
          onAssign={onAssign}
          onComplete={onComplete}
          onEdit={onEdit}
          citizen={citizen}
          onStatusChange={onStatusChange}
        />
      ))}
      {!visible.length && (
        <Text style={styles.empty}>
          {emptyText ?? 'No hay reportes en esta categoría.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 22,
    marginBottom: 10,
  },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    paddingVertical: 22,
  },
});