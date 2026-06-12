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
const URL_BASE = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY

const client = new pg.Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com', port: 5432,
  user: 'postgres.baqvosadoijsvvelugmp', password: env.SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await client.connect()
const { rows } = await client.query(`select id, pseudo, rename_tokens, status_text from orienta_users where pseudo = 'Rodolphe LE BLEVENEC' limit 1`)
await client.end()
const me = rows[0]
console.log('Rodolphe:', me?.id, '| rename_tokens =', me?.rename_tokens, '| status =', me?.status_text)

async function call(body) {
  const r = await fetch(`${URL_BASE}/functions/v1/shop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body),
  })
  return { status: r.status, json: await r.json() }
}

const list = await call({ action: 'list', user_id: me.id })
console.log('\n[list] status', list.status)
console.log('  counters:', JSON.stringify(list.json.counters))
console.log('  equipped:', JSON.stringify(list.json.equipped))
console.log('  status:', JSON.stringify(list.json.status))
const codes = (list.json.items || []).map(i => i.code)
console.log('  items contient frame_laurel/frame_crown/themes/status_custom/rename_token ?',
  ['frame_laurel','frame_crown','theme_ocean','status_custom','rename_token'].every(c => codes.includes(c)))
console.log('  items NE contient PAS boost_grid/unlock_all_difficulties/title_explorer ?',
  !codes.some(c => ['boost_grid','unlock_all_difficulties','title_explorer'].includes(c)))

const rn = await call({ action: 'rename', user_id: me.id, new_pseudo: 'x' })
console.log('\n[rename "x" trop court] ->', JSON.stringify(rn.json))

const st = await call({ action: 'set_status', user_id: me.id, status: 'test' })
console.log('[set_status sans unlock] ->', JSON.stringify(st.json))
