const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => dependencies[name] || require(name) })
  return exports.default
}
test('entrance uses ten original SVGs in order, with staggered timing and no interactive content', () => {
  const Banner = load('modules/content/components/avodat-hashem-banner/index.tsx', {
    'next/image': { default: 'image' }, './banner.module.css': { default: {} },
  })
  const tree = Banner()
  assert.equal(tree.props.dir, 'ltr')
  assert.equal(tree.props['aria-hidden'], 'true')
  const items = tree.props.children
  assert.equal(items.length, 10)
  for (const [i, item] of items.entries()) {
    const image = item.props.children
    assert.equal(image.props.src, `/avodat-hashem/title-${String(i+1).padStart(2,'0')}.svg`)
    assert.equal(item.props.style['--delay'], `${i*2}s`)
    assert(image.props.width > 0 && image.props.height > 0)
    const svg = fs.readFileSync(path.join(__dirname, '../public', image.props.src), 'utf8')
    assert(svg.includes('<svg'))
    assert(!/<(?:text|script|foreignObject)\b/.test(svg))
  }
})
test('entrance keeps the original full-width header, hero and products unchanged', () => {
  const Template = load('modules/content/templates/content-page.tsx', {
    'next/image': { default: 'image' }, '@modules/products/components/product-preview': { default: 'product' },
    '@lib/util/avodat-product-thumbnail': { getAvodatCutout: () => undefined },
    '@modules/content/components/ornamental-product-frame/frame.module.css': { default: { frame: 'ornamental-frame' } },
  })
  const props = { item: { title: 'עבודת השם', hero_image: '/original.jpg' }, region: { id: 'il' }, products: [{ id: 'one' }] }
  const original = Template(props)
  const integrated = Template({ ...props, entranceEffect: 'entrance-marker' })
  const originalHeader = original.props.children[0]
  const integratedHeader = integrated.props.children[0]
  assert.equal(integratedHeader.props.children[0], 'entrance-marker')
  assert.equal(JSON.stringify(integratedHeader.props.children[1].props.children), JSON.stringify(originalHeader.props.children[1].props.children))
  assert(integratedHeader.props.children[1].props.className.includes('py-14 small:py-16'))
  assert.equal(JSON.stringify(integrated.props.children.slice(1)), JSON.stringify(original.props.children.slice(1)))
})

test('ornamental frames are opt-in and retain the exact product preview props', () => {
  const Template = load('modules/content/templates/content-page.tsx', {
    'next/image': { default: 'image' }, '@modules/products/components/product-preview': { default: 'product' },
    '@lib/util/avodat-product-thumbnail': { getAvodatCutout: () => undefined },
    '@modules/content/components/ornamental-product-frame/frame.module.css': { default: { frame: 'ornamental-frame' } },
  })
  const props = { item: { title: 'מפעל' }, region: { id: 'il' }, products: [{ id: 'one' }] }
  const plain = Template(props).props.children.at(-1).props.children.props.children[0]
  const framed = Template({ ...props, ornamentalProducts: true }).props.children.at(-1).props.children.props.children[0]
  assert.equal(plain.props.className, undefined)
  assert.equal(framed.props.className, 'ornamental-frame')
  assert.equal(JSON.stringify(plain.props.children), JSON.stringify(framed.props.children))
})

test('cutout lookup is limited to the known covers and tolerates malformed/unknown sources', () => {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/util/avodat-product-thumbnail.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })
  assert.equal(exports.getAvodatCutout('https://example.com/0032-01KYJH1Z1RD7F7TBJNB0S4NGXB.jpg'), '/images/avodat-cutouts/zemirot.webp')
  for (const input of [null, undefined, '/unknown.jpg', '/%broken', '/toString']) assert.equal(exports.getAvodatCutout(input), undefined)
})
test('all cutouts have a real alpha channel and transparent canvas margins', async () => {
  const sharp = require('sharp')
  for (const name of ['kinot','zemirot-soft','zemirot','siddur']) {
    const file = path.join(__dirname, '../public/images/avodat-cutouts', name+'.webp')
    const meta = await sharp(file).metadata()
    assert.equal(meta.hasAlpha, true)
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (const pixel of [0, info.width-1, (info.height-1)*info.width, info.width*info.height-1]) assert.equal(data[pixel*4+3], 0)
  }
})

test('thumbnail override changes only the displayed image and retains product links and purchase data', () => {
  const product = { id: 'book', handle: 'original-handle', title: 'ספר', thumbnail: '/original.jpg', variants: [{ id: 'variant', manage_inventory: false }] }
  const Preview = load('modules/products/components/product-preview/index.tsx', {
    '@modules/common/components/ui': { Text: 'text' },
    '@lib/util/get-product-price': { getProductPrice: ({ product: passed }) => { assert.equal(passed, product); return { cheapestPrice: null } } },
    '@modules/common/components/localized-client-link': { default: 'link' },
    '../thumbnail': { default: 'thumbnail' }, './price': { default: 'price' }, './card-add-to-cart': { default: 'cart' },
  })
  const card = Preview({ product, region: { id: 'il' }, thumbnailOverride: '/cutout.webp' })
  const link = card.props.children[0]
  const image = link.props.children[0].props.children[0]
  assert.equal(image.props.thumbnail, '/cutout.webp')
  assert.equal(product.thumbnail, '/original.jpg')
  assert.equal(link.props.href, '/products/original-handle')
  assert.equal(card.props.children[1].props.variantId, 'variant')
})
