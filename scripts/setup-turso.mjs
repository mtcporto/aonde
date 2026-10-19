import fs from 'node:fs';
import { RESTAURANTS_DATA as RESTAURANTS, HOTELS_DATA as HOTELS, TIERS_META, TYPE_META } from '../js/data.js';

// 1. Download Blu'nelle image if needed
try {
  const res = await fetch('https://images.sympla.com.br/6ab4fe24d80b3.png', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5000) {
      fs.writeFileSync('img/places/r-11.webp', buf);
      console.log(`Downloaded img/places/r-11.webp (${buf.length} bytes)`);
    }
  }
} catch (err) {
  console.error('Optional Blu\'nelle download skipped:', err.message);
}

// 2. Read .env.local (created in previous run)
const envContent = fs.readFileSync('.env.local', 'utf8');
const dbUrl = envContent.match(/^TURSO_DATABASE_URL=(.+)$/m)?.[1]?.trim();
const dbToken = envContent.match(/^TURSO_AUTH_TOKEN=(.+)$/m)?.[1]?.trim();

if (!dbUrl || !dbToken) {
  throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local');
}

const hostname = dbUrl.replace('libsql://', '');
const httpUrl = `https://${hostname}/v2/pipeline`;

function toHranaArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { type: 'integer', value: String(val) };
    return { type: 'float', value: val };
  }
  return { type: 'text', value: String(val) };
}

async function executePipeline(stmts) {
  const requests = stmts.map(s => ({
    type: 'execute',
    stmt: {
      sql: s.sql,
      args: (s.args || []).map(toHranaArg)
    }
  }));
  requests.push({ type: 'close' });

  const res = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dbToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pipeline HTTP ${res.status}: ${text}`);
  }
  const json = JSON.parse(text);
  for (const r of json.results || []) {
    if (r.type === 'error') {
      throw new Error(`SQL error: ${JSON.stringify(r.error)}`);
    }
  }
  return json;
}

// 3. Apply schema
const schemaSql = fs.readFileSync('db/schema.sql', 'utf8');
const schemaStatements = schemaSql
  .split(';')
  .map(s => s.trim())
  .filter(Boolean)
  .map(sql => ({ sql }));

await executePipeline(schemaStatements);
console.log(`Applied ${schemaStatements.length} schema statements to Turso.`);

// 4. Seed tiers_meta & categories_meta
const metaStmts = [];
for (const [slug, meta] of Object.entries(TIERS_META)) {
  const kind = (slug === 'hoteis-orla' || slug === 'economicos-hostels') ? 'hotel' : 'restaurante';
  metaStmts.push({
    sql: `INSERT OR REPLACE INTO tiers_meta (slug, label, short_label, subtitle, price_hint, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      meta.title || slug,
      meta.badge || meta.title || slug,
      meta.subtitle || '',
      meta.badge || '',
      meta.order || 1,
      kind
    ]
  });
}
for (const [slug, meta] of Object.entries(TYPE_META)) {
  metaStmts.push({
    sql: `INSERT OR REPLACE INTO categories_meta (slug, label, badge_class, icon_svg) VALUES (?, ?, ?, ?)`,
    args: [slug, meta.label || slug, slug, meta.icon || '']
  });
}
await executePipeline(metaStmts);
console.log(`Seeded ${Object.keys(TIERS_META).length} tiers and ${Object.keys(TYPE_META).length} categories.`);

// 5. Seed all 59 places
const allItems = [
  ...RESTAURANTS.map(r => ({
    slugId: `r-${r.id}`,
    numericId: r.id,
    kind: 'restaurante',
    name: r.name,
    category: r.typeLabel,
    typeSlug: r.type,
    tier: r.tier || 'tradicionais',
    price: r.price || '$$',
    neighborhood: r.neighborhood,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    hours: r.hours || '',
    checkin: '',
    checkout: '',
    phone: r.phone || '',
    instagram: r.instagram || '',
    website: r.website || '',
    image: r.image,
    statusNote: r.statusNote || '',
    description: r.description,
    feat: r.feat || {}
  })),
  ...HOTELS.map(h => ({
    slugId: `h-${h.id}`,
    numericId: h.id,
    kind: 'hotel',
    name: h.name,
    category: h.categoryLabel,
    typeSlug: h.category,
    tier: h.tier || 'hoteis-orla',
    price: h.price || '$$$',
    neighborhood: h.neighborhood,
    address: h.address,
    lat: h.lat,
    lon: h.lon,
    hours: `Check-in ${h.checkin || '14h'} · Check-out ${h.checkout || '12h'}`,
    checkin: h.checkin || '14h',
    checkout: h.checkout || '12h',
    phone: h.phone || '',
    instagram: h.instagram || '',
    website: h.website || '',
    image: h.image,
    statusNote: h.statusNote || '',
    description: h.description,
    feat: h.feat || {}
  }))
];

const placeStmts = [{ sql: 'DELETE FROM places', args: [] }];
for (const item of allItems) {
  placeStmts.push({
    sql: `INSERT INTO places (
      id, numeric_id, kind, name, category, type_slug, tier, price,
      neighborhood, address, lat, lon, hours, checkin, checkout,
      phone, instagram, website, image, status_note, description,
      feat_accessible, feat_pet_friendly, feat_kids_space, feat_parking, feat_wifi, feat_pool,
      features_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      item.slugId,
      item.numericId,
      item.kind,
      item.name,
      item.category,
      item.typeSlug,
      item.tier,
      item.price,
      item.neighborhood,
      item.address,
      item.lat,
      item.lon,
      item.hours,
      item.checkin,
      item.checkout,
      item.phone,
      item.instagram,
      item.website,
      item.image,
      item.statusNote,
      item.description,
      item.feat?.accessible ? 1 : 0,
      item.feat?.petFriendly ? 1 : 0,
      item.feat?.kidsSpace ? 1 : 0,
      item.feat?.parking ? 1 : 0,
      item.feat?.wifi ? 1 : 0,
      item.feat?.pool ? 1 : 0,
      JSON.stringify(item.feat || {})
    ]
  });
}

await executePipeline(placeStmts);
console.log(`Seeded ${allItems.length} places into Turso database 'aonde'.`);

// 6. Verify counts from Turso
const verifyRes = await executePipeline([
  { sql: 'SELECT kind, COUNT(*) AS total FROM places GROUP BY kind' },
  { sql: 'SELECT tier, COUNT(*) AS total FROM places GROUP BY tier ORDER BY total DESC' }
]);

const kindRows = verifyRes.results[0].response.result.rows;
const tierRows = verifyRes.results[1].response.result.rows;
console.log('Turso verification - by kind:', JSON.stringify(kindRows));
console.log('Turso verification - by tier:', JSON.stringify(tierRows));
