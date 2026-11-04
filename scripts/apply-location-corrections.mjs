#!/usr/bin/env node
/**
 * Applies clear Google Maps location matches from audit/location-audit.csv.
 *
 * Default: writes audit/location-corrections.csv and
 * audit/location-corrections.sql, but leaves the source data unchanged.
 *
 * --apply: backs up and updates recycling_centres_malaysia_v2_enriched.csv.
 * Regenerate the seed afterwards with `pnpm dlx tsx scripts/convert-csv.ts`,
 * then apply audit/location-corrections.sql to D1.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const AUDIT_PATH = join(ROOT, 'audit', 'location-audit.csv');
const SOURCE_PATH = join(ROOT, 'recycling_centres_malaysia_v2_enriched.csv');
const CORRECTIONS_CSV = join(ROOT, 'audit', 'location-corrections.csv');
const CORRECTIONS_SQL = join(ROOT, 'audit', 'location-corrections.sql');

const GENERIC_NAME =
  /^(Recycling (Point|Container|Centre|Center) (node|way|relation)-|Bin \d+$|Recycling Bin$|Recycling Box$|Recycle Bin|Dump Site$|Pusat Kitar Semula$|Recycling$|Recycling (Centre|Center)$)/i;

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

function readCsvObjects(path) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const headers = rows[0].map((header) => header.replace(/^\ufeff/, ''));
  return {
    headers,
    rows: rows.slice(1).map((values) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = values[index] ?? '';
      });
      return entry;
    }),
  };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(path, headers, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isNamed(row) {
  const issue = String(row.issue ?? '').toLowerCase();
  const name = String(row.name ?? '');
  if (issue.includes('auto-generated osm name')) return false;
  if (issue.includes('not a recycling center')) return false;
  if (GENERIC_NAME.test(name)) return false;
  if (/\b(node|way|relation)-\d+/i.test(name)) return false;
  return true;
}

function main() {
  if (!existsSync(AUDIT_PATH)) throw new Error(`Missing ${AUDIT_PATH}`);
  if (!existsSync(SOURCE_PATH)) throw new Error(`Missing ${SOURCE_PATH}`);

  const audit = readCsvObjects(AUDIT_PATH);
  const source = readCsvObjects(SOURCE_PATH);
  const sourceBySlug = new Map(source.rows.map((row) => [row.slug, row]));

  const eligible = audit.rows.filter((row) => {
    if (!isNamed(row)) return false;
    if (row.status !== 'MATCH') return false;
    if (!['place', 'place-link'].includes(row.coord_source)) return false;
    if (!String(row.google_maps_url ?? '').includes('/maps/place/')) return false;
    const distance = Number(row.distance_m);
    return Number.isFinite(distance) && distance <= 150;
  });

  const corrections = eligible
    .map((row) => {
      const existing = sourceBySlug.get(row.slug);
      if (!existing) return null;
      return {
        slug: row.slug,
        name: row.name,
        google_name: row.google_name,
        distance_m: row.distance_m,
        match_score: row.match_score,
        old_lat: existing.latitude,
        old_lng: existing.longitude,
        new_lat: row.google_lat,
        new_lng: row.google_lng,
        old_google_maps_url: existing.google_maps_url,
        new_google_maps_url: row.google_maps_url,
        coord_source: row.coord_source,
        issue: row.issue,
      };
    })
    .filter(Boolean);

  const headers = [
    'slug',
    'name',
    'google_name',
    'distance_m',
    'match_score',
    'old_lat',
    'old_lng',
    'new_lat',
    'new_lng',
    'old_google_maps_url',
    'new_google_maps_url',
    'coord_source',
    'issue',
  ];
  writeCsv(CORRECTIONS_CSV, headers, corrections);

  const sql = [
    '-- Generated by scripts/apply-location-corrections.mjs',
    '-- Clear Google Maps matches (<=150m) for named centres.',
    ...corrections.map(
      (row) =>
        `UPDATE centers SET latitude = ${Number(row.new_lat)}, longitude = ${Number(
          row.new_lng,
        )}, google_maps_url = ${sqlString(row.new_google_maps_url)} WHERE slug = ${sqlString(
          row.slug,
        )};`,
    ),
    '',
  ].join('\n');
  writeFileSync(CORRECTIONS_SQL, sql, 'utf8');

  console.log(`Clear matches: ${corrections.length}`);
  console.log(`Corrections CSV: ${CORRECTIONS_CSV}`);
  console.log(`Corrections SQL: ${CORRECTIONS_SQL}`);

  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Re-run with --apply to update the source CSV.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(ROOT, 'audit', `recycling_centres_backup_${stamp}.csv`);
  copyFileSync(SOURCE_PATH, backupPath);
  console.log(`Backed up source CSV to ${backupPath}`);

  const bySlug = new Map(corrections.map((row) => [row.slug, row]));
  for (const row of source.rows) {
    const correction = bySlug.get(row.slug);
    if (!correction) continue;
    row.latitude = String(correction.new_lat);
    row.longitude = String(correction.new_lng);
    row.google_maps_url = correction.new_google_maps_url;
  }

  writeCsv(SOURCE_PATH, source.headers, source.rows);
  console.log(`Updated ${CORRECTIONS_CSV} and ${SOURCE_PATH}`);
  console.log('Next: pnpm dlx tsx scripts/convert-csv.ts');
  console.log(
    'Then: pnpm exec wrangler d1 execute kitarsemula-db --remote --file audit/location-corrections.sql',
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
