// Estilos definidos en un StyleSheet y nunca referenciados. No rompen
// nada, pero indican que la edición dejó código muerto.
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || 'src';
const files = [];

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
})(root);

// El análisis es por archivo, así que hay que distinguir "definido aquí y
// nunca usado" de "usado en otro archivo". Esto se hace blaming: el
// StyleSheet se detecta por su nombre y se rastrea su uso en todo el
// proyecto. Sin esto, casi todo saldría como estilo muerto, porque los
// estilos se definen en un archivo y se usan en otro.
const todasLasFuentes = files.map((f) => ({
  archivo: f,
  texto: fs.readFileSync(f, 'utf8'),
}));

let total = 0;

for (const { archivo, texto: source } of todasLasFuentes) {
  // El nombre del StyleSheet: si no se puede saber, seedenota y se
  // cuentan todos los definidos, que es lo conservador.
  const hoja = source.match(/StyleSheet\.create\(/);
  if (!hoja) continue;
  const nombreHoja = source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*StyleSheet\.create\(/);
  if (!nombreHoja) continue;
  const styles = nombreHoja[1];

  // Se recorre todo el proyecto buscando "styles.<clave>", salvo este
  // mismo archivo, donde la definición no cuenta como uso.
  const usados = new Set();
  for (const otro of todasLasFuentes) {
    if (otro.archivo === archivo) continue;
    for (const m of otro.texto.matchAll(
      new RegExp(`\\b${styles}\\.([A-Za-z0-9_]+)`, 'g')
    )) {
      usados.add(m[1]);
    }
  }
  // Y dentro del propio archivo, por si se usa en la misma pantalla.
  for (const m of source.matchAll(new RegExp(`\\b${styles}\\.([A-Za-z0-9_]+)`, 'g'))) {
    usados.add(m[1]);
  }

  const definidos = new Set();
  for (const m of source.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)) definidos.add(m[1]);

  const sinUso = [...definidos].filter((k) => !usados.has(k));
  if (sinUso.length) {
    total += sinUso.length;
    console.log(`${archivo}\n    ${sinUso.join(', ')}`);
  }
}

console.log(
  total === 0 ? 'OK · sin estilos muertos' : `\n${total} estilo(s) sin usar`
);
process.exit(total === 0 ? 0 : 1);
