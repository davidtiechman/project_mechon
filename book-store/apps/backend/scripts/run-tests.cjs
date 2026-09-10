const { spawnSync } = require("node:child_process")

const [type, ...args] = process.argv.slice(2)
if (!["unit", "integration:http", "integration:modules"].includes(type)) {
  throw new Error("Unknown test suite")
}
const result = spawnSync(process.execPath, [
  "--experimental-vm-modules", require.resolve("jest/bin/jest"),
  "--runInBand", "--forceExit", ...args,
], { stdio: "inherit", env: { ...process.env, TEST_TYPE: type } })
if (result.error) throw result.error
process.exit(result.status ?? 1)
