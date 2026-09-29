// Comprobación estática: cada styles.X usado debe existir en el
// StyleSheet del mismo archivo. No es parte de la app, solo una ayuda
// para cazar referencias muertas al editar componentes.
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

let problems = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');

  const used = new Set();
  for (const m of source.matchAll(/styles\.([A-Za-z0-9_]+)/g)) used.add(m[1]);

  const defined = new Set();
  for (const m of source.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)) defined.add(m[1]);

  const missing = [...used].filter((k) => !defined.has(k));
  if (missing.length) {
    problems += missing.length;
    console.log(`FALTA  ${file}: ${missing.join(', ')}`);
  }
}

console.log(
  problems === 0
    ? `OK · ${files.length} archivos, ninguna referencia a styles inexistente`
    : `\n${problems} problema(s)`
);
