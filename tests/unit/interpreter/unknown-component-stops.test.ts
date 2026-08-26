/**
 * **沒看過的東西 → 停下來，而且說得出是哪一顆。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字（`vision.md:524`）：
 * 「**如果沒看過的東西就不要執行下去了，要誠實的說沒看過**」。
 *
 * 在此之前直譯器掛著一個 `unknownComponentHandler`，回 `'skip' | 'abort'`，
 * 而 UI 用 `confirm()` 去問學生要不要跳過。那個對話框的退路訊息逐字：
 *
 * ```
 * Click OK to skip it and continue, or Cancel to stop execution.
 * ```
 *
 * 🔴 **`'skip'` 不是「跳過一行」，是「帶著錯的狀態繼續跑」**：
 *
 * ```
 * 跳過一個【輸出】   少印一行              ← 看得出來
 * 跳過一個【賦值】   後面每行都讀錯的值    ← 看不出來，而且每一步都【正常】
 * ```
 *
 * ## 這支釘什麼（第七十五條護欄釘不到的那一半）
 *
 * 護欄釘的是「`'skip'` 這個字不在 `src/` 裡」——那是**形狀**。
 * 這支釘的是**行為**：真的餵一顆沒看過的元件進去，它會不會停、說不說得出名字。
 *
 * > **一條數字歸零的護欄，證明不了那件事真的做對了。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { RuntimeError } from '../../../src/interpreter/errors'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { setMessages, formatMessage, resetMessages } from '../../../src/i18n/messages'
import type { SemanticNode } from '../../../src/core/types'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'

const n = (component: string, children: Record<string, SemanticNode[]> = {}): SemanticNode =>
  ({ id: 'x1', componentId: component, properties: {}, children }) as unknown as SemanticNode

beforeAll(() => registerCppLanguage())

describe('沒看過的元件：停下來並指名', () => {
  it('🔴 執行一顆沒看過的元件 → 丟 UNKNOWN_COMPONENT，**不是靜靜返回**', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    await expect(interp.executeNode(n('cpp:this_does_not_exist'))).rejects.toThrow(RuntimeError)
  })

  it('🔴 錯誤帶得出**是哪一顆**——沒有名字的誠實只有一半', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    const err = await interp.executeNode(n('cpp:this_does_not_exist')).catch((e: unknown) => e)
    expect((err as RuntimeError).params.component).toBe('cpp:this_does_not_exist')
  })

  it('🔴 學生看到的那一句要**把名字放進去**（那個具名佔位符 有被替換）', () => {
    // 這一條是 2026-08-26 補的：訊息本來沒有任何佔位符，
    // 於是 `component` 這個參數**傳了而永遠不會被顯示**。
    setMessages(zhTW as unknown as Record<string, string>)
    const line = formatMessage('RUNTIME_ERR_UNKNOWN_COMPONENT', { component: 'cpp:foo' })
    expect(line, '🔴 佔位符沒被替換 → 畫面上會出現一個大括號').not.toContain('{component}')
    expect(line).toContain('cpp:foo')
    expect(line, '而那句話仍然要說「不是你寫錯了」').toContain('不是你寫錯了')
    resetMessages()
  })

  it('★ 反向：宣告過「刻意不執行」的元件**不受影響**——那是另一件事', async () => {
    // `isSkipped`（概念自己宣告 skipPaths）與「沒看過」是兩件事。
    // 少了這一條，一個「什麼都丟」的實作也能通過上面三支。
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    await expect(interp.executeNode(n('cpp:include_local'))).resolves.toBeUndefined()
  })
})
