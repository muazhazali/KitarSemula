#!/usr/bin/env node
/** Patches location fields in lib/seed-data.ts from the audit corrections. */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SEED_PATH = join(ROOT, 'lib', 'seed-data.ts');
const CORRECTIONS_PATH = join(ROOT, 'audit', 'location-corrections.csv');

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function readCorrections() {
  const rows = parseCsv(readFileSync(CORRECTIONS_PATH, 'utf8'));
  const headers = rows[0].map((header) => header.replace(/^\ufeff/, ''));
  return rows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function main() {
  const seed = execFileSync('git', ['show', 'HEAD:lib/seed-data.ts'], { encoding: 'utf8' });

  const corrections = readCorrections();
  const bySlug = new Map(corrections.map((row) => [row.slug, row]));
  const lines = seed.split(/\r?\n/);
  const seen = new Set();
  let currentSlug = null;

  for (let i = 0; i < lines.length; i++) {
    const slugMatch = lines[i].match(/^\s*slug: '([^']+)',$/);
    if (slugMatch) {
      currentSlug = slugMatch[1];
      continue;
    }
    const correction = currentSlug ? bySlug.get(currentSlug) : null;
    if (!correction) continue;
    if (/^\s*latitude: /.test(lines[i])) {
      lines[i] = lines[i].replace(/latitude: .*,$/, `latitude: ${correction.new_lat},`);
      seen.add(currentSlug);
    } else if (/^\s*longitude: /.test(lines[i])) {
      lines[i] = lines[i].replace(/longitude: .*,$/, `longitude: ${correction.new_lng},`);
    } else if (/^\s*google_maps_url: /.test(lines[i])) {
      const escapedUrl = correction.new_google_maps_url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      lines[i] = lines[i].replace(/google_maps_url: .*,$/, `google_maps_url: '${escapedUrl}',`);
    }
  }

  if (seen.size !== corrections.length) {
    const missing = corrections.filter((row) => !seen.has(row.slug)).map((row) => row.slug);
    throw new Error(`Patched ${seen.size}/${corrections.length}; missing: ${missing.join(', ')}`);
  }

  writeFileSync(SEED_PATH, lines.join('\n'), 'utf8');
  console.log(`Patched ${seen.size} centres in ${SEED_PATH}`);
}

main();
