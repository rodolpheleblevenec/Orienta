// Applique un fichier de migration SQL sur la base Supabase via le pooler (port 5432).
// Lit SUPABASE_DB_PASSWORD depuis .env (jamais en dur). Méthode retenue car
// `supabase db push` échoue (historique migrations timestamp vs 00X_).
//
// Usage : node scripts/apply-migration.mjs supabase/migrations/032_boutique_comfort.sql
import { readFileSync } from 'node:fs'
import pg from 'pg'

const PROJECT_REF = 'baqvosadoijsvvelugmp'

function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i === -1) continue
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <fichier.sql>'); process.exit(1) }

const env = loadEnv()
const password = env.SUPABASE_DB_PASSWORD
if (!password) { console.error('SUPABASE_DB_PASSWORD absent de .env'); process.exit(1) }

const sql = readFileSync(file, 'utf8')

const client = new pg.Client({
  host: `aws-0-eu-west-1.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${PROJECT_REF}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log(`→ Application de ${file} …`)
  await client.query(sql)
  console.log('✅ Migration appliquée avec succès.')
} catch (e) {
  console.error('❌ Échec :', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
