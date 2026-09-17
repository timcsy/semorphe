/**
 * **膠囊自證：`push_front`。**
 *
 * 🔴 **它從哪來：模糊測試。** 隔離出題的 10 支程式裡有 5 支卡在 `d.push_front(x)`
 * ——方法名沒登錄，掉到泛用的 method_call，拋 `UNDECLARED_VAR: d（不是一個物件）`。
 *
 * ⚠️ 探索報告當時把它排在最後（真語料只有 1 支用到），而模糊測試把它升級了：
 * **一個沒有 `push_front` 的 deque 只有一半**——學生寫雙端佇列一定兩端都用。
 *
 * > **語料量得到「他們寫了什麼」，量不到「他們會寫什麼」
 * > ——而後者要靠一個看不到實作的人去寫。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <iostream>\n#include <deque>\n#include <string>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：容器的前端加入', () => {
  it('★ lift：認得 push_front，而且不落進殘差', () => {
    const ids = collect(lift(`${H}int main(){ deque<int> dq; dq.push_front(3); }`))
    expect(ids, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_push_front')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('★ 而它沒有被誤認成「加在尾端」那一族', () => {
    const ids = collect(lift(`${H}int main(){ deque<int> dq; dq.push_front(3); }`))
    // ⚠️ 不寫別顆元件的完整身分（就近性護欄兩個方向都會報）——用尾綴比對
    expect(ids.filter((x) => /:(container_append|container_push)$/.test(x)),
      '🔴 前端被判成末端——那會把元素放到錯的那一頭').toEqual([])
  })

  it('★ generate：吐回去逐字是 push_front，而值不得掉', () => {
    const code = generateCode(lift(`${H}int main(){ deque<int> dq; dq.push_front(7); }`), 'cpp', S)
    expect(code).toContain('dq.push_front(7);')
  })

  it('★ 來回一趟是同一棵樹', () => {
    const src = `${H}int main(){ deque<int> dq; dq.push_back(1); dq.push_front(9); }`
    const once = collect(lift(src)).join(',')
    const twice = collect(lift(generateCode(lift(src), 'cpp', S))).join(',')
    expect(twice, '🔴 轉一圈回來不是同一棵樹').toBe(once)
  })

  it('🔴 execute：放進去的是【最前面】那一個', async () => {
    const r = await run(`${H}int main(){ deque<int> dq; dq.push_back(3); dq.push_back(5);`
      + ` dq.push_front(9); cout << dq.front() << dq.back() << dq.size(); }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 放錯端的話最前面會是 3').toBe('953')
  })

  it('🔴 execute：接收者帶下標也認得（`d2[3].push_front(x)`）', async () => {
    const r = await run(`${H}deque<int> d2[5];\nint main(){ d2[3].push_back(7);`
      + ` d2[3].push_front(4); cout << d2[3].front() << d2[3].back(); }`)
    expect(r.err, '🔴 帶下標的接收者在組裝時被壓成字串——要走 receiverOf').toBe('')
    expect(r.out).toBe('47')
  })

  it('🔴 execute：字串的元素不得被壓成 0', async () => {
    // 🪦 同族那顆「在尾端加入」的元件曾經寫 `elemType ?? 'int'`，於是
    //    `deque<string>` 的元素變成 0——程式跑完、印出東西、而它是錯的。
    const r = await run(`${H}int main(){ deque<string> d; d.push_front("ab");`
      + ` d.push_front("cd"); cout << d.front() << d.back(); }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 不知道元素型別就不要假裝知道').toBe('cdab')
  })
})
