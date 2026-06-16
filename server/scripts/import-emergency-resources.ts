/**
 * import-emergency-resources.ts
 * Imports Michigan emergency resources from a CSV file into the
 * EmergencyResource table (upsert by deterministic slug ID).
 *
 * Usage:
 *   cd server
 *   npm run import:resources                       # uses the bundled template
 *   npm run import:resources -- ../data/my.csv     # custom CSV path
 *   npm run import:resources -- --dry-run ../data/my.csv
 *
 * CSV columns (header required, order-independent):
 *   name,type,agency,county,phone,address,latitude,longitude,jurisdiction,resourceCategory
 *
 * Behavior:
 *   - Validates required fields (name, county, latitude, longitude; type OR resourceCategory).
 *   - Validates latitude/longitude are finite numbers in valid ranges.
 *   - Maps the dataset's resourceCategory to a normalized ResourceType.
 *   - Upserts each row by a slug derived from the resource name.
 *   - Prints a per-row + aggregate import summary; never throws on a bad row.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── CSV parsing (RFC 4180-ish, handles quoted fields with commas) ────────────

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  // Normalize line endings
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { record.push(field); field = ''; }
    else if (ch === '\n') {
      record.push(field); field = '';
      // Skip fully empty lines
      if (record.some((c) => c.trim() !== '')) rows.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  // Trailing field/record (no final newline)
  if (field !== '' || record.length > 0) {
    record.push(field);
    if (record.some((c) => c.trim() !== '')) rows.push(record);
  }

  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => { obj[key] = (cols[idx] ?? '').trim(); });
    return obj;
  });
}

// ─── Slug + type normalization ────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Maps a free-text resourceCategory/type to the mobile SDK's ResourceType set.
 * Falls back to a snake_cased version of the raw value if no mapping matches.
 */
function normalizeType(rawType: string, rawCategory: string): string {
  const v = `${rawCategory} ${rawType}`.toLowerCase();

  if (v.includes('coast guard'))            return 'coast_guard';
  if (v.includes('sheriff'))                return 'county_sheriff';
  if (v.includes('state police') || v.includes('msp')) return 'state_police';
  if (v.includes('hospital') || v.includes('emergency department') || v.includes('medical center')) return 'hospital';
  if (v.includes('ems') || v.includes('ambulance')) return 'fire_station';
  if (v.includes('ranger') || v.includes('forest')) return 'ranger_station';
  if (v.includes('marina') || v.includes('harbor')) return 'marina';
  if (v.includes('state park') || v.includes('park office')) return 'trailhead_office';
  if (v.includes('dnr') || v.includes('natural resources')) return 'dnr_post';
  if (v.includes('search and rescue') || v.includes('sar')) return 'search_and_rescue';

  const fallback = (rawCategory || rawType || 'other')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return fallback || 'other';
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ParsedRow {
  id: string;
  name: string;
  type: string;
  phone: string;
  county: string;
  latitude: number;
  longitude: number;
  address: string | null;
  agency: string | null;
  jurisdiction: string | null;
  resourceCategory: string | null;
}

interface RowError { line: number; name: string; reason: string }

function validateRow(raw: Record<string, string>, line: number): ParsedRow | RowError {
  const name   = raw.name?.trim() ?? '';
  const county = raw.county?.trim() ?? '';
  const type   = raw.type?.trim() ?? '';
  const category = raw.resourceCategory?.trim() ?? '';

  if (!name)   return { line, name: name || '(blank)', reason: 'missing name' };
  if (!county) return { line, name, reason: 'missing county' };
  if (!type && !category) return { line, name, reason: 'missing type and resourceCategory' };

  const latitude  = Number(raw.latitude);
  const longitude = Number(raw.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { line, name, reason: `invalid coordinates (lat="${raw.latitude}", lng="${raw.longitude}")` };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { line, name, reason: `coordinates out of range (lat=${latitude}, lng=${longitude})` };
  }

  return {
    id: slugify(name),
    name,
    type: normalizeType(type, category),
    phone: raw.phone?.trim() || 'N/A',
    county,
    latitude,
    longitude,
    address: raw.address?.trim() || null,
    agency: raw.agency?.trim() || null,
    jurisdiction: raw.jurisdiction?.trim() || null,
    resourceCategory: category || type || null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathArg = args.find((a) => !a.startsWith('--'));

  const defaultPath = resolve(__dirname, '../../data/michigan_emergency_resources.template.csv');
  const csvPath = pathArg ? resolve(process.cwd(), pathArg) : defaultPath;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Michigan Emergency Resource Import');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Source : ${csvPath}`);
  console.log(`  Mode   : ${dryRun ? 'DRY RUN (no DB writes)' : 'WRITE'}`);
  console.log('');

  if (!existsSync(csvPath)) {
    console.error(`✖ CSV file not found: ${csvPath}`);
    process.exitCode = 1;
    return;
  }

  const rawRows = parseCsv(readFileSync(csvPath, 'utf-8'));
  if (rawRows.length === 0) {
    console.error('✖ CSV contains no data rows.');
    process.exitCode = 1;
    return;
  }

  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seenIds = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const line = idx + 2; // +1 for header, +1 for 1-based
    const result = validateRow(raw, line);
    if ('reason' in result) { errors.push(result); return; }
    if (seenIds.has(result.id)) {
      errors.push({ line, name: result.name, reason: `duplicate id "${result.id}" within CSV` });
      return;
    }
    seenIds.add(result.id);
    valid.push(result);
  });

  let created = 0;
  let updated = 0;
  const failed: RowError[] = [];

  if (!dryRun) {
    for (const r of valid) {
      try {
        const existing = await prisma.emergencyResource.findUnique({ where: { id: r.id }, select: { id: true } });
        await prisma.emergencyResource.upsert({
          where: { id: r.id },
          create: {
            id: r.id, name: r.name, type: r.type, phone: r.phone, county: r.county,
            latitude: r.latitude, longitude: r.longitude, address: r.address,
            agency: r.agency, jurisdiction: r.jurisdiction, resourceCategory: r.resourceCategory,
          },
          update: {
            name: r.name, type: r.type, phone: r.phone, county: r.county,
            latitude: r.latitude, longitude: r.longitude, address: r.address,
            agency: r.agency, jurisdiction: r.jurisdiction, resourceCategory: r.resourceCategory,
          },
        });
        if (existing) updated++; else created++;
      } catch (err) {
        failed.push({ line: 0, name: r.name, reason: err instanceof Error ? err.message : 'db error' });
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('  Validation:');
  console.log(`    Rows read     : ${rawRows.length}`);
  console.log(`    Valid         : ${valid.length}`);
  console.log(`    Rejected      : ${errors.length}`);
  if (!dryRun) {
    console.log('');
    console.log('  Database:');
    console.log(`    Created       : ${created}`);
    console.log(`    Updated       : ${updated}`);
    console.log(`    Write errors  : ${failed.length}`);
  }

  if (errors.length > 0) {
    console.log('');
    console.log('  Rejected rows:');
    for (const e of errors) console.log(`    • line ${e.line} "${e.name}" — ${e.reason}`);
  }
  if (failed.length > 0) {
    console.log('');
    console.log('  Write errors:');
    for (const e of failed) console.log(`    • "${e.name}" — ${e.reason}`);
  }

  // Category breakdown of valid rows
  const byType = valid.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log('');
  console.log('  By normalized type:');
  Object.entries(byType).sort().forEach(([t, n]) => console.log(`    ${t.padEnd(20)} ${n}`));

  console.log('');
  console.log(dryRun ? '✓ Dry run complete (no changes written).' : '✓ Import complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (errors.length > 0 || failed.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('✖ Import failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
