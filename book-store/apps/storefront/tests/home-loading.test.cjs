const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function setup(overrides = {}) {
  const calls = []
  const pending = new Promise(() => {})
  const dependencies = {
    react: { Suspense: require("react").Suspense },
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@lib/data/categories": { listCategories: () => { calls.push("categories"); return pending } },
    "@lib/data/products": { listProducts: () => { calls.push("products"); return pending } },
    "@lib/data/regions": { getRegion: () => { calls.push("region"); return pending } },
    "@lib/data/product-tags": { getProductTagByValue: () => { calls.push("tag"); return pending } },
    "@lib/data/site-content": { getHomeContent: async () => ({ sections: [], banners: [], articles: [] }) },
    "@lib/util/seo": { canonicalMetadata: () => ({}) },
    ...overrides,
  }
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, "../src/app/[countryCode]/(main)/page.tsx"), "utf8")
  const code = ts.transpileModule(source + "\nexport { NewBooks, HomeCategories }", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name in dependencies) return dependencies[name]
      if (name.startsWith("@modules/")) return { default: name }
      throw new Error(name)
    },
  })
  return { ...exports, calls, suspense: dependencies.react.Suspense }
}

test("Home returns Hero and independent catalog boundaries while catalog requests are unresolved", async () => {
  const s = setup()
  const tree = await s.default({ params: Promise.resolve({ countryCode: "il" }) })
  assert.deepEqual(s.calls, [])
  const children = tree.props.children
  assert.equal(children[0].type, "@modules/home/components/hero")
  const boundaries = children.filter((child) => child?.type === s.suspense)
  assert.equal(boundaries.length, 2)
  assert.equal(boundaries[0].props.children.type, s.NewBooks)
  assert.equal(boundaries[1].props.children.type, s.HomeCategories)
  s.NewBooks({ countryCode: "il" })
  s.HomeCategories()
  assert.deepEqual(s.calls, ["region", "tag", "categories"])
})

test("new books retains tag filtering and empty-tag behavior", async () => {
  for (const tag of [null, { id: "new-tag" }]) {
    let query
    const s = setup({
      "@lib/data/regions": { getRegion: async () => ({ id: "region" }) },
      "@lib/data/product-tags": { getProductTagByValue: async () => tag },
      "@lib/data/products": { listProducts: async (args) => { query = args; return { response: { products: [] } } } },
    })
    const section = await s.NewBooks({ countryCode: "il" })
    assert.equal(section.props.id, "new-books")
    if (tag) {
      assert.equal(query.countryCode, "il")
      assert.equal(query.queryParams.tag_id[0], "new-tag")
      assert.equal(query.queryParams.limit, 6)
    } else {
      assert.equal(query, undefined)
    }
  }
})
