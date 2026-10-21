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
