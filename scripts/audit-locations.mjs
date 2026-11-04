#!/usr/bin/env node
/**
 * Browser-assisted location audit for KitarSemula centres.
 *
 * Usage:
 *   node scripts/audit-locations.mjs --limit 10
 *   node scripts/audit-locations.mjs --slugs bdc-recycle-centre,panasonic
 *   node scripts/audit-locations.mjs --force --limit 5
 *
 * Requires the Browser MCP extension connected to the user's browser. The
 * script writes audit/location-audit.csv incrementally and resumes by slug.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const INPUT_PATH = join(ROOT, 'audit', 'worklist.csv');
const OUTPUT_PATH = join(ROOT, 'audit', 'location-audit.csv');
const LOG_PATH = join(ROOT, 'audit', 'location-audit.log');

const OUTPUT_HEADERS = [
  'priority',
  'slug',
  'name',
  'state',
  'stored_address',
  'stored_lat',
  'stored_lng',
  'issue',
  'query',
  'google_name',
  'google_address',
  'google_lat',
  'google_lng',
  'coord_source',
  'distance_m',
  'match_score',
  'status',
  'google_maps_url',
  'snippet',
  'checked_at',
];

function parseArgs(argv) {
  const args = {
    limit: 10,
    force: false,
    slugs: null,
    server: process.env.BROWSER_MCP_SERVER ?? null,
    mcpHome: process.env.BROWSER_MCP_HOME ?? null,
    minDelay: 6000,
    maxDelay: 8000,
    matchMeters: 150,
    nearMeters: 500,
    namedOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      args.force = true;
      continue;
    }
    if (arg === '--named-only') {
      args.namedOnly = true;
      continue;
    }
    const value = argv[++i];
    if (arg === '--limit') args.limit = Number(value);
    else if (arg === '--slugs')
      args.slugs = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (arg === '--server') args.server = value;
    else if (arg === '--mcp-home') args.mcpHome = value;
    else if (arg === '--min-delay') args.minDelay = Number(value);
    else if (arg === '--max-delay') args.maxDelay = Number(value);
    else if (arg === '--match-meters') args.matchMeters = Number(value);
    else if (arg === '--near-meters') args.nearMeters = Number(value);
  }
  return args;
}

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

function readCsvObjects(path) {
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.replace(/^\ufeff/, ''));
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, line + '\n', { encoding: 'utf8', flag: 'a' });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function applyDistance(row, center, args) {
  const storedLat = Number(center.lat);
  const storedLng = Number(center.lng);
  const googleLat = Number(row.google_lat);
  const googleLng = Number(row.google_lng);
  if (
    !Number.isFinite(storedLat) ||
    !Number.isFinite(storedLng) ||
    !Number.isFinite(googleLat) ||
    !Number.isFinite(googleLng)
  ) {
    row.status = 'NO_STORED_COORD';
    return;
  }
  const distance = haversineMeters(storedLat, storedLng, googleLat, googleLng);
  row.distance_m = distance;
  if (distance <= args.matchMeters) row.status = 'MATCH';
  else if (distance <= args.nearMeters) row.status = 'NEAR';
  else row.status = 'MISMATCH';
}

function isGenericName(name) {
  return (
    /\b(node|way|relation)-\d+/i.test(name) ||
    /^Recycling (Point|Container|Centre|Center) (node|way|relation)-/i.test(name) ||
    /^Bin \d+$/i.test(name) ||
    /^Recycling Bin$/i.test(name) ||
    /^Recycling Box$/i.test(name) ||
    /^Recycle Bin/i.test(name) ||
    /^Drop ?off$/i.test(name) ||
    /^Dump Site$/i.test(name) ||
    /^Pusat Kitar Semula$/i.test(name) ||
    /^Recycling$/i.test(name) ||
    /^Recycle (Centre|Center)$/i.test(name) ||
    /^Recycling (Centre|Center)$/i.test(name)
  );
}

const NAME_STOPWORDS = new Set([
  'sdn',
  'bhd',
  'enterprise',
  'trading',
  'recycle',
  'recycling',
  'centre',
  'center',
  'co',
  'company',
  'the',
  'and',
  'of',
]);

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\brecycle\b/g, 'recycling')
    .replace(/\bcentre\b/g, 'center')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return [
    ...new Set(
      normalize(value)
        .split(' ')
        .filter((token) => token.length >= 2),
    ),
  ];
}

function scoreLink(center, link) {
  const linkText = normalize(`${link.text ?? ''} ${link.ariaLabel ?? ''}`);
  const nameTokens = tokens(center.name).filter((token) => !NAME_STOPWORDS.has(token));
  const addressTokens = tokens(center.address).slice(0, 10);
  const fullName = normalize(center.name);

  const nameHits = nameTokens.filter((token) => linkText.includes(token));
  const nameScore = nameTokens.length > 0 ? nameHits.length / nameTokens.length : 0;
  const fullMatch = fullName.length >= 4 && linkText.includes(fullName) ? 1 : 0;
  const addressHits = addressTokens.filter((token) => linkText.includes(token));
  const addressScore =
    addressTokens.length > 0 ? addressHits.length / Math.min(addressTokens.length, 5) : 0;

  return {
    score: nameScore * 3 + fullMatch * 2 + addressScore,
    nameScore,
    fullMatch,
    addressScore,
    nameHits,
    addressHits,
  };
}

function chooseBestLink(center, links) {
  const scored = (links ?? [])
    .map((link) => ({ link, ...scoreLink(center, link) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  if (best.nameScore < 0.6 && !best.fullMatch) return null;
  return best;
}

function parsePlaceCoords(url) {
  const place = String(url ?? '').match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  return place ? { lat: Number(place[1]), lng: Number(place[2]) } : null;
}

function isUsefulPage(page) {
  if (!page) return false;
  const url = page.url ?? '';
  if (/\/maps\/place\//.test(url) && parseCoords(url)) return true;
  return Array.isArray(page.links) && page.links.length > 0;
}

function parseEvalOutput(output) {
  const jsonLines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'));
  if (jsonLines.length === 0) return null;
  try {
    return JSON.parse(jsonLines[jsonLines.length - 1]);
  } catch {
    return null;
  }
}

function buildQuery(center) {
  const name = (center.name ?? '').trim();
  const address = (center.address ?? '').trim();
  const state = (center.state ?? '').trim();
  if (!name || isGenericName(name)) {
    return address || `${state} recycling centre`;
  }
  if (address) return `${name}, ${address}`;
  return `${name}, ${state}`;
}

function parseCoords(url) {
  const place = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]), source: 'place' };
  const center = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (center) return { lat: Number(center[1]), lng: Number(center[2]), source: 'map-center' };
  return null;
}

function cleanMapsUrl(url) {
  return String(url).split('?')[0];
}

class BrowserMcp {
  constructor({ server, mcpHome }) {
    this.server = server;
    this.mcpHome = mcpHome;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.child = null;
  }

  async start() {
    const env = { ...process.env };
    if (this.mcpHome) env.BROWSER_MCP_HOME = this.mcpHome;
    if (this.server) {
      this.child = spawn(process.execPath, [this.server], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } else {
      this.child = spawn('npx', ['-y', '@browsermcp/mcp@latest'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        shell: true,
      });
    }
    this.child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) log(`browsermcp: ${text}`);
    });
    this.child.on('exit', (code) => log(`browsermcp exited with code ${code}`));
    this.child.stdout.on('data', (chunk) => this.onData(chunk));
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'kitar-semula-location-audit', version: '1.0.0' },
    });
  }

  onData(chunk) {
    this.buffer += chunk.toString();
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          pending.resolve(message);
        }
      } catch {
        // Ignore non-JSON lines from the server.
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    this.child.stdin.write(message + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, 300000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  async browser(commands) {
    const response = await this.send('tools/call', {
      name: 'browser',
      arguments: { commands },
    });
    if (response.error) throw new Error(JSON.stringify(response.error));
    const text = (response.result?.content ?? [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
    if (/Click Allow in the Browser MCP extension/i.test(text)) {
      throw new Error(text);
    }
    return text;
  }

  close() {
    this.child?.kill();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputRows = readCsvObjects(INPUT_PATH);
  if (inputRows.length === 0) throw new Error(`No rows found in ${INPUT_PATH}`);

  const existingRows = readCsvObjects(OUTPUT_PATH);
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
  const processed = new Set(existingRows.map((row) => row.slug));

  let pending = inputRows;
  if (args.slugs) {
    const wanted = new Set(args.slugs);
    pending = pending.filter((row) => wanted.has(row.slug));
  }
  if (args.namedOnly) {
    pending = pending.filter((row) => {
      const issue = (row.issue ?? '').toLowerCase();
      if (issue.includes('auto-generated osm name')) return false;
      if (issue.includes('not a recycling center')) return false;
      return !isGenericName((row.name ?? '').trim());
    });
  }
  if (!args.force) pending = pending.filter((row) => !processed.has(row.slug));
  pending = pending.slice(0, args.limit);

  if (pending.length === 0) {
    log('Nothing to audit. Use --force to re-check already processed centres.');
    return;
  }

  log(`Auditing ${pending.length} centre(s) with Browser MCP. Output: ${OUTPUT_PATH}`);
  const browser = new BrowserMcp({ server: args.server, mcpHome: args.mcpHome });
  await browser.start();

  let tabId = null;
  try {
    const tabOutput = await browser.browser('tab new about:blank');
    const match = tabOutput.match(/tab (\d+)/);
    if (!match) throw new Error(`Could not create browser tab: ${tabOutput}`);
    tabId = match[1];
    log(`Using browser tab ${tabId}`);

    for (let index = 0; index < pending.length; index++) {
      const center = pending[index];
      const query = buildQuery(center);
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
      const delay = Math.round(args.minDelay + Math.random() * (args.maxDelay - args.minDelay));
      const evalExpression = `() => ({url: location.href, title: document.title, h1: document.querySelector('h1')?.textContent ?? null, address: document.querySelector('[data-item-id=address]')?.textContent ?? null, snippet: document.body.innerText.slice(0, 1200), links: Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/maps/place/')).slice(0, 10).map(a => ({href: a.href, text: (a.innerText || '').trim().slice(0, 200), ariaLabel: (a.getAttribute('aria-label') || '').slice(0, 300)}))})`;

      const commands = [
        `tab select ${tabId}`,
        `goto ${searchUrl}`,
        `wait ${delay}`,
        `eval "${evalExpression}"`,
      ].join('\n');

      const startedAt = new Date().toISOString();
      let page = null;
      let error = null;
      try {
        const output = await browser.browser(commands);
        page = parseEvalOutput(output);
        if (!page) error = output.trim().slice(0, 500);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      if (!isUsefulPage(page)) {
        try {
          const retryOutput = await browser.browser(
            `tab select ${tabId}\nwait 3000\neval "${evalExpression}"`,
          );
          const retryPage = parseEvalOutput(retryOutput);
          if (isUsefulPage(retryPage) || !page) page = retryPage ?? page;
        } catch (retryErr) {
          if (!error) error = retryErr instanceof Error ? retryErr.message : String(retryErr);
        }
      }

      const row = {
        priority: center.priority ?? '',
        slug: center.slug ?? '',
        name: center.name ?? '',
        state: center.state ?? '',
        stored_address: center.address ?? '',
        stored_lat: center.lat ?? '',
        stored_lng: center.lng ?? '',
        issue: center.issue ?? '',
        query,
        google_name: '',
        google_address: '',
        google_lat: '',
        google_lng: '',
        coord_source: '',
        distance_m: '',
        match_score: '',
        status: 'ERROR',
        google_maps_url: '',
        snippet: '',
        checked_at: startedAt,
      };

      if (page) {
        const pageUrl = page.url ?? '';
        const pageCoords = parseCoords(pageUrl);
        const isPlacePage = /\/maps\/place\//.test(pageUrl);
        const pageText = `${page.title ?? ''} ${page.h1 ?? ''} ${page.snippet ?? ''}`;

        row.snippet = String(page.snippet ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 500);

        if (/unusual traffic|captcha|robot check|verify you are human/i.test(pageText)) {
          row.google_name = page.h1 ?? '';
          row.google_address = page.address ?? '';
          row.google_maps_url = cleanMapsUrl(pageUrl);
          row.status = 'CAPTCHA';
        } else if (isPlacePage && pageCoords) {
          row.google_name = page.h1 ?? '';
          row.google_address = page.address ?? '';
          row.google_maps_url = cleanMapsUrl(pageUrl);
          row.google_lat = pageCoords.lat;
          row.google_lng = pageCoords.lng;
          row.coord_source = 'place';
          row.match_score = '1.00';
          applyDistance(row, center, args);
        } else {
          const best = chooseBestLink(center, page.links);
          const linkCoords = best ? parsePlaceCoords(best.link.href) : null;
          if (best && linkCoords) {
            row.google_name = (best.link.text || page.h1 || '').trim();
            row.google_address = page.address ?? '';
            row.google_maps_url = cleanMapsUrl(best.link.href);
            row.google_lat = linkCoords.lat;
            row.google_lng = linkCoords.lng;
            row.coord_source = 'place-link';
            row.match_score = best.score.toFixed(2);
            applyDistance(row, center, args);
          } else {
            row.google_name = page.h1 ?? '';
            row.google_address = page.address ?? '';
            row.google_maps_url = cleanMapsUrl(pageUrl);
            row.status = 'NO_PLACE';
          }
        }
      } else if (error) {
        row.snippet = error;
      }

      existingBySlug.set(row.slug, row);
      processed.add(row.slug);
      const ordered = inputRows
        .filter((input) => existingBySlug.has(input.slug))
        .map((input) => existingBySlug.get(input.slug));
      writeCsv(OUTPUT_PATH, OUTPUT_HEADERS, ordered);

      log(
        `${index + 1}/${pending.length} ${row.slug} -> ${row.status}` +
          (row.distance_m !== '' ? ` (${row.distance_m}m)` : '') +
          ` | ${row.google_name || row.snippet.slice(0, 80)}`,
      );

      if (row.status === 'CAPTCHA') {
        log('Google Maps returned a CAPTCHA. Stopping so the browser can be checked manually.');
        break;
      }
    }
  } finally {
    if (tabId) {
      try {
        await browser.browser(`tab select ${tabId}\ntab close`);
      } catch {
        // Tab may already be closed, or selecting it failed; leave it alone.
      }
    }
    browser.close();
  }

  const finalRows = readCsvObjects(OUTPUT_PATH);
  const counts = finalRows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  log(`Audit complete: ${JSON.stringify(counts)}`);
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
