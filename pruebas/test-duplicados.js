// Prueba de la regla de reportes duplicados.
//
// La regla (misma categoría a menos de 30 metros) vive en
// src/lib/duplicados.js como funciones puras, así que se comprueba aquí sin
// levantar React ni la app. Lo que más importa no es que encuentre
// duplicados, sino que NO invente: si la distancia saliera 0 cuando falta una
// coordenada, el formulario bloquearía todos los reportes de la ciudad, y si
// saliera NaN no bloquearía ninguno.
const assert = require('assert');
const path = require('path');

const raiz = process.argv[2];
const {
  RADIO_DUPLICADO_M,
  AVISO_DUPLICADO,
  distanciaMetros,
  duplicadoDe,
  mensajeDuplicado,
} = require(path.resolve(raiz, 'src/lib/duplicados.js'));

// Un punto de Cochabamba (el centro, que también es el centro por defecto del
// mapa) y otro a unos 25 m al norte. A esta latitud un grado de longitud mide
// algo menos que uno de latitud, así que los metros de referencia se calculan
// en norte-sur, que es lo predecible.
const CITO = { lat: -17.3833, lng: -66.1597 };
const norte = (metros) => ({ lat: CITO.lat + metros / 111195, lng: CITO.lng });

const casos = [];
const caso = (nombre, valor, comprueba) => casos.push([nombre, valor, comprueba]);

// ---- La medida ----

caso(
  'un punto consigo mismo está a cero',
  distanciaMetros(CITO, CITO),
  (v) => v === 0
);

caso(
  'un grado de latitud es unos 111 km',
  distanciaMetros({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }),
  (v) => Math.abs(v - 111195) < 200
);

caso(
  '30 metros salen 0,00027 grados de latitud',
  distanciaMetros(CITO, norte(30)),
  (v) => Math.abs(v - 30) < 0.5
);

caso(
  'la distancia es igual en los dos sentidos',
  distanciaMetros(CITO, norte(25)) - distanciaMetros(norte(25), CITO),
  (v) => Math.abs(v) < 1e-9
);

// La app recibe el punto del GPS como {latitude, longitude} y el de la base
// como {lat, lng}. Si uno de los dos no se entendiera, la distancia sería NaN
// y ningún duplicado se vería nunca.
caso(
  'también acepta el formato del GPS',
  distanciaMetros({ latitude: CITO.lat, longitude: CITO.lng }, norte(25)),
  (v) => Math.abs(v - 25) < 0.5
);

// El caso peligroso de verdad: sin coordenadas no hay distancia, y 0
// significa "duplicado" en todas partes.
caso(
  'sin latitud no hay distancia',
  distanciaMetros(CITO, { lng: -66.1597 }),
  (v) => v === null
);

caso(
  'sin longitud tampoco',
  distanciaMetros(CITO, { lat: CITO.lat }),
  (v) => v === null
);

caso(
  'con coordenadas en blanco tampoco',
  distanciaMetros(CITO, { lat: '', lng: '' }),
  (v) => v === null
);

caso(
  'nada de coordenadas es nada de distancia',
  distanciaMetros(null, CITO),
  (v) => v === null
);

// ---- La regla ----

const Alumbrado = {
  id: 'a',
  category: 'Iluminación',
  status: 'Pendiente',
  title: 'Farola fundida',
  place: 'Calle Colombia',
  ...CITO,
};
const Bache = {
  id: 'b',
  category: 'Vialidad',
  status: 'Pendiente',
  title: 'Bache en la avenida',
  place: 'Av. América',
  ...CITO,
};
// Otro reporte de alumbrado en el mismo punto: el caso del vecino que
// reporta lo mismo que su vecino de al lado.
const Vecino = {
  id: 'c',
  category: 'Iluminación',
  status: 'Pendiente',
  title: 'Poste sin luz',
  place: 'Calle Colombia',
  ...CITO,
};

caso(
  'el radio de la regla son 30 metros',
  RADIO_DUPLICADO_M,
  (v) => v === 30
);

caso(
  'la misma categoría a 25 metros ya está duplicada',
  duplicadoDe({ category: 'Iluminación', ...norte(25) }, [Alumbrado]),
  (v) => v && v.reporte.id === 'a' && Math.abs(v.metros - 25) < 1
);

caso(
  'la misma categoría a 35 metros todavía no',
  duplicadoDe({ category: 'Iluminación', ...norte(35) }, [Alumbrado]),
  (v) => v === null
);

// El borde: 30,0 m exactos cuentan como duplicado. Se decide por la misma
// comparación que hace la base (menor o igual que el radio), porque entre los
// dos lados no puede quedar un limbo.
caso(
  'justo en el borde también cuenta',
  duplicadoDe(
    { category: 'Iluminación', ...norte(30) },
    [{ ...Alumbrado, ...norte(-30) }],
    { radio: 60 }
  ),
  (v) => v !== null
);

caso(
  'otra categoría a 5 metros no choca',
  duplicadoDe({ category: 'Iluminación', ...norte(5) }, [Bache]),
  (v) => v === null
);

// Dos problemas distintos de la misma categoría pegados también se frena: es
// lo que pidió el municipio (mismo tipo, mismo punto, no se repite).
caso(
  'misma categoría y mismo sitio, aunque el título sea otro',
  duplicadoDe({ category: 'Iluminación', ...CITO }, [
    { ...Alumbrado, id: 'z', title: 'Poste sin luz' },
  ]),
  (v) => v && v.reporte.id === 'z'
);

caso(
  'un reporte ya resuelto no estorba',
  duplicadoDe({ category: 'Iluminación', ...norte(5) }, [
    { ...Alumbrado, status: 'Resuelto' },
  ]),
  (v) => v === null
);

caso(
  'pero uno a medio resolver sí',
  duplicadoDe({ category: 'Iluminación', ...norte(5) }, [
    { ...Alumbrado, status: 'En proceso' },
  ]),
  (v) => v && v.reporte.id === 'a'
);

// En la edición, el reporte no puede ser su propio duplicado.
caso(
  'al editar, el reporte se excluye a sí mismo',
  duplicadoDe({ category: 'Iluminación', ...CITO }, [Alumbrado], {
    excludeId: 'a',
  }),
  (v) => v === null
);

caso(
  'y si hay otro igual al lado, ese sí lo encuentra',
  duplicadoDe({ category: 'Iluminación', ...CITO }, [Alumbrado, Vecino], {
    excludeId: 'a',
  }),
  (v) => v && v.reporte.id === 'c'
);

caso(
  'de varios reportes en radio, avisa del más cercano',
  duplicadoDe({ category: 'Iluminación', ...CITO }, [
    { ...Alumbrado, id: 'lejos', ...norte(28) },
    { ...Alumbrado, id: 'cerca', ...norte(3) },
  ]),
  (v) => v && v.reporte.id === 'cerca' && v.metros === 3
);

// Los reportes sin punto no se dibujan en el mapa y no se pueden comparar:
// si se contaran como distancia cero, bloquearían medio mapa.
caso(
  'un reporte sin punto no bloquea nada',
  duplicadoDe({ category: 'Iluminación', ...CITO }, [
    { ...Alumbrado, lat: null, lng: null },
  ]),
  (v) => v === null
);

// El candidato sin punto tampoco: la regla es de los reportes enviados desde
// el mapa.
caso(
  'sin punto marcado no hay nada que comparar',
  duplicadoDe({ category: 'Iluminación' }, [Alumbrado]),
  (v) => v === null
);

caso(
  'sin categoría tampoco',
  duplicadoDe({ ...norte(5) }, [Alumbrado]),
  (v) => v === null
);

caso(
  'con la lista vacía no hay duplicado',
  duplicadoDe({ category: 'Iluminación', ...norte(5) }, []),
  (v) => v === null
);

caso(
  'ni siquiera con la lista sin cargar',
  duplicadoDe({ category: 'Iluminación', ...norte(5) }, undefined),
  (v) => v === null
);

// El radio se puede cambiar al comprobarlo (las pruebas del servidor miden 25
// y 35 metros con él) y el aviso tiene que decir el que se comprobó.
caso(
  'el aviso dice el radio con el que se comprobó',
  mensajeDuplicado(duplicadoDe({ category: 'Iluminación', ...norte(5) }, [Alumbrado], { radio: 50 })),
  (v) => v.startsWith(`${AVISO_DUPLICADO} 50 metros`)
);

// ---- El aviso ----

caso(
  'el aviso empieza con la frase que comparte con el trigger',
  mensajeDuplicado(duplicadoDe({ category: 'Iluminación', ...norte(25) }, [Alumbrado])),
  (v) => v.startsWith(AVISO_DUPLICADO) && v.includes('30 metros')
);

caso(
  'y dice qué hay ya registrado',
  mensajeDuplicado(duplicadoDe({ category: 'Iluminación', ...norte(25) }, [Alumbrado])),
  (v) =>
    v.includes('«Farola fundida»') &&
    v.includes('Calle Colombia') &&
    v.includes('Pendiente')
);

caso(
  'y a cuántos metros está',
  mensajeDuplicado(duplicadoDe({ category: 'Iluminación', ...norte(25) }, [Alumbrado])),
  (v) => v.includes('a 25 m')
);

caso(
  'sin datos del reporte el aviso sigue siendo entendible',
  mensajeDuplicado({ reporte: {}, metros: 12, radio: 30 }),
  (v) => v.startsWith(AVISO_DUPLICADO) && !v.includes('undefined')
);

let fallos = 0;
for (const [nombre, valor, comprueba] of casos) {
  try {
    assert.ok(comprueba(valor), `valor inesperado: ${JSON.stringify(valor)}`);
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${e.message}`);
    fallos++;
  }
}

console.log(
  fallos === 0
    ? `\nOK · ${casos.length} comprobaciones de la regla de duplicados`
    : `\n${fallos} fallo(s) en la regla de duplicados`
);
process.exit(fallos === 0 ? 0 : 1);
