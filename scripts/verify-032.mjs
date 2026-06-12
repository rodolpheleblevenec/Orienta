import { readFileSync } from 'node:fs'
import pg from 'pg'

function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('='); if (i === -1) continue
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}
const env = loadEnv()
const client = new pg.Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com', port: 5432,
  user: 'postgres.baqvosadoijsvvelugmp', password: env.SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await client.connect()

const cols = await client.query(`select column_name from information_schema.columns
  where table_name='orienta_users' and column_name in ('equipped_theme','status_text','rename_tokens') order by 1`)
console.log('Colonnes:', cols.rows.map(r => r.column_name).join(', '))

const items = await client.query(`select code, active, cost_jetons from orienta_shop_items
  where code in ('frame_laurel','frame_crown','theme_ocean','theme_coral','theme_abyss','status_custom','rename_token','unlock_all_difficulties','title_explorer','boost_grid')
  order by active desc, code`)
console.log('Articles:')
for (const r of items.rows) console.log(`  ${r.active ? '✓ actif  ' : '✗ inactif'} ${r.code} (${r.cost_jetons})`)

const fns = ['rename_user(uuid,text)','set_user_status(uuid,text)','purchase_item(uuid,text)','equip_unlock(uuid,text,boolean)']
console.log('Grants (anon / authenticated doivent être false):')
for (const f of fns) {
  const a = await client.query(`select has_function_privilege('anon', 'public.${f}', 'EXECUTE') as anon,
                                       has_function_privilege('authenticated', 'public.${f}', 'EXECUTE') as auth`)
  console.log(`  ${f}: anon=${a.rows[0].anon} authenticated=${a.rows[0].auth}`)
}
await client.end()
