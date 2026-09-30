import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useFiltrosMapa } from '../hooks/useFiltrosMapa';
import { CRITERIOS_FILTRO } from '../lib/filtros';
import MapFilters from '../components/MapFilters';
import CityMap from '../components/MapView';

export default function MapScreen({ desktop }) {
  const { isAdmin, isTechnician } = useAuth();
  const { filtros, setFiltros, enMapa, filtrados, mapLoading } = useFiltrosMapa();

  // El ciudadano filtra el mapa igual que el administrador, y además puede
  // aislar lo que mandó él. El técnico no: RLS ya le entrega solo los
  // reportes que tiene asignados, así que un filtro ahí solo le estorbaría.
  const conFiltros = !isTechnician;
  const visibles = conFiltros ? filtrados : enMapa;

  // El alcance ("solo los míos") solo tiene sentido para quien reporta: el
  // administrador no manda incidencias y el técnico no es el dueño de las suyas.
  const criterios = isAdmin
    ? CRITERIOS_FILTRO.filter((c) => c !== 'ambito')
    : CRITERIOS_FILTRO;

  const descripcion = isAdmin
    ? 'Todas las incidencias reportadas hacia el municipio. Filtra por categoría, estado y fecha para ver solo las que te interesan.'
    : isTechnician
      ? 'Las incidencias que el municipio te asignó. Los pines cambian de color según el estado; toca uno para ver sus datos.'
      : 'Todas las incidencias de la ciudad. Filtra por categoría, estado y fecha, o mira solo las que reportaste tú; los pines cambian de color según el estado.';

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>UBICACIÓN · COCHABAMBA</Text>
      <Text style={styles.title}>Mapa de incidencias</Text>
      <Text style={styles.description}>{descripcion}</Text>

      {conFiltros && (
        <MapFilters
          value={filtros}
          onChange={setFiltros}
          visibles={visibles.length}
          total={enMapa.length}
          criterios={criterios}
        />
      )}

      {mapLoading && <Text style={styles.note}>Cargando mapa…</Text>}

      {/*
        Cuando los filtros dejan el mapa sin nada, el mapa vacío por sí solo
        parece una falla. Se dice que fue el filtro, y si el que quitó los
        pines fue el alcance se dice eso: si no, el ciudadano leería "prueba a
        quitar alguno" sobre un mapa donde nunca reportó nada.
      */}
      {!mapLoading && !visibles.length && (
        <Text style={styles.note}>
          {!enMapa.length
            ? 'Todavía no hay incidencias ubicadas en el mapa.'
            : filtros.ambito === 'propios'
              ? 'Ninguno de tus reportes coincide con los filtros. Prueba a quitar alguno.'
              : 'Ningún reporte coincide con los filtros. Prueba a quitar alguno.'}
        </Text>
      )}

      <CityMap reports={visibles} height={desktop ? 520 : 440} />

      <Text style={styles.count}>
        {visibles.length === enMapa.length
          ? `${visibles.length} incidencia${visibles.length === 1 ? '' : 's'} en el mapa`
          : `Mostrando ${visibles.length} de ${enMapa.length} incidencias`}
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
