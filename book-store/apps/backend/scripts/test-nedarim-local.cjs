const { spawnSync } = require("node:child_process")

// Deliberately never use DATABASE_URL from .env: this suite may create/drop its test database.
const port = process.env.NEDARIM_TEST_DB_PORT || "15432"
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid local test database port")
const env = {
  ...process.env,
  NODE_ENV: "test", DB_HOST: "localhost", DB_PORT: port,
  DB_USERNAME: "nedarim_test", DB_PASSWORD: "local-test-only",
  DATABASE_URL: `postgres://nedarim_test:local-test-only@localhost:${port}/postgres`,
  REDIS_URL: "", MEDUSA_WORKER_MODE: "shared", DISABLE_MEDUSA_ADMIN: "true",
  FILE_STORAGE_PROVIDER: "local", MEDUSA_DISABLE_TELEMETRY: "true",
  JWT_SECRET: "local-nedarim-jwt-secret-only", COOKIE_SECRET: "local-nedarim-cookie-secret-only",
  AUTH_MFA_ENCRYPTION_KEY: "0".repeat(64),
  NEDARIM_ENABLED: "true", NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "local-test",
  NEDARIM_ACCEPT_NEW_PAYMENTS: "true",
  NEDARIM_WEBHOOK_SECRET: "local-integration-signature-secret-32-characters",
  STAMP_HMAC: "", NEDARIM_WEBHOOK_PREVIOUS_SECRET: "", NEDARIM_API_PASSWORD: "",
  NEDARIM_CALLBACK_BASE_URL: "https://local-nedarim.example",
  RESEND_API_KEY: "re_local_test_only", RESEND_FROM_EMAIL: "test@example.com", RESEND_FROM_NAME: "Local test",
  GOOGLE_CLIENT_ID: "local-test", GOOGLE_CLIENT_SECRET: "local-test", GOOGLE_CALLBACK_URL: "http://localhost/callback",
  STORE_CORS: "http://localhost:8000", ADMIN_CORS: "http://localhost:9001", AUTH_CORS: "http://localhost:8000",
  PORT: "19001", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "/tmp/mechon-nedarim-test-config",
}
const result = spawnSync(process.execPath, ["scripts/run-tests.cjs", "integration:http", "--runTestsByPath", "integration-tests/http/nedarim.spec.ts", ...process.argv.slice(2)], {
  cwd: require("node:path").resolve(__dirname, ".."), env, stdio: "inherit",
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
