/**
 * 🔴 改一個宣告的名字，參照要跟著改。
 *
 * 2026-09-01 錄示範時撞到：在流程上把宣告的名字從 n 改成 total，
 * 而迴圈條件裡的 n 留在原地——**按執行才炸**（變數 n 尚未宣告）。
 *
 * ⚠️ 而它只有按執行才看得到：語義樹與三個投影當下都覺得自己是對的。
 *
 * > 改名是一次【重構】，而設一個屬性只是設一個屬性
 * > ——兩者在畫面上看起來一樣，直到你去跑它。
 *
 * ⚠️ 註解裡不寫含大括號／分號的反引號——第五十三與第三十一條護欄把這個
 * 目錄裡的反引號片段當成 C++ 語料。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import {
  renameReferences, scopeOf, isRenamingADefinition, isVariableReference, detectRename,
} from '../../src/core/rename-variable'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => process.cwd() + '/public/' + s })
  tp = new Parser()
  tp.setLanguage(await Language.load(process.cwd() + '/public/tree-sitter-cpp.wasm'))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (src: string): SemanticNode =>
  lifter.lift(tp.parse(src)!.rootNode as never) as unknown as SemanticNode

function find(n: SemanticNode, pred: (x: SemanticNode) => boolean): SemanticNode | null {
  if (pred(n)) return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of (kids ?? []) as SemanticNode[]) {
      const hit = k && find(k, pred)
      if (hit) return hit
    }
  }
  return null
}

function names(n: SemanticNode, out: string[] = []): string[] {
  if (isVariableReference(n.componentId)) out.push(String(n.properties.name))
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of (kids ?? []) as SemanticNode[]) if (k) names(k, out)
  }
  return out
}

const SRC = 'int main() {\n  int n = 5;\n  for (int i = 0; i < n; i++) { }\n  return 0;\n}'

describe('改名跟得上參照', () => {
  it('⚠️ 入口條件：那支程式真的有一個指向 n 的參照', () => {
    expect(names(lift(SRC))).toContain('n')
  })

  it('🔴 把宣告改名，迴圈條件裡的參照要跟著改', () => {
    const tree = lift(SRC)
    const decl = find(tree, (x) => x.properties?.name === 'n' && !isVariableReference(x.componentId))
    expect(decl, '找不到那顆宣告——下面的斷言會是空過的').not.toBeNull()

    expect(isRenamingADefinition(decl!.componentId, 'name'),
      '這顆應該被認成【定義】：' + decl!.componentId).toBe(true)

    ;(decl!.properties as Record<string, unknown>).name = 'total'
    const changed = renameReferences(scopeOf(tree, decl!), 'n', 'total')

    expect(changed, '一顆參照都沒改到').toBeGreaterThan(0)
    expect(names(tree), '還有參照留在舊名字上').not.toContain('n')
    expect(names(tree)).toContain('total')
  })

  it('🔴 改一個【參照】的名字不得波及別人——那是換一個指向，不是改名', () => {
    const tree = lift(SRC)
    const ref = find(tree, (x) => isVariableReference(x.componentId))
    expect(isRenamingADefinition(ref!.componentId, 'name')).toBe(false)
  })

  it('⚠️ 作用域：別的函式裡同名的變數不得被波及', () => {
    const tree = lift(
      'void other() {\n  int n = 1;\n  n = n + 1;\n}\n'
      + 'int main() {\n  int n = 5;\n  for (int i = 0; i < n; i++) { }\n  return 0;\n}')
    const mainFn = find(tree, (x) => x.properties?.name === 'main')
    const decl = find(mainFn!, (x) => x.properties?.name === 'n' && !isVariableReference(x.componentId))
    ;(decl!.properties as Record<string, unknown>).name = 'total'
    renameReferences(scopeOf(tree, decl!), 'n', 'total')
    // other() 裡的那兩個 n 要原封不動
    const otherFn = find(tree, (x) => x.properties?.name === 'other')
    expect(names(otherFn!), 'other() 裡的 n 被波及了').not.toContain('total')
  })

  it('沒有人用那個變數時，改 0 顆——而那不是失敗', () => {
    const tree = lift('int main() {\n  int unused = 1;\n  return 0;\n}')
    expect(renameReferences(tree, 'unused', 'x')).toBe(0)
  })
})

/**
 * 🔴 積木那一側：整棵樹重抽，所以「舊名字是什麼」只有比對前後才知道。
 *
 * > 同一個缺陷在兩個視圖上，可能需要兩種修法
 * > ——而讓它們看起來一樣的，是症狀，不是原因。
 */
describe('比對前後兩棵樹，認出這是不是一次改名', () => {
  const clone = (t: SemanticNode): SemanticNode => structuredClone(t)

  it('🔴 只有宣告的名字變了 ⟹ 認出是改名', () => {
    const before = lift(SRC)
    const after = clone(before)
    const decl = find(after, (x) => x.properties?.name === 'n' && !isVariableReference(x.componentId))
    ;(decl!.properties as Record<string, unknown>).name = 'total'

    const r = detectRename(before, after)
    expect(r, '沒認出來').not.toBeNull()
    expect(r!.oldName).toBe('n')
    expect(r!.newName).toBe('total')
  })

  it('🔴 兩格同時變了就【不猜】——猜錯的代價是改掉別人的變數', () => {
    const before = lift(SRC)
    const after = clone(before)
    const decl = find(after, (x) => x.properties?.name === 'n' && !isVariableReference(x.componentId))
    ;(decl!.properties as Record<string, unknown>).name = 'total'
    const ref = find(after, (x) => isVariableReference(x.componentId))
    ;(ref!.properties as Record<string, unknown>).name = 'whatever'
    expect(detectRename(before, after)).toBeNull()
  })

  it('⚠️ 形狀變了（有人增刪節點）也不猜', () => {
    const before = lift(SRC)
    const after = lift('int main() {\n  int n = 5;\n  return 0;\n}')
    expect(detectRename(before, after)).toBeNull()
  })

  it('⚠️ 什麼都沒變 ⟹ 不是改名', () => {
    const before = lift(SRC)
    expect(detectRename(before, clone(before))).toBeNull()
  })

  it('🔴 改一個【參照】的名字不算改名——那是換一個指向', () => {
    const before = lift(SRC)
    const after = clone(before)
    const ref = find(after, (x) => isVariableReference(x.componentId))
    ;(ref!.properties as Record<string, unknown>).name = 'other'
    expect(detectRename(before, after)).toBeNull()
  })
})
