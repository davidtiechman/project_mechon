const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/assistant', file), 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, AbortController, DOMException, setTimeout, clearTimeout,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    },
    ...globals,
  })
  return exports
}

function hook(provider) {
  const states = [], refs = [], cleanup = []
  let stateIndex = 0, refIndex = 0
  const react = {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial } },
    useEffect(effect) { if (!cleanup.length) cleanup.push(effect()) },
  }
  const { useAssistantChat } = load('hooks/use-assistant-chat.ts', { react, '../lib/reply': { getAssistantReply: provider } })
  return {
    render() { stateIndex = 0; refIndex = 0; return useAssistantChat() },
    unmount() { cleanup.forEach(fn => fn?.()) },
  }
}

const expected = 'שלום! אני אהרן הידען. השירות עדיין בהקמה ובעז״ה אהיה זמין כאן בקרוב כדי לעזור לכם למצוא ספרים ולקבל מידע על החנות.'

test('local reply waits for the typing delay and returns the exact requested text', async () => {
  let finish, delay, resolved = false
  const { getAssistantReply } = load('lib/reply.ts', {}, { setTimeout(fn, ms) { finish = fn; delay = ms; return 1 } })
  const promise = getAssistantReply([], { signal: new AbortController().signal }).then(value => { resolved = true; return value })
  await Promise.resolve()
  assert.equal(resolved, false)
  assert.equal(delay, 900)
  finish()
  assert.equal(await promise, expected)
})

test('reply cancellation clears the pending timer', async () => {
  let cleared = false
  const { getAssistantReply } = load('lib/reply.ts', {}, { setTimeout: () => 1, clearTimeout: () => { cleared = true } })
  const controller = new AbortController()
  const reply = getAssistantReply([], { signal: controller.signal })
  controller.abort()
  await assert.rejects(reply, { name: 'AbortError' })
  assert.equal(cleared, true)
  await assert.rejects(getAssistantReply([], { signal: controller.signal }), { name: 'AbortError' })
})

test('messages appear immediately; duplicate sends are blocked until the reply arrives', async () => {
  let complete, request, calls = 0
  const h = hook((messages) => { calls++; request = messages; return new Promise(resolve => { complete = resolve }) })
  const chat = h.render()
  await chat.send('   ')
  assert.equal(calls, 0)
  const first = chat.send('  שלום  ')
  assert.equal(h.render().messages[0].content, 'שלום')
  assert.equal(h.render().isTyping, true)
  await chat.send('duplicate')
  assert.equal(calls, 1)
  assert.equal(request[0].role, 'user')
  complete(expected)
  await first
  assert.equal(h.render().isTyping, false)
  assert.equal(h.render().messages[1].content, expected)
  const second = h.render().send('עוד שאלה')
  assert.equal(request.length, 3)
  complete(expected)
  await second
  assert.equal(h.render().messages.length, 4)
  assert.equal(new Set(h.render().messages.map(m => m.id)).size, 4)
})

test('unmount aborts the provider and ignores late results', async () => {
  let complete, signal
  const h = hook((_messages, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve }) })
  const pending = h.render().send('שלום')
  h.unmount()
  assert.equal(signal.aborted, true)
  complete(expected)
  await pending
  assert.equal(h.render().messages.length, 1)
})

test('a future provider error is surfaced and releases the send lock', async () => {
  const h = hook(async () => { throw new Error('unavailable') })
  await h.render().send('שלום')
  assert.ok(h.render().error)
  assert.equal(h.render().isTyping, false)
  await h.render().send('ניסיון נוסף')
  assert.equal(h.render().messages.length, 2)
})
