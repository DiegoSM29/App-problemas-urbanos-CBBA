// Los filtros del mapa (categoría, fecha de publicación, estado y alcance)
// más el botón que los quita.
//
// Los usa el administrador y el ciudadano, y no por casualidad: los datos
// ya están en memoria en los dos casos, así que filtrar no cuesta una
// petición extra. El técnico no los ve: RLS ya le entrega solo los reportes
// que el municipio le asignó, y un filtro sobre eso no le diría nada que no
// sepa.
//
// El mismo lenguaje visual que FilterTabs (chips), pero en varios grupos con
// su etiqueta, porque en el mapa conviven los criterios y sin ellos no se
// sabría cuál está quitando reportes de la vista.
//
// Cada pantalla dice qué filas quiere con `criterios`: la del mapa entero
// las cuatro, la del formulario del ciudadano solo el estado y el alcance.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import {
  AMBITOS_FILTRO,
  CATEGORIAS_FILTRO,
  CRITERIOS_FILTRO,
  ESTADOS_FILTRO,
  FILTROS_INICIALES,
  RANGOS_FECHA,
  etiquetaAmbito,
  etiquetaFecha,
  hayFiltrosActivos,
  resumenFiltros,
} from '../lib/filtros';

// Un criterio: su etiqueta y las opciones que se pueden elegir.
function Fila({ etiqueta, opciones, value, onChange }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.opciones}
      >
        {opciones.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function MapFilters({
  value,
  onChange,
  visibles,
  total,
  criterios = CRITERIOS_FILTRO,
}) {
  const set = (campo) => (v) => onChange({ ...value, [campo]: v });

  // La fila de fecha trabaja con la etiqueta ("Últimos 7 días") y no con la
  // clave ("7d"): el mapa trabaja con claves y el usuario con palabras.
  const cambiarFecha = (label) => {
    const rango = RANGOS_FECHA.find((r) => r.label === label);
    set('fecha')(rango?.clave ?? 'todo');
  };

  // El alcance va igual: la etiqueta es "Solo los míos" y la clave
  // "propios".
  const cambiarAmbito = (label) => {
    const ambito = AMBITOS_FILTRO.find((a) => a.label === label);
    set('ambito')(ambito?.clave ?? 'todos');
  };

  const activos = hayFiltrosActivos(value);

  return (
    <View style={styles.wrap}>
      {criterios.includes('categoria') && (
        <Fila
          etiqueta="Categoría"
          opciones={CATEGORIAS_FILTRO}
          value={value.categoria}
          onChange={set('categoria')}
        />
      )}
      {criterios.includes('estado') && (
        <Fila
          etiqueta="Estado"
          opciones={ESTADOS_FILTRO}
          value={value.estado}
          onChange={set('estado')}
        />
      )}
      {criterios.includes('fecha') && (
        <Fila
          etiqueta="Fecha de publicación"
          opciones={RANGOS_FECHA.map((r) => r.label)}
          value={etiquetaFecha(value.fecha)}
          onChange={cambiarFecha}
        />
      )}
      {criterios.includes('ambito') && (
        <Fila
          etiqueta="Alcance"
          opciones={AMBITOS_FILTRO.map((a) => a.label)}
          value={etiquetaAmbito(value.ambito)}
          onChange={cambiarAmbito}
        />
      )}

      {activos && (
        <View style={styles.pie}>
          <Text style={styles.resumen} numberOfLines={1}>
            {resumenFiltros(value)} · {visibles} de {total}
          </Text>
          <Pressable
            onPress={() => onChange(FILTROS_INICIALES)}
            style={styles.quitar}
          >
            <Text style={styles.quitarText}>✕ Quitar filtros</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    gap: 8,
  },
  fila: {
    gap: 5,
  },
  etiqueta: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: colors.accent,
  },
  opciones: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    backgroundColor: '#F7FBFD',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resumen: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  quitar: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  quitarText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
});
