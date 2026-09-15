const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function setup({ category = { id: 'cat_bina' }, tag = { id: 'tag_new' } } = {}) {
  const calls = []
  const products = [{ id: 'book_bina', handle: 'bina-set', title: 'סט הבינה והברכה' }]
  const exports = {}
  const dependencies = {
    'server-only': {},
    './categories': { getCategoryByHandle: async (handles) => { calls.push({ handles }); return category } },
    './institute-projects': { getInstituteProject: (slug) => slug === 'habina-vehabracha' ? { categoryHandle: 'הבינה-והברכה' } : undefined },
    './product-tags': { getProductTagByValue: async (value) => { calls.push({ tag: value }); return tag } },
    './products': { listProducts: async (args) => { calls.push(args); return { response: { products } } } },
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/data/brand-products.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  })
  return { get: exports.getBrandProducts, calls, products }
}

test('a brand without direct links includes books from its category', async () => {
  const s = setup()
  const result = await s.get({ slug: 'habina-vehabracha', products: [] }, 'il')
  assert.equal(result, s.products)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)), [
    { handles: ['הבינה-והברכה'] },
    { countryCode: 'il', queryParams: { category_id: ['cat_bina'], limit: 100, order: '-created_at' } },
  ])
})

test('explicit links take precedence over category membership', async () => {
  const s = setup()
  await s.get({ slug: 'habina-vehabracha', products: [{ id: 'linked' }] }, 'us')
  assert.equal(s.calls.length, 1)
  assert.equal(s.calls[0].queryParams.id[0], 'linked')
  assert.equal(s.calls[0].countryCode, 'us')
})

test('new books uses the new-product tag even when direct links exist', async () => {
  for (const title of ['חדשים', ' ספרים חדשים ']) {
    const s = setup()
    await s.get({ title, products: [{ id: 'linked' }] }, 'il')
    assert.equal(s.calls[0].tag, 'מוצר חדש')
    assert.equal(s.calls[1].queryParams.tag_id[0], 'tag_new')
  }
})

test('missing category, tag or mapping never results in an unfiltered catalog query', async () => {
  for (const item of [{ slug: 'habina-vehabracha' }, { title: 'ספרים חדשים' }, { slug: 'unknown' }]) {
    const missing = setup({ category: null, tag: null })
    assert.equal((await missing.get(item, 'il')).length, 0)
    assert.equal(missing.calls.some(call => call.queryParams), false)
  }
})
