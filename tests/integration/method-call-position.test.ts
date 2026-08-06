/**
 * 方法呼叫的敘述／運算式身分（078）
 *
 * ## 這個缺口
 *
 * `x.f();` 單獨一行是**敘述**，`int a = x.f();` 裡的是**運算式**。系統有兩個
 * 概念分別對應，而辨識器**永遠產出運算式版**——敘述位置的身分永遠拿不到。
 *
 * 後果不是「跑不動」（運算式版在敘述位置也執行得了），是**身分掉了**：
 * 使用者拖一個「呼叫方法」的敘述積木、存檔、讀回來，它變成一個運算式積木。
 *
 * ## 為什麼這一支釘兩個方向
 *
 * 只驗「敘述位置要拿到敘述身分」的話，一個**永遠**回傳敘述版的實作也會過
 * ——而那會把真正的運算式位置也弄錯。兩個方向都要釘。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function concepts(code: string): string[] {
  const sem = lifter.lift(tp.parse(code)!.rootNode as never)
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n) return
    if (n.concept) out.push(n.concept)
    for (const k of Object.keys(n.children ?? {})) {
      const v = (n.children as Record<string, SemanticNode[]>)[k]
      for (const c of Array.isArray(v) ? v : [v]) walk(c)
    }
  }
  walk(sem)
  return out
}

describe('方法呼叫的位置決定身分', () => {
  it('★ 敘述位置 → 敘述身分', () => {
    const c = concepts('int main(){ MyObj x; x.doThing(); }')
    expect(c, '敘述位置拿到的是運算式身分——存檔讀回來積木會換一個').toContain('cpp_method_call')
  })

  it('★ 運算式位置 → 運算式身分（只釘一個方向的話，「永遠回敘述版」也會過）', () => {
    const c = concepts('int main(){ MyObj x; int a = x.getThing(); }')
    expect(c, '運算式位置拿到敘述身分——那會讓賦值的右邊變成一個敘述').toContain('cpp_method_call_expr')
    expect(c).not.toContain('cpp_method_call')
  })

  it('★ 巢狀在運算式裡 → 運算式身分', () => {
    const c = concepts('int main(){ MyObj x; int a = 1 + x.getThing(); }')
    expect(c).toContain('cpp_method_call_expr')
    expect(c).not.toContain('cpp_method_call')
  })

  it('★ 已知的容器／字串方法不受影響——它們有自己的專屬身分', () => {
    const c = concepts('int main(){ vector<int> v; v.clear(); }')
    expect(c, '專屬身分被泛用的敘述版蓋掉了').toContain('cpp_container_clear')
    expect(c).not.toContain('cpp_method_call')
  })
})
