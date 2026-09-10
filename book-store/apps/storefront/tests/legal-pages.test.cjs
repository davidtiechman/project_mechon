const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..')
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, process: { env: { NODE_ENV: 'production' } },
    require(name) {
      if (name === 'react/jsx-runtime') return require(name)
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
      return dependencies[name]
    },
  })
  return exports
}
const legal = load('src/lib/legal-content.ts', { './contact-details': { contactDetails: {} } })
const records = Object.fromEntries(['shipping', 'cancellations', 'privacy', 'accessibility', 'terms'].map(slug => [slug, {
  id: slug, slug, title: slug, status: 'published', excerpt: `Full excerpt ${slug}`,
  content: `<h2>${slug}</h2><p>Complete source content &amp; conditions.</p>`, hero_image: `${slug}.jpg`,
}]))
const page = load('src/app/[countryCode]/(main)/pages/[slug]/page.tsx', {
  '@lib/data/site-content': { getContentItem: async (_, slug) => records[slug] || null },
  '@modules/content/templates/content-page': { default: 'ContentPageTemplate' },
  'next/navigation': { notFound() { throw new Error('404') } },
  '@lib/util/seo': { canonicalMetadata: (_, slug) => slug, metadataDescription: (...values) => values.find(Boolean) },
  '@lib/legal-content': legal,
  '@lib/contact-details': { updatePublicContactRows: content => content },
  '@modules/content/components/contact-form': { default: 'ContactForm' },
  '@modules/content/components/marketing-privacy-notice': { default: 'MarketingPrivacyNotice' },
  '@modules/common/components/localized-client-link': { default: 'Link' },
})
function templates(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(templates)
  if (node.type === 'ContentPageTemplate') return [node.props]
  return templates(node.props?.children)
}
test('merged pages retain both complete source records in order', async () => {
  for (const [slug, group] of Object.entries(legal.legalPageGroups)) {
    const result = templates(await page.default({ params: Promise.resolve({ countryCode: 'il', slug }) }))
    assert.equal(result.length, 2)
    group.sources.forEach((source, index) => {
      assert.deepEqual(JSON.parse(JSON.stringify(result[index].item)), records[source])
      assert.equal(result[index].headingLevel, 'h2')
    })
  }
})
test('terms retain their full standalone record; sitemap slugs resolve to merged pages', async () => {
  const result = templates(await page.default({ params: Promise.resolve({ countryCode: 'il', slug: 'terms-of-purchase' }) }))
  assert.deepEqual(JSON.parse(JSON.stringify(result[0].item)), records.terms)
  for (const [slug, group] of Object.entries(legal.legalPageGroups)) {
    for (const source of group.sources) assert.equal(legal.canonicalLegalSlug(source), slug)
  }
  assert.equal(legal.canonicalLegalSlug('contact'), 'contact')
})
test('all old URL forms return 301 rules with the country preserved', async () => {
  const context = { module: { exports: {} }, process: { env: {} }, require: () => () => {} }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'next.config.js'), 'utf8'), context)
  const redirects = await context.module.exports.redirects()
  assert.equal(redirects.length, 20)
  for (const [target, group] of Object.entries(legal.legalPageGroups)) {
    for (const source of group.sources) {
      for (const prefix of ['', '/:countryCode([a-z]{2})']) {
        for (const pages of ['', '/pages']) {
          const rule = redirects.find(rule => rule.source === `${prefix}${pages}/${source}`)
          assert.equal(rule?.statusCode, 301)
          assert.equal(rule?.destination, `${prefix ? '/:countryCode' : ''}/pages/${target}`)
        }
      }
    }
  }
})
