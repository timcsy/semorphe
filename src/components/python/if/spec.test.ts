/** `python:if` 的自證測（spec 169）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'
import type { SemanticNode } from '../../../core/types'

const findIf = (n: SemanticNode | null): SemanticNode | null =>
  !n ? null : n.componentId === 'python:if' ? n
    : Object.values(n.children ?? {}).flat().map((k) => findIf(k)).find(Boolean) ?? null

describe('python:if', () => {
  it('★ lift：三種形狀都認得出來（沒有 else／有 else／有 elif）', async () => {
    for (const src of [
      'if a:\n    b = 1\n',
      'if a:\n    b = 1\nelse:\n    b = 2\n',
      'if a:\n    b = 1\nelif c:\n    b = 2\n',
    ]) {
      expect(componentIdsOf(await liftPython(src)), src).toContain('python:if')
    }
  })

  it('🔴 `elif` 不再降級——spec 168 那個刻意的邊界收掉了', async () => {
    const t = await liftPython('if a:\n    b = 1\nelif c:\n    b = 2\nelse:\n    b = 3\n')
    const n = findIf(t)!
    expect(n, '★ 錨點：先要找得到那顆節點').toBeTruthy()
    expect(n.children.elif_condition?.length, 'elif 的條件沒接進來').toBe(1)
    expect(n.children.elif_body?.length, '🔴 兩個清單靠索引配對，長度必須相同').toBe(1)
    expect(n.children.else_body?.length, 'else 沒接進來').toBe(1)
  })

  it('🔴 多段 elif：兩個清單長度必須相同——錯開的話每一格都還在，只是接錯了人', async () => {
    const n = findIf(await liftPython(
      'if a:\n    x = 1\nelif b:\n    x = 2\nelif c:\n    x = 3\nelif d:\n    x = 4\n'))!
    expect(n.children.elif_condition?.length).toBe(3)
    expect(n.children.elif_body?.length).toBe(3)
  })

  it('★ generate ＋ round-trip：三種形狀都一字不差', async () => {
    for (const src of [
      'if a:\n    b = 1',
      'if a:\n    b = 1\nelse:\n    b = 2',
      'if a:\n    b = 1\nelif c:\n    b = 2\nelse:\n    b = 3',
    ]) {
      expect(gen(await liftPython(src + '\n')), src).toBe(src)
    }
  })

  it('🔴 條件認不出來時，那一支【不得消失】——原文要一字不差地留著', async () => {
    // ⚠️ **這一支原本斷言「整顆降級」，而那個前提是錯的**（2026-08-21 實測）：
    // 認不出來的子節點會誠實降級成灰色積木，**原文完整保留**，
    // 而分支結構還在。整顆降級反而【更糟】——學生會失去整個 if 的形狀。
    //
    // > **降級的粒度愈小，使用者留住的結構愈多——
    // > 而「整顆降級」聽起來比較安全，其實是把還認得的部分也丟了。**
    const src = 'if a:\n    x = 1\nelif b := 2:\n    x = 3\n'
    const t = await liftPython(src)
    expect(componentIdsOf(t), '★ 錨點：if 的結構要留著').toContain('python:if')
    expect(gen(t), '🔴 認不出來的那一段原文掉了').toBe(src.trim())
  })
})
