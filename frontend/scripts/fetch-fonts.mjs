#!/usr/bin/env node
// Downloads the web fonts into `public/fonts/` and regenerates `src/fonts.css`,
// so the app never asks the visitor's browser to talk to Google.
//
// Run it again after changing REQUEST — that URL is the single source of truth
// for which families and weights ship with the app:
//
//   node scripts/fetch-fonts.mjs
//
// Both the files and the generated CSS are committed; this script is only for
// updating them, never part of the build.

import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// No italic axis: `font-display` is only ever used upright, and Fraunces italic
// was 78 kB of files nothing rendered.
const REQUEST =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700;800&display=swap';

// Google serves woff2 only to browsers it recognises; Node's default agent gets
// ttf, which is roughly twice the size.
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// The app ships fr/en/de/es. Cyrillic, Greek and Vietnamese would be dead
// weight in the repo; add the subset here on the day a locale needs it.
const SUBSETS = new Set(['latin', 'latin-ext']);

// Only ever fetch font binaries from Google's font CDN, whatever the stylesheet
// claims — the URLs below come from a third-party response.
const FONT_HOST = 'fonts.gstatic.com';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = join(root, 'public', 'fonts');
const cssPath = join(root, 'src', 'fonts.css');

/** `IBM Plex Sans` -> `ibm-plex-sans` */
const slug = (family) =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function parseFaces(css) {
  const faces = [];
  // Google emits `/* subset */` immediately before each @font-face block, and
  // the subset appears nowhere inside the block itself.
  const blocks = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  for (const [, subset, body] of css.matchAll(blocks)) {
    if (!SUBSETS.has(subset)) continue;
    const prop = (name) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    const url = prop('src')?.match(/url\((\S+?)\)/)?.[1];
    const family = prop('font-family')?.replace(/['"]/g, '');
    const weight = Number(prop('font-weight'));
    const style = prop('font-style');
    const unicodeRange = prop('unicode-range');
    if (!url || !family || !style || !unicodeRange || !Number.isFinite(weight)) {
      throw new Error(`Unparsable @font-face for subset "${subset}"`);
    }
    faces.push({ subset, family, weight, style, url, unicodeRange });
  }
  if (faces.length === 0) throw new Error('No @font-face matched the requested subsets');
  return faces;
}

/**
 * Collapses the per-weight faces Google emits for a variable font back into one
 * face carrying a weight range: every requested weight of a family/style/subset
 * points at the same file, and shipping it once per weight would download the
 * same bytes four times.
 */
function collapse(faces) {
  const groups = new Map();
  for (const face of faces) {
    const key = `${face.family}|${face.style}|${face.subset}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { ...face, min: face.weight, max: face.weight });
      continue;
    }
    if (group.url !== face.url) {
      // A static family: one file per weight. Nothing here handles that, and
      // silently keeping one file would ship the wrong weights.
      throw new Error(
        `${face.family} ${face.style} ${face.subset} is not a variable font — this script only supports variable families`,
      );
    }
    group.min = Math.min(group.min, face.weight);
    group.max = Math.max(group.max, face.weight);
  }
  return [...groups.values()];
}

async function download(face) {
  const url = new URL(face.url);
  if (url.protocol !== 'https:' || url.hostname !== FONT_HOST) {
    throw new Error(`Refusing to fetch a font from ${url.origin}`);
  }
  const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'error' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  // A stylesheet that stopped serving woff2 must fail loudly rather than leave
  // a mislabelled file the browser will reject at render time.
  if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`${url}: not a woff2 file`);
  }
  // Weights stay out of the name: index.html preloads two of these paths, and a
  // filename that shifts with the requested weights would break the preload
  // without breaking the build.
  const name = `${slug(face.family)}-${face.subset}-${face.style}.woff2`;
  await writeFile(join(fontsDir, name), bytes);
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return { ...face, name, size: bytes.length, digest };
}

function renderCss(faces) {
  const rules = faces.map(
    (face) => `@font-face {
  font-family: '${face.family}';
  font-style: ${face.style};
  font-weight: ${face.min === face.max ? face.min : `${face.min} ${face.max}`};
  font-display: swap;
  src: url('/fonts/${face.name}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`,
  );
  return `/* Generated by scripts/fetch-fonts.mjs — do not edit by hand.
 *
 * Self-hosted so no visitor IP reaches Google on page load. Variable fonts:
 * one file per family, style and subset covers the whole weight range.
 */

${rules.join('\n\n')}
`;
}

const response = await fetch(REQUEST, { headers: { 'User-Agent': BROWSER_UA } });
if (!response.ok) throw new Error(`${REQUEST}: HTTP ${response.status}`);

const faces = collapse(parseFaces(await response.text())).sort((a, b) =>
  `${a.family}${a.style}${a.subset}`.localeCompare(`${b.family}${b.style}${b.subset}`),
);

await mkdir(fontsDir, { recursive: true });
const written = await Promise.all(faces.map(download));
await writeFile(cssPath, renderCss(written));

// Dropping a family or a subset from REQUEST must actually remove its files,
// otherwise the repo keeps serving bytes the CSS no longer references.
const keep = new Set(written.map((face) => face.name));
for (const name of await readdir(fontsDir)) {
  if (name.endsWith('.woff2') && !keep.has(name)) {
    await unlink(join(fontsDir, name));
    console.log(`removed stale ${name}`);
  }
}

let total = 0;
for (const face of written) {
  total += face.size;
  const weights = face.min === face.max ? face.min : `${face.min}-${face.max}`;
  console.log(
    `${face.name.padEnd(38)} ${weights.toString().padStart(8)}  ${String(Math.round(face.size / 1024)).padStart(4)} kB  sha256:${face.digest}`,
  );
}
console.log(`\n${written.length} files, ${Math.round(total / 1024)} kB -> public/fonts/`);
console.log(`Regenerated ${cssPath.replace(`${root}/`, '')}`);
