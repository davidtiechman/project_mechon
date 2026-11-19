const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")
const { randomBytes } = require("node:crypto")
const { Client } = require("pg")
const dotenv = require("dotenv")

const root = path.resolve(__dirname, "..")
const command = process.argv[2] || "start"
const localConfigPath = path.join(root, ".env.nedarim-local")
if (command === "init") {
  if (!fs.existsSync(localConfigPath)) {
    fs.writeFileSync(localConfigPath, [
      "DATABASE_URL=postgres://mechon_dev:local-development-only@127.0.0.1:15433/mechon_nedarim_dev",
      "PORT=9001", "DISABLE_MEDUSA_ADMIN=true", "FILE_STORAGE_PROVIDER=local", "REDIS_URL=",
      "NEDARIM_ENABLED=true", "NEDARIM_ACCEPT_NEW_PAYMENTS=false", "NEDARIM_API_PASSWORD=",
      "MEDUSA_WORKER_MODE=shared", "RESEND_API_KEY=re_local_preview_no_email", "RESEND_FROM_EMAIL=preview@example.com", "RESEND_FROM_NAME=Local preview",
      "STORE_CORS=http://localhost:8000,http://127.0.0.1:8000", "AUTH_CORS=http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:9001",
      "JWT_SECRET=" + randomBytes(32).toString("hex"), "COOKIE_SECRET=" + randomBytes(32).toString("hex"), "",
    ].join("\n"), { mode: 0o600 })
  }
  console.log("Isolated local Nedarim configuration is ready; existing values were preserved")
  process.exit(0)
}
const sourceEnv = dotenv.parse(fs.readFileSync(path.join(root, ".env")))
const overrides = dotenv.parse(fs.readFileSync(localConfigPath))
const targetUrl = new URL(overrides.DATABASE_URL)
if (!['localhost', '127.0.0.1'].includes(targetUrl.hostname) || targetUrl.port !== '15433' || targetUrl.pathname !== '/mechon_nedarim_dev') {
  throw new Error("Local Nedarim development requires the isolated database on localhost:15433/mechon_nedarim_dev")
}
const env = { ...process.env, ...sourceEnv, ...overrides, NODE_ENV: "development", XDG_CONFIG_HOME: "/tmp/mechon-nedarim-dev-config", MEDUSA_DISABLE_TELEMETRY: "true" }
const quote = (value) => '"' + value.replaceAll('"', '""') + '"'

async function copyCatalog() {
  const source = new Client({ connectionString: sourceEnv.DATABASE_URL, connectionTimeoutMillis: 15_000 })
  const target = new Client({ connectionString: overrides.DATABASE_URL, connectionTimeoutMillis: 15_000 })
  const exact = new Set(["api_key", "publishable_api_key_sales_channel", "currency", "image", "inventory_item", "inventory_level", "payment_provider", "fulfillment_provider", "fulfillment_set", "geo_zone", "location_fulfillment_provider", "location_fulfillment_set", "sales_channel", "sales_channel_stock_location", "region", "region_country", "region_payment_provider", "store", "store_currency", "store_locale", "service_zone", "tax_provider", "tax_region", "tax_rate", "tax_rate_rule"])
  const allowed = (table) => exact.has(table) || /^(product(?:_|$)|price(?:_|$)|shipping_|stock_location(?:_|$)|site_content_|sitecontent_(?:site_content_)?(?:article|brand)_product_product$)/.test(table)
  try {
    await source.connect()
    await target.connect()
    // Enforced by PostgreSQL, not just by this script: the live connection cannot write.
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await target.query("BEGIN")
    const src = await source.query("select table_name,column_name,udt_name from information_schema.columns where table_schema='public' order by ordinal_position")
    const dest = await target.query("select table_name,column_name from information_schema.columns where table_schema='public'")
    const destColumns = new Map()
    for (const row of dest.rows) {
      if (!destColumns.has(row.table_name)) destColumns.set(row.table_name, new Set())
      destColumns.get(row.table_name).add(row.column_name)
    }
    const tables = new Map()
    for (const row of src.rows) {
      if (!allowed(row.table_name) || !destColumns.get(row.table_name)?.has(row.column_name)) continue
      if (!tables.has(row.table_name)) tables.set(row.table_name, [])
      tables.get(row.table_name).push({ name: row.column_name, json: ['json', 'jsonb'].includes(row.udt_name) })
    }
    const fks = await target.query("select child.relname as child,parent.relname as parent from pg_constraint c join pg_class child on child.oid=c.conrelid join pg_class parent on parent.oid=c.confrelid join pg_namespace n on n.oid=child.relnamespace where c.contype='f' and n.nspname='public'")
    const ordered = [], pending = new Set(tables.keys())
    while (pending.size) {
      const next = [...pending].find(name => fks.rows.every(fk => fk.child !== name || fk.parent === name || !pending.has(fk.parent)))
      if (!next) throw new Error("Catalog table dependency cycle requires manual inspection")
      pending.delete(next); ordered.push(next)
    }
    const localActivity = await target.query('select exists(select 1 from "order") or exists(select 1 from cart) as used')
    if (localActivity.rows[0].used) throw new Error("The local checkout database already has carts or orders; catalog reset is disabled")
    // Remove the starter catalog seeded by Medusa's first migration, only in this
    // strictly guarded, fresh LOCAL database. Live data remains in a READ ONLY transaction.
    await target.query(`truncate table ${ordered.map(table => 'public.' + quote(table)).join(',')} restart identity cascade`)
    let rowsCopied = 0
    for (const table of ordered) {
      const columns = tables.get(table)
      const names = columns.map(c => quote(c.name)).join(',')
      const filter = table === 'api_key' ? " where type='publishable'" : ''
      const ordering = columns.some(c => c.name === 'mpath') ? ' order by length("mpath"::text)' : ''
      const rows = (await source.query(`select ${names} from public.${quote(table)}${filter}${ordering}`)).rows
      for (let start = 0; start < rows.length; start += 100) {
        const chunk = rows.slice(start, start + 100), values = []
        const placeholders = chunk.map(row => '(' + columns.map(column => {
          const value = row[column.name]
          values.push(column.json && value !== null ? JSON.stringify(value) : value)
          return '$' + values.length
        }).join(',') + ')').join(',')
        await target.query(`insert into public.${quote(table)} (${names}) values ${placeholders} on conflict do nothing`, values)
      }
      rowsCopied += rows.length
    }
    await target.query("COMMIT")
    await source.query("COMMIT")
    console.log(JSON.stringify({ copiedCatalogTables: ordered.length, copiedCatalogRows: rowsCopied, sourceReadOnly: true, customersAndOrdersCopied: false }))
  } catch (error) {
    await target.query("ROLLBACK").catch(() => {})
    await source.query("ROLLBACK").catch(() => {})
    throw error
  } finally { await Promise.allSettled([source.end(), target.end()]) }
}

if (command === "copy-catalog") {
  copyCatalog().catch(error => { console.error(error.message); process.exitCode = 1 })
} else {
  const commands = {
    migrate: ["db:migrate", "--execute-safe-links"],
    enable: ["exec", "./src/scripts/enable-nedarim.ts"],
    recover: ["exec", "./src/scripts/recover-nedarim-payment.ts", ...process.argv.slice(3)],
    start: ["develop", "--port", "9001", "--host", "127.0.0.1"],
  }
  if (!commands[command]) throw new Error("Use start, migrate, copy-catalog, enable, or recover")
  const child = spawn(process.execPath, [require.resolve("@medusajs/cli/cli.js"), ...commands[command]], { cwd: root, env, stdio: "inherit" })
  if (command === "start") {
    const watcher = setInterval(async () => {
      try {
        const response = await fetch("http://127.0.0.1:9001/health", { signal: AbortSignal.timeout(1000) })
        if (!response.ok) return
        const file = path.resolve(root, "../storefront/.env.local")
        let content = fs.readFileSync(file, "utf8")
        const updates = {
          MEDUSA_BACKEND_URL: "http://127.0.0.1:9001",
          NEXT_PUBLIC_MEDUSA_BACKEND_URL: overrides.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9001",
          NEXT_PUBLIC_NEDARIM_CHECKOUT_PAUSED: String(env.NEDARIM_ACCEPT_NEW_PAYMENTS === "false"),
          ...(overrides.NEXT_PUBLIC_BASE_URL ? { NEXT_PUBLIC_BASE_URL: overrides.NEXT_PUBLIC_BASE_URL } : {}),
        }
        for (const [key, value] of Object.entries(updates)) {
          const expression = new RegExp(`^${key}=.*$`, "m")
          content = expression.test(content) ? content.replace(expression, `${key}=${value}`) : content + `\n${key}=${value}\n`
        }
        if (!fs.existsSync(file + ".before-nedarim-local")) fs.copyFileSync(file, file + ".before-nedarim-local")
        fs.writeFileSync(file, content)
        clearInterval(watcher)
        console.log(`Local storefront connected to the isolated Nedarim development backend at ${updates.NEXT_PUBLIC_MEDUSA_BACKEND_URL}`)
      } catch {}
    }, 1000)
    child.on("exit", () => clearInterval(watcher))
  }
  child.on("exit", code => process.exit(code ?? 1))
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal))
}
