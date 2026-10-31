/**
 * JS 直譯器包成提供者之後，行為逐字不變（spec 179，SC-001 的機器證據）。
 *
 * 同一段程式：經提供者的 session 跑，與直接 new SemanticInterpreter 跑——
 * 輸出、每個節點的進入次數、停止原因都要相同。差一點就是包裝層改了語意。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { RuntimeError } from '../../src/interpreter/errors'
import { jsInterpreterProvider } from '../../src/providers/js-interpreter'
import { SessionStop } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

const OK = '#include <iostream>\nusing namespace std;\nint main(){ int s = 0; for (int i = 0; i < 4; i++) s += i; cout << s << endl; }'
const BAD = '#include <iostream>\nusing namespace std;\nint main(){ int a = 1; int b = 0; cout << a / b; }'

async function direct(src: string) {
  const it = new SemanticInterpreter({ maxSteps: 100_000 })
  const out: string[] = []
  it.setOutputCallback((t) => out.push(t))
  let stop: string | null = null
  try { await it.execute(lift(src)) } catch (e) { stop = e instanceof RuntimeError ? e.i18nKey : String(e) }
  return { out: out.join(''), counts: [...it.getVisitCounts().values()].sort(), stop }
}

async function viaProvider(src: string) {
  const tree = lift(src)
  const s = jsInterpreterProvider.createSession!({ maxSteps: 100_000 }, tree)
  if ('declined' in s) throw new Error(s.declined)
  const out: string[] = []
  s.onOutput((t) => out.push(t))
  let stop: string | null = null
  const o = await s.launch(tree, { stopOnEntry: false })
  if (o.kind === 'failed') {
    expect(o.error, '🔴 提供者漏出了直譯器自己的錯誤型別——控制器只認 SessionStop').toBeInstanceOf(SessionStop)
    stop = o.error.i18nKey
  }
  return { out: out.join(''), counts: [...(s.coverage() ?? new Map()).values()].sort(), stop }
}

describe('JS 直譯器提供者：包裝不改語意', () => {
  it('★ 宣告的能力與它真的有的一致——沒有判決、沒有型別查詢', () => {
    expect(jsInterpreterProvider.declares.verdict).toBeUndefined()
    expect(jsInterpreterProvider.declares.types).toBeUndefined()
    expect(jsInterpreterProvider.declares.session).toEqual({ granularity: 'node', setInput: false, setVariable: true, steps: true })
  })

  it('★ 正常結束：輸出與進入次數相同', async () => {
    const [a, b] = await Promise.all([direct(OK), viaProvider(OK)])
    expect(b.out).toBe('6\n')
    expect(b).toEqual(a)
  })

  it('★ 執行期錯誤：停止原因相同，而且是 SessionStop', async () => {
    const [a, b] = await Promise.all([direct(BAD), viaProvider(BAD)])
    expect(b.stop).not.toBeNull()
    expect(b).toEqual(a)
  })

  it('★ 中止：等輸入時 terminate，下一個指令回 aborted（不會卡住）', async () => {
    const tree = lift('#include <iostream>\nusing namespace std;\nint main(){ int x; cin >> x; cout << x; }')
    const s = jsInterpreterProvider.createSession!({ maxSteps: 10_000_000 }, tree)
    if ('declined' in s) throw new Error(s.declined)
    expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    s.terminate()
    expect(await s.supplyInput('1')).toMatchObject({ kind: 'failed', error: { kind: 'aborted' } })
  })
})
