import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import {
  FILTROS_INICIALES,
  filtrarReportes,
  idsDe,
  pinesDelMapa,
} from '../lib/filtros';

// El estado de los filtros del mapa y los pines que quedan con ellos, en un
// solo sitio.
//
// Lo usan la pantalla "Mapa" y los dos mapas del ciudadano, el de "Reportar"
// y el de "Editar". Si cada uno compusiera la lista por su cuenta, el
// contador y los pines se desincronizarían entre sí, que es lo que pasaba
// antes de que esta pieza existiera.
export function useFiltrosMapa() {
  const { user } = useAuth();
  const { mapReports, reports, mapLoading } = useReports();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  // Lo que el mapa puede dibujar de verdad: con punto y dentro de
  // Cochabamba, antes de aplicar ningún criterio.
  const enMapa = useMemo(() => pinesDelMapa(mapReports), [mapReports]);

  // Los reportes de la persona, en ids: es lo que decide el filtro de
  // "solo los míos". Para el ciudadano, RLS ya le devuelve únicamente los
  // suyos; el `user_id` se comprueba igual, por si la lista viniera
  // mezclada. Los ids sin dueño se cuentan como propios, que es lo que
  // fueron: nadie más los puede ver.
  const idsPropios = useMemo(
    () =>
      idsDe(
        (reports ?? []).filter(
          (r) => r.user_id == null || r.user_id === user?.id
        )
      ),
    [reports, user?.id]
  );

  // El `now` se deja a su valor por defecto (el reloj de ahora): los rangos
  // de fecha se miden en el momento en que se pinta la lista.
  const filtrados = useMemo(
    () => filtrarReportes(enMapa, filtros, undefined, { idsPropios }),
    [enMapa, filtros, idsPropios]
  );

  return { filtros, setFiltros, enMapa, filtrados, mapLoading };
}
