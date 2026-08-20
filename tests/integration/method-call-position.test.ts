/**
 * 方法呼叫的敘述／運算式**形態**（078 → B 項改寫）
 *
 * ## 原本的缺口與它的第一次修法
 *
 * `x.f();` 單獨一行是**敘述**，`int a = x.f();` 裡的是**運算式**。辨識器原本
 * 永遠產出運算式版，於是敘述位置的身分拿不到——使用者拖一個敘述積木、存檔、
 * 讀回來，它變成一個運算式積木。
 *
 * 078 的修法是**依語法樹的父節點在兩個身分之間選**。那修好了症狀，
 * 但**把位置修進了錯的槽**：位置變成身分的一部分，於是每一對雙版本都要在
 * 五路上各維護一份，而 `saveExtraState` 的格式契約要人工同步。
 *
 * ## B 項改寫成什麼
 *
 * **位置不是身分，是形態。** 語義樹裡只有一個 `cpp_method_call`；
 * 敘述位置與運算式位置**選到不同的積木**。所以這一支現在釘的是**形態**——
 * 而它擔心的那件事（存檔往返後積木變了）仍然要驗，只是驗在對的層。
 *
 * ## 為什麼仍然釘兩個方向
 *
 * 只驗一個方向的話，「永遠回同一個形態」的實作也會過。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { setupTestRenderer } from '../helpers/setup-renderer'
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
  setupTestRenderer()
})

/** 渲染出來的積木型別——**形態**驗在這裡，不在身分上 */
function blockType(code: string): string[] {
  const sem = lifter.lift(tp.parse(code)!.rootNode as never)
  const state = renderToBlocklyState(sem as never) as { blocks?: { blocks?: unknown[] } }
  const out: string[] = []
  const walk = (b: unknown): void => {
    if (!b || typeof b !== 'object') return
    const blk = b as { type?: string; inputs?: Record<string, { block?: unknown }>; next?: { block?: unknown } }
    if (blk.type) out.push(blk.type)
    for (const v of Object.values(blk.inputs ?? {})) walk(v?.block)
    walk(blk.next?.block)
  }
  for (const b of state.blocks?.blocks ?? []) walk(b)
  return out
}

function concepts(code: string): string[] {
  const sem = lifter.lift(tp.parse(code)!.rootNode as never)
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n) return
    if (n.componentId) out.push(n.componentId)
    for (const k of Object.keys(n.children ?? {})) {
      const v = (n.children as Record<string, SemanticNode[]>)[k]
      for (const c of Array.isArray(v) ? v : [v]) walk(c)
    }
  }
  walk(sem)
  return out
}

describe('方法呼叫：位置決定形態，不決定身分', () => {
  it('★ 兩個位置都是**同一個身分**', () => {
    expect(concepts('int main(){ MyObj x; x.doThing(); }')).toContain('cpp:method_call')
    expect(
      concepts('int main(){ MyObj x; int a = x.getThing(); }'),
      '運算式位置拿到不同的身分 → 位置又被編碼進身分了',
    ).toContain('cpp:method_call')
  })

  it('★ 而語義樹裡**不存在**運算式版的身分', () => {
    const c = concepts('int main(){ MyObj x; int a = 1 + x.getThing(); }')
    expect(c, 'B 項合併掉的身分又出現了').not.toContain('cpp_method_call_expression')
  })

  it('★ 敘述位置渲染成敘述積木', () => {
    const type = blockType('int main(){ MyObj x; x.doThing(); }')
    // 積木型別，不是身分——遷移不動它
    expect(type).toContain('cpp_method_call')
  })

  it('★ 運算式位置渲染成**運算式積木**（只釘一個方向的話，「永遠回敘述版」也會過）', () => {
    const type = blockType('int main(){ MyObj x; int a = x.getThing(); }')
    expect(
      type,
      '運算式位置沒拿到運算式形態——那會讓賦值的右邊掉進 raw_expression',
    ).toContain('cpp_method_call_expression')
  })

  it('★ 已知的容器／字串方法不受影響——它們有自己的專屬身分', () => {
    const c = concepts('int main(){ vector<int> v; v.clear(); }')
    expect(c, '專屬身分被泛用的敘述版蓋掉了').toContain('cpp:container_clear')
    expect(c).not.toContain('cpp:method_call')
  })
})
