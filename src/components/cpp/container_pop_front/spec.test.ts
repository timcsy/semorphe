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
    const r = await run(`${H}int main(){ deque<int> dq; dq.push_back(3); dq.push_back(5);`
      + ` dq.pop_front(); cout << dq.front() << dq.size(); }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 拿錯端的話這裡會是 3').toBe('51')
  })

  it('🔴 execute：接收者帶下標也認得（`d2[3].pop_front()`）', async () => {
    const r = await run(`${H}deque<int> d2[5];\nint main(){ d2[3].push_back(7); d2[3].push_back(9);`
      + ` d2[3].pop_front(); cout << d2[3].front(); }`)
    expect(r.err, '🔴 帶下標的接收者在組裝時被壓成字串——要走 receiverOf').toBe('')
    expect(r.out).toBe('9')
  })

  it('⚠️ 空容器上呼叫：我們選擇什麼都不做，而它【不出錯】', async () => {
    // 🔴 這是未定義行為，所以**這一條只錨我們自己的選擇**，
    //    不得寫進拿 g++ 當權威的那條護欄（見檔頭與 interpreter-matches-compiler 的檔頭）。
    const r = await run(`${H}int main(){ deque<int> dq; dq.pop_front(); cout << dq.size(); }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('0')
  })
})
