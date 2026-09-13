/**
 * One-off CSV → lib/seed-data.ts converter.
 *
 * Usage:
 *   pnpm exec tsx scripts/convert-csv.ts
 *
 * Reads recycling_centres_malaysia_v2_enriched.csv, cleans each row, and
 * writes lib/seed-data.ts conforming to the RecyclingCenter type.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CenterStatus,
  OpeningHours,
  RecyclableCategory,
  RecyclingCenter,
  VerificationStatus,
} from '../lib/types';

const CSV_PATH = join(process.cwd(), 'recycling_centres_malaysia_v2_enriched.csv');
const OUT_PATH = join(process.cwd(), 'lib/seed-data.ts');

// ---------------------------------------------------------------------------
// CSV parser (RFC-4180-ish, handles quoted fields with embedded commas)
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
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
    } else {
      if (ch === '"') {
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
        // ignore — handled by \n
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

// ---------------------------------------------------------------------------
// State normalization
// ---------------------------------------------------------------------------
const STATE_ALIASES: Record<string, string> = {
  'kuala lumpur': 'Kuala Lumpur',
  'selangor': 'Selangor',
  'penang': 'Penang',
  'pulau pinang': 'Penang',
  'johor': 'Johor',
  'perak': 'Perak',
  'melaka': 'Melaka',
  'malacca': 'Melaka',
  'negeri sembilan': 'Negeri Sembilan',
  'pahang': 'Pahang',
  'kedah': 'Kedah',
  'kelantan': 'Kelantan',
  'terengganu': 'Terengganu',
  'perlis': 'Perlis',
  'sabah': 'Sabah',
  'sarawak': 'Sarawak',
  'putrajaya': 'Putrajaya',
  'labuan': 'Labuan',
};

function normalizeState(raw: string): string {
  const key = raw.trim().toLowerCase();
  return STATE_ALIASES[key] ?? raw.trim();
}

// ---------------------------------------------------------------------------
// Accepted-items mapping
// ---------------------------------------------------------------------------
const ITEM_MAP: Record<string, RecyclableCategory> = {
  paper: 'Paper',
  cardboard: 'Cardboard',
  plastic: 'Plastic',
  'plastic bottles': 'Plastic',
  'plastic packaging': 'Plastic',
  glass: 'Glass',
  'glass bottles': 'Glass',
  cans: 'Aluminium',
  aluminium: 'Aluminium',
  'scrap metal': 'Metal',
  metal: 'Metal',
  'used clothes': 'Used Clothes',
  shoes: 'Used Clothes',
  bags: 'Used Clothes',
  'cooking oil': 'Cooking Oil',
  batteries: 'Batteries',
  'light bulbs': 'Light Bulbs',
  'printer cartridges': 'Printer Cartridges',
  'e-waste': 'E-Waste',
  'electrical appliances': 'E-Waste',
  electronics: 'E-Waste',
  'mobile phones': 'E-Waste',
  furniture: 'Furniture',
  'green waste': 'General Recycling',
};

function mapAcceptedItems(raw: string): RecyclableCategory[] {
  if (!raw) return [];
  const items = raw.split('|').map((s) => s.trim()).filter(Boolean);
  const mapped: RecyclableCategory[] = [];
  const seen = new Set<RecyclableCategory>();
  for (const item of items) {
    const key = item.toLowerCase();
    const cat = ITEM_MAP[key];
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      mapped.push(cat);
    }
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Tags cleaning
// ---------------------------------------------------------------------------
function cleanTags(raw: string): string[] {
  if (!raw) return [];
  const tags = raw.split('|').map((s) => s.trim()).filter(Boolean);
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (let tag of tags) {
    // Strip "Class:" prefix
    tag = tag.replace(/^Class:/i, '');
    // Skip generic noise
    const lower = tag.toLowerCase();
    if (
      ['container', 'centre', 'center', 'bin/container', 'drop-off', 'private scrapyard', 'e-waste'].includes(
        lower,
      )
    ) {
      continue;
    }
    // Skip numeric-only
    if (/^\d+$/.test(tag)) continue;
    // Skip phone-number-looking
    if (/^\+?\d[\d\s\-/|;]+$/.test(tag)) continue;
    // Skip URLs
    if (/^https?:\/\//i.test(tag)) continue;
    // Skip Chinese-only tags (keep mixed/English)
    if (/[\u4e00-\u9fff]/.test(tag) && !/[a-zA-Z]/.test(tag)) continue;
    // Skip OSM metadata
    if (/^(reverse_geocoded|website_fetch_error|osm_source|website_phone|classification)/i.test(tag)) continue;
    // Skip very long tags (likely noise)
    if (tag.length > 60) continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(tag);
    }
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Opening hours parsing (OSM format → OpeningHours with en-dash)
// ---------------------------------------------------------------------------
const DAY_MAP: Record<string, keyof OpeningHours> = {
  mo: 'monday',
  tu: 'tuesday',
  we: 'wednesday',
  th: 'thursday',
  fr: 'friday',
  sa: 'saturday',
  su: 'sunday',
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  let hour = h;
  const min = m || 0;
  const period = hour < 12 ? 'AM' : 'PM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${pad(hour)}:${pad(min)} ${period}`;
}

function parseTimeRange(range: string): string | null {
  // "09:00-18:00" → "9:00 AM – 6:00 PM"
  const m = range.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = `${pad(Number(m[1]))}:${m[2]}`;
  const end = `${pad(Number(m[3]))}:${m[4]}`;
  return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

function expandDayRange(dayRange: string): (keyof OpeningHours)[] {
  // "Mo-Sa", "Mo", "Mo-We,Fr"
  const parts = dayRange.split(',');
  const days: (keyof OpeningHours)[] = [];
  for (const part of parts) {
    const rangeMatch = part.match(/^([a-z]{2})-([a-z]{2})$/i);
    if (rangeMatch) {
      const start = rangeMatch[1].toLowerCase();
      const end = rangeMatch[2].toLowerCase();
      const order: (keyof OpeningHours)[] = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      const si = order.indexOf(DAY_MAP[start]);
      const ei = order.indexOf(DAY_MAP[end]);
      if (si !== -1 && ei !== -1) {
        for (let i = si; i <= ei; i++) days.push(order[i]);
      }
    } else {
      const single = DAY_MAP[part.toLowerCase()];
      if (single) days.push(single);
    }
  }
  return days;
}

function parseOpeningHours(raw: string): OpeningHours {
  const hours: OpeningHours = {};
  if (!raw) return hours;

  const value = raw.trim();

  // 24/7
  if (value.toLowerCase() === '24/7') {
    const all: (keyof OpeningHours)[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    for (const d of all) {
      hours[d] = '12:00 AM \u2013 11:59 PM';
    }
    return hours;
  }

  // Split on ";" for multiple rules, take the first (ignore "PH off" etc.)
  const rules = value.split(';').map((r) => r.trim()).filter(Boolean);
  for (const rule of rules) {
    // Skip "PH off", "PH open", etc.
    if (/^(ph|public holiday)/i.test(rule)) continue;

    // Match "Mo-Sa 09:00-18:00" or "Mo 09:00-18:00" or "Mo-Fr 08:00-12:00,13:00-17:00"
    const dayTimeMatch = rule.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+(.+)$/);
    if (!dayTimeMatch) continue;

    const days = expandDayRange(dayTimeMatch[1]);
    const timePart = dayTimeMatch[2].trim();

    // timePart could be "09:00-18:00" or "08:00-12:00,13:00-17:00"
    const ranges = timePart.split(',').map((r) => r.trim());
    const formatted = ranges
      .map(parseTimeRange)
      .filter((r): r is string => r !== null)
      .join(', ');

    if (formatted) {
      for (const d of days) {
        hours[d] = formatted;
      }
    }
  }

  return hours;
}

// ---------------------------------------------------------------------------
// Phone validation
// ---------------------------------------------------------------------------
function cleanPhone(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  // Reject Facebook token fragments and multi-value junk
  if (trimmed.includes('|')) return undefined;
  if (trimmed.includes(';')) return undefined;
  // Must contain at least some digits and not look like a URL
  if (/^https?:\/\//i.test(trimmed)) return undefined;
  // A phone should be mostly digits, spaces, +, -, ()
  if (!/^\+?[\d\s\-()]{6,}$/ .test(trimmed)) return undefined;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Website URL cleaning
// ---------------------------------------------------------------------------
function cleanWebsite(raw: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Notes cleaning
// ---------------------------------------------------------------------------
function cleanNotes(raw: string): string | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      if (/^reverse_geocoded/i.test(s)) return false;
      if (/^website_fetch_error/i.test(s)) return false;
      if (/^osm_source/i.test(s)) return false;
      if (/^website_phone/i.test(s)) return false;
      if (/^classification=/i.test(s)) return false;
      return true;
    });
  return parts.length > 0 ? parts.join('; ') : undefined;
}

// ---------------------------------------------------------------------------
// Status determination
// ---------------------------------------------------------------------------
function deriveStatus(notes: string | undefined): CenterStatus {
  if (notes && /not a general purpose/i.test(notes)) return 'UNKNOWN';
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------
function main() {
  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    console.error('CSV has no data rows');
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim());
  const colIndex: Record<string, number> = {};
  header.forEach((h, i) => {
    colIndex[h] = i;
  });

  const dataRows = rows.slice(1);
  const centers: RecyclingCenter[] = [];
  const seenSlugs = new Set<string>();

  let skipped = 0;

  for (const row of dataRows) {
    const get = (col: string): string => {
      const idx = colIndex[col];
      return idx != null && idx < row.length ? row[idx] : '';
    };

    const id = get('id');
    const slug = get('slug');
    const name = get('name');
    const latStr = get('latitude');
    const lngStr = get('longitude');

    // Skip rows missing coordinates
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }

    // Skip empty names
    if (!name.trim()) {
      skipped++;
      continue;
    }

    // Deduplicate slugs
    let finalSlug = slug;
    if (seenSlugs.has(finalSlug)) {
      finalSlug = `${slug}-${id}`;
    }
    seenSlugs.add(finalSlug);

    const rawNotes = get('notes');
    const notes = cleanNotes(rawNotes);
    const state = normalizeState(get('state'));
    const acceptedItems = mapAcceptedItems(get('accepted_items'));
    const tags = cleanTags(get('tags'));
    const openingHours = parseOpeningHours(get('opening_hours'));
    const phone = cleanPhone(get('phone'));
    const website = cleanWebsite(get('website_url'));
    const googleMapsUrl = get('google_maps_url') || undefined;
    const status = deriveStatus(notes);
    const createdAt = get('created_at') || new Date().toISOString();
    const updatedAt = get('updated_at') || createdAt;

    centers.push({
      id: id,
      slug: finalSlug,
      name: name,
      address: get('address'),
      state: state,
      area: get('area') || '',
      latitude: lat,
      longitude: lng,
      ...(phone ? { phone } : {}),
      ...(website ? { website_url: website } : {}),
      ...(googleMapsUrl ? { google_maps_url: googleMapsUrl } : {}),
      accepted_items: acceptedItems,
      tags: tags,
      opening_hours: openingHours,
      status: status,
      verification_status: 'UNVERIFIED' as VerificationStatus,
      upvote_count: 0,
      downvote_count: 0,
      ...(notes ? { notes } : {}),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  // Generate TypeScript output
  const jsonStr = JSON.stringify(centers, null, 2);
  const output = `import type { RecyclingCenter } from './types';\n\nexport const SEED_CENTERS: RecyclingCenter[] = ${jsonStr};\n`;

  writeFileSync(OUT_PATH, output, 'utf-8');
  console.log(`Wrote ${centers.length} centers to ${OUT_PATH}`);
  console.log(`Skipped ${skipped} rows (missing coords or name)`);
}

main();