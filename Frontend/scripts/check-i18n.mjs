// i18n consistency check — run with `npm run i18n:check`.
//  1. English and Somali dictionaries have exactly the same keys.
//  2. Every literal t('…') key used in src/ exists in both languages.
//  3. (--scan) Lists hardcoded user-facing text left in JSX of the given files.
// Exits non-zero when 1 or 2 fail.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const { namespaces } = await import(pathToFileURL(path.join(root, 'i18n/locales/index.js')).href);

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

let failures = 0;
const en = {}; const so = {};
for (const [name, ns] of Object.entries(namespaces)) {
  Object.assign(en, flatten(ns.en, name));
  Object.assign(so, flatten(ns.so, name));
}
for (const key of Object.keys(en)) {
  if (!(key in so)) { console.error(`Missing in Somali: ${key}`); failures++; }
  else if (Array.isArray(en[key]) && (!Array.isArray(so[key]) || so[key].length !== en[key].length)) {
    console.error(`Array length differs: ${key}`); failures++;
  }
}
for (const key of Object.keys(so)) if (!(key in en)) { console.error(`Missing in English: ${key}`); failures++; }

// Placeholders like {name} must match between languages.
const vars = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : '');
for (const key of Object.keys(en)) {
  if (key in so && vars(en[key]) !== vars(so[key])) { console.error(`Placeholder mismatch: ${key}`); failures++; }
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(d.name) ? [p] : [];
});
const files = walk(root).filter((f) => !f.includes(`${path.sep}i18n${path.sep}`));
const has = (key) => key in en || Object.keys(en).some((k) => k.startsWith(`${key}_`) || k.startsWith(`${key}.`));
let used = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    used++;
    if (!has(m[1])) { console.error(`Unknown key ${m[1]} in ${path.relative(root, file)}`); failures++; }
  }
}

console.log(`${Object.keys(en).length} keys per language, ${used} literal t() calls checked.`);

if (process.argv.includes('--scan')) {
  const targets = process.argv.slice(process.argv.indexOf('--scan') + 1);
  for (const rel of targets) {
    const file = path.join(root, rel);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const hits = [
        ...[...line.matchAll(/>\s*([^<>{}]*[A-Za-z]{2,}[^<>{}]*)\s*</g)].map((m) => m[1]),
        ...[...line.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/g)].map((m) => m[1]),
        ...[...line.matchAll(/(?:message|title|label|text|confirmText|cancelText|buttonText):\s*'([^']*[A-Za-z]{3,}[^']*)'/g)].map((m) => m[1]),
      ].filter((s) => s.trim() && !/^(&\w+;|\s)+$/.test(s));
      // JSX text that sits alone on its own line (between tags on other lines).
      const bare = line.trim();
      const looksLikeText = /^[A-Za-z][^<>{}=;()'"`]*$/.test(bare)
        && /[A-Za-z]{2,}/.test(bare)
        && !/,$/.test(bare)                 // import lists, object entries
        && !/^\w+\??:\s/.test(bare)         // object keys
        && !/\w\.\w/.test(bare)             // property access
        && !/^[a-z]\w*$/.test(bare)         // lone identifier
        && !/^(import|export|const|let|var|return|if|else|case|default|break|from|async|await|try|catch|finally)\b/.test(bare);
      if (looksLikeText) hits.push(bare);
      if (hits.length) console.log(`${rel}:${i + 1}: ${hits.join(' | ')}`);
    });
  }
}

if (failures) { console.error(`\n${failures} problem(s) found.`); process.exit(1); }
console.log('OK — English and Somali are in sync.');
