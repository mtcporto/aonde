import fs from 'node:fs';
import { createClient } from '@libsql/client';

// Load .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/^TURSO_DATABASE_URL=(.+)$/m)?.[1]?.trim();
const authToken = envText.match(/^TURSO_AUTH_TOKEN=(.+)$/m)?.[1]?.trim();

if (!url || !authToken) {
  throw new Error('Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no .env.local');
}

// Also fetch official Maison Blu'nelle dish photo from blunelle.com origin if needed
try {
  const res = await fetch(
    'https://blunelle.com/wp-content/uploads/2018/12/EDUCOSTAFotografia-casamentosecasas-provadecomida-MaysaeArmando-292.jpg',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5000) {
      fs.writeFileSync('img/places/r-11.webp', buf);
      console.log(`Updated img/places/r-11.webp from blunelle.com (${buf.length} bytes)`);
    }
  }
} catch {}

const client = createClient({ url, authToken });

const totalRes = await client.execute('SELECT COUNT(*) AS total FROM places');
const byKindRes = await client.execute('SELECT kind, COUNT(*) AS count FROM places GROUP BY kind');
const byTierRes = await client.execute('SELECT tier, COUNT(*) AS count FROM places GROUP BY tier ORDER BY count DESC');
const sampleRes = await client.execute(
  "SELECT id, name, image, tier, price FROM places WHERE id IN ('r-14', 'r-23', 'r-48') ORDER BY id"
);

console.log('=== TURSO DATABASE CHECK (aonde) ===');
console.log('URL:', url);
console.log('Total places:', totalRes.rows[0]?.total);
console.log('By kind:', byKindRes.rows);
console.log('By tier:', byTierRes.rows);
console.log('Canoa / Estaleiro / Nau records in Turso:', sampleRes.rows);
