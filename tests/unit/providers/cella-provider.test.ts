/**
 * Cella 提供者（spec 182 T007）——主執行緒那一半：formalize、版本號、過期丟棄、worker 起不來。
 * worker 用假的：只看協定，不載 Cella（真的判決在 `tests/probes/binding-verdict`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { createCellaProvider, readsInput } from '../../../src/providers/cella/provider'
import type { WorkerReply, WorkerRequest } from '../../../src/providers/cella/worker'
import type { SemanticNode } from '../../../src/core/types'
import { createNode } from '../../../src/core/semantic-tree'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

/** 假 worker：收到的請求記下來，由測試決定回什麼。 */
function fakeWorker() {
  const sent: WorkerRequest[] = []
  const w = {
    onmessage: null as ((e: MessageEvent<WorkerReply>) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
    postMessage: (m: WorkerRequest) => { sent.push(m) },
    reply: (r: WorkerReply) => w.onmessage!({ data: r } as MessageEvent<WorkerReply>),
  }
  return { w, sent }
}
const accept = { verdict: 'accept', basis: 'computed', exit: 0, out: '', problems: [] } as const

describe('Cella 提供者', () => {
  it('★ 宣告 verdict、types 與 session（spec 183：除錯工作階段走 cella-lang/dap）', () => {
    const p = createCellaProvider(() => fakeWorker().w as unknown as Worker)
    expect(p.declares).toEqual({ verdict: true, types: true, session: { granularity: 'node', setInput: true, setVariable: true, steps: true, stepping: true, interactiveInput: true, hardware: false } })
  })

  it('★ 回來的不是最新那一筆 → stale；最新的那一筆不是', async () => {
    const { w, sent } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    const tree = lift('int main() { return 0; }')
    const a = p.check!({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    const b = p.check!({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    expect(sent.map((m) => m.kind)).toEqual(['check', 'check'])
    w.reply({ id: sent[0].id, kind: 'result', verdict: accept as never, types: {} })
    w.reply({ id: sent[1].id, kind: 'result', verdict: accept as never, types: {} })
    expect((await a).stale).toBe(true)
    expect((await b).stale).toBe(false)
    expect((await b).verdict?.verdict).toBe('accept')
  })

  it('★ 排隊時被取代（skipped）→ 答案是空的，不會卡住', async () => {
    const { w, sent } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    const a = p.check!({ tree: lift('int main() { return 0; }'), targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    w.reply({ id: sent[0].id, kind: 'skipped' })
    expect(await a).toMatchObject({ verdict: null, types: null })
  })

  it('🔴 formalize 翻不出來 → 不送 worker，直接回 unknown＋每顆一筆 unsupported（判不出來不是學生的錯）', async () => {
    const { w, sent } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    const odd = createNode('cpp:program', {}, { body: [createNode('cpp:no_such_component', {}, {})] })
    const r = await p.check!({ tree: odd, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    expect(sent).toEqual([])
    expect(r.verdict?.verdict).toBe('unknown')
    expect(r.verdict?.problems.every((x) => x.kind === 'unsupported')).toBe(true)
    expect(r.verdict?.problems.length).toBeGreaterThan(0)
  })

  it('★ 載入狀態：worker 報 loading → ready；報 unavailable 帶原因', () => {
    const { w } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    const seen: string[] = []
    p.onReadiness!((r) => seen.push(r.state))
    expect(p.readiness!().state).toBe('idle')
    p.warmUp!()
    w.reply({ kind: 'status', status: 'loading' })
    w.reply({ kind: 'status', status: 'unavailable', reason: '404' })
    expect(seen).toEqual(['loading', 'unavailable'])
    expect(p.readiness!()).toEqual({ state: 'unavailable', reason: '404' })
  })

  it('🔴 worker 建不起來（例如瀏覽器不支援）→ 狀態 unavailable，check 回空答案而不是丟例外', async () => {
    const p = createCellaProvider(() => { throw new Error('no Worker') })
    const r = await p.check!({ tree: lift('int main() { return 0; }'), targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    expect(r).toMatchObject({ verdict: null, types: null })
    expect(p.readiness!()).toEqual({ state: 'unavailable', reason: 'no Worker' })
  })

  it('★ 目標與風格由提供者翻譯：板子 → 步數 50,000,000 與板名；C 風格 → langC', () => {
    const { w, sent } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    void p.check!({ tree: lift('int main() { return 0; }'), targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    void p.check!({ tree: lift('void setup() {}\nvoid loop() {}'), targetId: 'arduino-uno', styleId: 'google', skeletonId: 'arduino', input: '' })
    void p.check!({ tree: lift('int main() { return 0; }'), targetId: 'c', styleId: 'c', skeletonId: 'main', input: '' })
    const [cpp, uno, c] = sent as Extract<WorkerRequest, { kind: 'check' }>[]
    expect(cpp.fuel).toBe(1_000_000)
    expect(uno.fuel).toBe(50_000_000)
    expect((uno.program as { board: unknown }).board).toBeTruthy()
    expect((c.program as { lang: { k: string } }).lang.k).toBe('langC')
  })

  it('★ 讀不讀輸入由提供者看自己的程式形式判斷：cin、scanf 是；只有 cout 不是', async () => {
    const { formalize } = await import('../../../src/providers/cella/formalize')
    const prog = (code: string) => formalize(lift(code)).program
    expect(readsInput(prog('#include <iostream>\nint main() { int n; std::cin >> n; return n; }'))).toBe(true)
    expect(readsInput(prog('#include <cstdio>\nint main() { int n; scanf("%d", &n); return n; }'))).toBe(true)
    expect(readsInput(prog('#include <iostream>\nint main() { std::cout << 1; return 0; }'))).toBe(false)
  })

  it('🔴 骨架隱藏時樹裡沒有 main（L0 的 body-only）→ 照骨架宣告包上進入點，不判成「缺 main」', async () => {
    const { w, sent } = fakeWorker()
    const p = createCellaProvider(() => w as unknown as Worker)
    const full = lift('#include <iostream>\nint main() { int x = 1; std::cout << x; return 0; }')
    const main = full.slots.body!.find((n) => n.properties?.name === 'main')!
    const bodyOnly = { ...full, slots: { ...full.slots, body: [...full.slots.body!.filter((n) => n !== main), ...main.slots.body!] } }
    void p.check!({ tree: bodyOnly, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })
    const items = (sent[0] as Extract<WorkerRequest, { kind: 'check' }>).program as { items: { k: string; f?: { name: string } }[] }
    expect(items.items.map((i) => i.f?.name).filter(Boolean)).toEqual(['main'])
  })
})
