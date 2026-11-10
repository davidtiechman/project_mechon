const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")
const path = require("node:path")

function setup(hoverCapable = true) {
  let pending, cleanup, opened = 0, closed = 0, delay
  const context = {
    HTMLElement: class HTMLElement {},
    exports: {},
    require: () => ({ useRef: () => ({ current: null }), useEffect: (fn) => { cleanup = fn() } }),
    window: { matchMedia: () => ({ matches: hoverCapable }) },
    setTimeout: (fn, ms) => { pending = fn; delay = ms; return 1 },
    clearTimeout: () => { pending = null },
  }
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/hooks/use-hover-menu.ts"), "utf8")
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  const handlers = context.exports.useHoverMenu(() => opened++, () => closed++)
  return { handlers, openMenuOnHover: context.exports.openMenuOnHover, HTMLElement: context.HTMLElement, cleanup: () => cleanup(), tick: () => { const fn = pending; pending = null; fn?.() }, get opened() { return opened }, get closed() { return closed }, get delay() { return delay } }
}
const mouse = { pointerType: "mouse" }

test("hover opening restores previous focus instead of leaving the trigger focused", () => {
  const s = setup()
  const previous = new s.HTMLElement()
  const doc = { activeElement: previous }
  let clicked = 0
  previous.focus = (options) => {
    assert.equal(options.preventScroll, true)
    doc.activeElement = previous
  }
  const button = {
    ownerDocument: doc,
    click() { clicked++; doc.activeElement = this },
    blur() { doc.activeElement = null },
  }
  s.openMenuOnHover(button)
  assert.equal(clicked, 1)
  assert.equal(doc.activeElement, previous)
})

test("hover preserves focus when the trigger was already focused by keyboard", () => {
  const s = setup()
  const doc = {}
  const button = {
    ownerDocument: doc,
    click() {},
    blur() { assert.fail("Existing keyboard focus must remain") },
  }
  doc.activeElement = button
  s.openMenuOnHover(button)
  assert.equal(doc.activeElement, button)
  s.openMenuOnHover(null)
})

test("hover opens and leaving closes after 250ms", () => {
  const s = setup()
  s.handlers.onPointerEnter(mouse)
  assert.equal(s.opened, 1)
  s.handlers.onPointerLeave(mouse)
  assert.equal(s.closed, 0)
  assert.equal(s.delay, 250)
  s.tick()
  assert.equal(s.closed, 1)
})
test("entering the panel or returning to the trigger cancels closing", () => {
  const s = setup()
  s.handlers.onPointerLeave(mouse)
  s.handlers.onPointerEnter(mouse)
  s.tick()
  assert.equal(s.closed, 0)
})
test("touch, pen, and devices without hover do not open on pointer entry", () => {
  for (const pointerType of ["touch", "pen"]) {
    const s = setup()
    s.handlers.onPointerEnter({ pointerType })
    assert.equal(s.opened, 0)
  }
  const s = setup(false)
  s.handlers.onPointerEnter(mouse)
  assert.equal(s.opened, 0)
})
test("focus, explicit toggles and unmount cancel pending close", () => {
  for (const action of [s => s.handlers.onFocusCapture(), s => s.handlers.cancel(), s => s.cleanup()]) {
    const s = setup()
    s.handlers.onPointerLeave(mouse)
    action(s)
    s.tick()
    assert.equal(s.closed, 0)
  }
})
