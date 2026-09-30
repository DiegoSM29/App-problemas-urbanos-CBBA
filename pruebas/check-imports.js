// Verifica que cada símbolo importado exista de verdad en el archivo de
// destino. Caza imports renombrados o funciones movidas sin aviso.
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

function resolve(base, spec) {
  const target = path.resolve(path.dirname(base), spec);
  const candidates = [
    target,
    `${target}.js`,
    `${target}.web.js`,
    `${target}.native.js`,
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();

  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_]+)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');

  return names;
}

let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const importRe = /import\s+([\s\S]*?)\s+from\s+'([^']+)'/g;

  for (const m of src.matchAll(importRe)) {
    const clause = m[1];
    const spec = m[2];
    if (!spec.startsWith('.')) continue;

    const resolved = resolve(file, spec);
    if (!resolved) {
      console.log(`NO EXISTE  ${file} -> ${spec}`);
      problems++;
      continue;
    }

    const available = exportsOf(resolved);

    // Solo se comprueban los imports con llaves: los de namespace
    // (* as x) y los por defecto no aportan símbolos con nombre.
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (!braces) continue;

    for (const part of braces[1].split(',')) {
      const raw = part.trim();
      if (!raw) continue;
      const name = raw.split(/\s+as\s+/)[0].trim();
      if (!available.has(name)) {
        console.log(`FALTA EXPORT  ${file}\n    importa "${name}" de ${spec}`);
        problems++;
      }
    }
  }
}

console.log(
  problems === 0
    ? `OK · ${files.length} archivos, todos los imports resuelven`
    : `\n${problems} problema(s)`
);
