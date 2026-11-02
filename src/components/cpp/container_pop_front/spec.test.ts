/**
 * **膠囊自證：`pop_front`。**
 *
 * 🔴 **它從哪來**：使用者學生的 218 支競賽練習，拿 g++ 比對執行結果時
 * 18 支撞在這裡（`deque` 的 BFS 佇列是 AP325 的日常）。
 * 症狀是方法名沒登錄 → 掉到泛用的 method_call → `UNDECLARED_VAR: dq（不是一個物件）`。
 *
 * ⚠️ **被抄的那顆沒有自證測**（同族那顆移除末端元素的膠囊沒有 `spec.test.ts`）——
 * 233 顆膠囊裡只有 40 顆有。抄它的人會抄到同一個洞，所以這一顆補上。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
const run = (c: string, expected: string) => expectCellaOut(c, expected)
const H = '#include <iostream>\n#include <deque>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：容器的前端移除', () => {
  it('★ lift：認得 pop_front，而且不落進殘差', () => {
    const ids = collect(lift(`${H}int main(){ deque<int> dq; dq.push_back(3); dq.pop_front(); }`))
    expect(ids, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_pop_front')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('★ 而它沒有被誤認成 pop_back 那一族', () => {
    const ids = collect(lift(`${H}int main(){ deque<int> dq; dq.pop_front(); }`))
    // ⚠️ 不寫別顆元件的完整身分（就近性護欄兩個方向都會報）——用尾綴比對
    const tail = ids.filter((x) => /:(vector_pop|container_pop)$/.test(x))
    expect(tail, '🔴 前端被判成末端——那會靜靜地拿掉錯的那一個').toEqual([])
  })

  it('★ generate：吐回去逐字是 pop_front', () => {
    const code = generateCode(lift(`${H}int main(){ deque<int> dq; dq.pop_front(); }`), 'cpp', S)
    expect(code).toContain('dq.pop_front();')
  })

  it('★ 來回一趟是同一棵樹', () => {
    const src = `${H}int main(){ deque<int> dq; dq.push_back(1); dq.pop_front(); }`
    const once = collect(lift(src)).join(',')
    const twice = collect(lift(generateCode(lift(src), 'cpp', S))).join(',')
    expect(twice, '🔴 轉一圈回來不是同一棵樹').toBe(once)
  })

  it('🔴 execute：拿掉的是【最前面】那一個', async () => {
    // 🔴 拿錯端的話這裡會是 3
    await run(`${H}int main(){ deque<int> dq; dq.push_back(3); dq.push_back(5);`
      + ` dq.pop_front(); cout << dq.front() << dq.size(); }`, '51')
  })

  it('🔴 execute：接收者帶下標也認得（`d2[3].pop_front()`）', async () => {
    // 🔴 帶下標的接收者在組裝時被壓成字串——要走 receiverOf
    await run(`${H}deque<int> d2[5];\nint main(){ d2[3].push_back(7); d2[3].push_back(9);`
      + ` d2[3].pop_front(); cout << d2[3].front(); }`, '9')
  })

  // 🔴 空容器上 pop_front 是未定義行為——原本錨的「什麼都不做、印 0」是 JS 直譯器自己的選擇，不是 C++ 的答案。
  //    換成 Cella 之後改錨判決：它必須被抓到（reject，越界）。
  it('⚠️ 空容器上呼叫：未定義行為要被抓到（reject）', async () => {
    const r = await runCella(`${H}int main(){ deque<int> dq; dq.pop_front(); cout << dq.size(); }`)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubBounds')
  })
})
