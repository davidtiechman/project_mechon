const { TestEnvironment } = require("jest-environment-node")
// Load with Node's native CJS/ESM interop, outside Jest's VM module resolver.
const sanitizeHtml = require("sanitize-html")

module.exports = class NedarimLocalEnvironment extends TestEnvironment {
  async setup() {
    await super.setup()
    this.global.__nedarimActualSanitizeHtml = sanitizeHtml
  }
}
