/**
 * **沒看過的東西 → 停下來，而且說得出是哪一顆。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字（`vision.md:524`）：
 * 「**如果沒看過的東西就不要執行下去了，要誠實的說沒看過**」。
 *
 * 在此之前直譯器掛著一個 `unknownComponentHandler`，回 `'skip' | 'abort'`，
 * 而 UI 用 `confirm()` 去問學生要不要跳過。🔴 **`'skip'` 不是「跳過一行」，是「帶著錯的狀態繼續跑」**：
 *
 * ```
 * 跳過一個【輸出】   少印一行              ← 看得出來
 * 跳過一個【賦值】   後面每行都讀錯的值    ← 看不出來，而且每一步都【正常】
 * ```
 *
 * ## spec 205（重構 6c-3）：接手的是 Cella 的「翻不出／判不出」
 *
 * Cella 那一側沒有「跑到一半遇到沒看過的」——formalize 翻不出的元件**整支不送**（一步也不執行）：
 *
 * ```
 * 判決      verdict = unknown，problems = [{ kind: 'unsupported', at: <那一顆的 id> }]     ← 指名
 * 工作階段  createSession → declined（不開跑）                                              ← 停下來
 * 跑到一半  Cella 自己判 unsupported → SessionStop('RUNTIME_ERR_CELLA_UNSUPPORTED')（worker 的 outcomeOf）
 * ```
 *
 * 這支釘的是**行為**：真的餵一顆沒看過的元件進去，它會不會停、說不說得出是哪一顆。
 * （第七十五條護欄釘的是「`'skip'` 這個字不在 `src/` 裡」——那是形狀。）
 *
 * 🪦 刪掉的一條：「`executeNode` 丟 `RuntimeError`」——那是 JS 直譯器的例外型別，接手的是上面「判決 unknown ＋ 工作階段不開跑」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { createNode } from '../../../src/core/semantic-tree'
import { cellaProvider, cppFormal, waitSession } from '../../helpers/cella-session'
import { runCella } from '../../helpers/cella-run'
import { setMessages, formatMessage, resetMessages } from '../../../src/i18n/messages'
import { describeRuntimeStop } from '../../../src/ui/runtime-message'
import type { Provider } from '../../../src/core/capabilities'
import type { SemanticNode } from '../../../src/core/types'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'

let parser: Parser
let p: Provider
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  p = await cellaProvider()
  await waitSession(p, lift('int main() { return 0; }'))
}, 400_000)

/** 一支程式：印一句 → 一顆沒看過的元件 → 再印一句（「跳過」的話後面那句會印出來） */
function withStranger(): { tree: SemanticNode; stranger: SemanticNode } {
  const stranger = { id: 'stranger1', componentId: 'cpp:this_does_not_exist', properties: {}, slots: {} } as unknown as SemanticNode
  const say = (t: string): SemanticNode => createNode('cpp:print', {}, { values: [createNode('cpp:literal_string', { value: t })] })
  return { tree: createNode('cpp:program', {}, { body: [say('before'), stranger, say('after')] }), stranger }
}
const check = (tree: SemanticNode) => p.check!({ tree, targetId: 'cpp', styleId: 'apcs', skeletonId: 'main', input: '' })

describe('沒看過的元件：停下來並指名（Cella）', () => {
  it('🔴 判決：unknown，不是 accept——後面那句不得被「跳過去」印出來', async () => {
    const { tree } = withStranger()
    const a = await check(tree)
    expect(a.verdict?.verdict, '🔴 一顆沒看過的元件被當成不存在，整支照跑').toBe('unknown')
    expect(a.verdict?.out ?? '', '一步也不執行').toBe('')
  })

  it('🔴 判決帶得出**是哪一顆**——沒有名字的誠實只有一半', async () => {
    const { tree, stranger } = withStranger()
    const a = await check(tree)
    expect(a.verdict?.problems).toEqual([expect.objectContaining({ kind: 'unsupported', at: stranger.id })])
  })

  it('🔴 工作階段：不開跑（declined），而原因說的是「還不支援」——系統能力不足，不是學生寫錯', async () => {
    const { tree } = withStranger()
    const s = p.createSession!({ maxSteps: 1000, formal: cppFormal(tree) as never }, tree)
    expect('declined' in s, '🔴 帶著一顆翻不出的元件開跑了').toBe(true)
    if ('declined' in s) expect(s.declined).toMatch(/還不支援/)
    // ⚠️ declined 的原因今天不帶那一顆的 id——指名靠判決那一條（上一支）；「指出哪一行還不支援」是 spec 205 US1 的畫面
  })

  it('🔴 學生看到的那一句要**把原因放進去**（具名佔位符有被替換）', () => {
    // 跑到一半才遇到（Cella 自己判 unsupported）走的是 RUNTIME_ERR_CELLA_UNSUPPORTED，參數是 detail（{ kind, at, why }）
    setMessages(zhTW as unknown as Record<string, string>)
    const line = describeRuntimeStop('RUNTIME_ERR_CELLA_UNSUPPORTED', { kind: 'unsupported', at: 'n1', why: 'std::regex' })
    expect(line, '🔴 佔位符沒被替換 → 畫面上會出現一個大括號').not.toMatch(/\{\w+\}/)
    expect(line).toContain('std::regex')
    expect(line, '那句話要說是「還不支援」，不是學生的錯').toContain('還不支援')
    // JS 直譯器那一句（2026-08-26 補的佔位符）在 JS 提供者拿掉之前照舊有人用
    const legacy = formatMessage('RUNTIME_ERR_UNKNOWN_COMPONENT', { component: 'cpp:foo' })
    expect(legacy).toContain('cpp:foo')
    expect(legacy).toContain('不是你寫錯了')
    resetMessages()
  })

  it('★ 反向：認得而本來就不產生動作的元件（引入、using、註解）**不受影響**——那是另一件事', async () => {
    // 少了這一條，一個「什麼都當成沒看過」的實作也能通過上面幾支。
    const r = await runCella('#include <iostream>\nusing namespace std;\n// 這是註解\nint main() {\n  cout << 1;\n  return 0;\n}\n')
    expect(r.verdict, JSON.stringify(r.untranslated)).toBe('accept')
    expect(r.out).toBe('1')
  })

  /**
   * ⚠️ 原本的反向條用的是 `cpp:include_local`（`#include "foo.h"`，JS 直譯器宣告「刻意不執行」）。
   * Cella 那一側它**翻不出**（整支不送）——而 g++ 在沒有那個檔時也編不過，所以「該照跑」不是定論（未決，回報給上層）。
   * 這裡照實斷言今天的狀態：它被說成「還不支援」，不是被靜靜跳過。
   */
  it('⚠️ `#include "foo.h"` 今天翻不出（說「還不支援」，不是靜靜跳過）', async () => {
    const r = await runCella('#include "foo.h"\n#include <iostream>\nusing namespace std;\nint main() {\n  cout << 1;\n  return 0;\n}\n')
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.construct)).toEqual(['cpp:include_local'])
  })

  it('★ 真實程式碼裡認不出的東西（`asm`）同樣整支不送，並指到那一顆', async () => {
    const tree = lift('#include <iostream>\nusing namespace std;\nint main() {\n  int total = 0;\n  asm volatile("nop");\n  total = total + 7;\n  cout << total;\n  return 0;\n}\n')
    const a = await check(tree)
    expect(a.verdict?.verdict).toBe('unknown')
    const at = a.verdict?.problems.map((x) => x.at) ?? []
    expect(at.length, '要指得出是哪一顆').toBeGreaterThan(0)
    const ids = new Set<string>()
    const walk = (n: SemanticNode): void => { ids.add(n.id); Object.values(n.slots ?? {}).forEach((k) => k.forEach(walk)) }
    walk(tree)
    expect(at.every((id) => id && ids.has(id)), `指到的要是樹裡的節點：${JSON.stringify(at)}`).toBe(true)
  })
})
