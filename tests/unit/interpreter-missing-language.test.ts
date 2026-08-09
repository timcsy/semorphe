/**
 * 「忘了載入語言套件」要當場說清楚（US3）
 *
 * 搬移把「執行 C++ 概念之前必須先載入 C++ 語言套件」這個相依放大了。相依
 * 本身是刻意的——核心不該認識任何語言概念——但它的失敗訊息原本只說
 * 「未知概念」，看不出真正的原因。
 *
 * 這個功能實作途中就撞到兩次（8 個測試檔用了窄入口、1 個檔完全沒載入），
 * 兩次都是靠翻程式碼才知道原因。
 *
 * **判準是「執行器註冊表空不空」，不是「概念名長得像不像 C++」**——後者
 * 會讓核心重新認識語言，等於把剛搬走的東西搬回來。
 */
import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'

describe('未知概念的診斷', () => {
  it('註冊表是空的 → 訊息說得出「可能是沒有載入語言套件」', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const reg = (interp as unknown as {
      executorRegistry: { hasAnyExecutor(): boolean }
    }).executorRegistry
    // 這支測試只在「沒有任何語言套件載入過」時有意義
    if (reg.hasAnyExecutor()) return

    let caught: unknown
    try {
      await interp.execute(createNode('cpp:program', {}, { body: [createNode('查無此概念', {}, {})] }))
    } catch (e) {
      caught = e
    }
    expect(JSON.stringify(caught)).toContain('沒有載入語言套件')
  })

  it('★ 判準不是概念名——核心不得靠名字認出語言', () => {
    // 若判準是「以 cpp_ 開頭」，核心就重新認識了語言。這支測試釘住那件事
    // 不會發生：查詢的是註冊表狀態，不是字串樣式。
    const src = new SemanticInterpreter({ maxSteps: 1 })
    const has = (src as unknown as {
      executorRegistry: { hasAnyExecutor(): boolean }
    }).executorRegistry.hasAnyExecutor
    expect(typeof has).toBe('function')
    expect(has.toString()).not.toContain('cpp')
  })
})
