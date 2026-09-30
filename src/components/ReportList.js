import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import ReportCard from './ReportCard';
import FilterTabs from './FilterTabs';
import EmptyState from './EmptyState';

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
  onReopen,
  citizen,
  assignments,
  title,
  emptyText,
  emptyHint,
  emptyActionLabel,
  onEmptyAction,
  showFilters = true,
}) {
  const visible =
    category === 'Todos'
      ? reports
      : reports.filter((r) => r.category === category);

  if (!visible.length) {
    return (
      <View>
        {title && <Text style={styles.title}>{title}</Text>}
        <EmptyState
          icon={emptyHint ? '⚠' : '◇'}
          tone={emptyHint ? 'error' : 'neutral'}
          title={emptyText ?? 'No hay reportes en esta categoría.'}
          description={emptyHint}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </View>
    );
  }

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
          onReopen={onReopen}
          citizen={citizen}
          onStatusChange={onStatusChange}
          assignments={assignments?.get(report.id)}
        />
      ))}
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
});
