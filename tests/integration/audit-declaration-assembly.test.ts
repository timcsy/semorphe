/**
 * **第三十七條護欄：宣告來源的組裝點**——誰在自己列一份「全部的元件」？
 *
 * ## 它量什麼
 *
 * ```ts
 * const allConcepts = [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
 * //                                                                                    ↑ 膠囊不在這裡
 * ```
 *
 * 專案有一個組裝函式 `allCppConcepts()`／`allCppProjections()`，它含膠囊。
 * 而**每一處自己列來源的地方，都會在下一顆元件搬進膠囊時漏掉它**。
 *
 * ## ⚠️ 它為什麼值得一條護欄：症狀指向被害者，不是兇手
 *
 * 2026-08-11 一天之內踩了四次，每一次的錯誤訊息都不一樣、都不提「組裝」：
 *
 * | 檔 | 訊息 |
 * |---|---|
 * | `code-to-blocks` | 「`x += 5` 辨識不出 `cpp:var_assign_compound`」 |
 * | `identity-merge-expr-pairs` | 「`cpp_increment_expression` 不見了」 |
 * | `p3-json-only` | 「lift 回傳 null」 |
 * | `scaffold-codegen` | 「`⟨unknown concept: cpp:using_namespace⟩`」 |
 *
 * 四個訊息各自看起來都像「那顆元件壞了」。
 *
 * > **一份少一半的組裝，錯誤訊息會指向被害者，不是兇手。**
 *
 * 這是 `specs/104` 的**卡點 6「八份各自組裝」**在宣告這一維的重演——
 * 那次的處方是「收斂成一個組裝點」，而**收斂之後沒有東西擋住第九份出現**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測組裝出來的內容對不對**。它只問「有沒有把膠囊算進去」。
 * - **不檢測 production 程式碼**——`all-declarations.ts` 自己就是那個組裝點，
 *   `module.ts` 是它的消費者。判準限定在 `tests/`。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的測試檔數」是 0，代表工具壞了，不是世界長這樣。**
 *
 * 錨在**掃描的輸入量**上，不錨在「還有幾份各自組裝」——後者正是這條護欄要
 * 推向零的數字，錨在它上面的健康檢查**會在成功的那天變紅**
 * （`build-guardrail` 第 2 步，本專案已經犯過六次的形狀）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'

const 護欄名 = 'declaration-assembly'

interface 基線 {
  _meta: { note: string; ratchet: string }
  掃描: { 測試檔數: number }
  各自組裝: number
  明細: string[]
}

/** 遞迴找 `tests/` 底下所有測試檔。 */
function 測試檔(): string[] {
  const out: string[] = []
  const 走 = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) 走(p)
      else if (e.name.endsWith('.test.ts')) out.push(p)
    }
  }
  走(path.join(REPO_ROOT, 'tests'))
  return out
}

/**
 * 一份文字有沒有「自己列宣告來源、而且沒把膠囊算進去」。
 *
 * ⚠️ 分成純函式，理由與別條護欄相同：**錨在真實檔案上的注入測試，
 * 會在那些檔案被修好的那天失效**。
 */
export function 偵測各自組裝(內容: string): boolean {
  const 自己列 = /\.\.\.\s*universalConcepts|m\.concepts\b/.test(內容)
  if (!自己列) return false
  const 有膠囊 = /componentConcepts\(\)|allCppConcepts\(\)/.test(內容)
  return !有膠囊
}

describe('第三十七條護欄：宣告來源的組裝點', () => {
  it('★ 健康檢查：掃描真的吃到東西', () => {
    // ⚠️ 錨在**輸入量**上。不錨在「還有幾份各自組裝」——那是要推向零的數字。
    expect(測試檔().length, '一個測試檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
  })

  it('★ 注入①：自己列來源而沒算膠囊，必須被報出', () => {
    expect(偵測各自組裝('const all = [...universalConcepts, ...coreConcepts]')).toBe(true)
    expect(偵測各自組裝('allStdModules.flatMap(m => m.concepts)')).toBe(true)
  })

  it('★ 注入②：算了膠囊的、以及根本沒列來源的，都不得被報', () => {
    // 這一條不可省。沒有它，一個「什麼都報」的掃描器也能通過注入①。
    expect(偵測各自組裝('const all = [...universalConcepts, ...componentConcepts()]')).toBe(false)
    expect(偵測各自組裝('const all = allCppConcepts()')).toBe(false)
    expect(偵測各自組裝('沒有任何宣告來源的一支測試')).toBe(false)
  })

  it('棘輪：各自組裝的測試檔只准下降', () => {
    const 檔s = 測試檔()
    const 明細 = 檔s
      .filter((f) => 偵測各自組裝(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO_ROOT, f))
      .sort()

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(護欄名, {
        _meta: {
          note:
            '各自列宣告來源、而沒把膠囊算進去的測試檔數。\n' +
            '處方：改用 `allCppConcepts()` / `allCppProjections()`（它們含膠囊）。\n' +
            '⚠️ 這個數字只准下降，而**下降必須是因為改用組裝函式**，' +
            '不是因為那支測試被刪掉了。',
          ratchet: RATCHET_NOTE,
        },
        掃描: { 測試檔數: 檔s.length },
        各自組裝: 明細.length,
        明細,
      } satisfies 基線)
      return
    }

    const base = loadBaseline<基線>(護欄名)
    printReport('宣告來源的組裝點', [
      `掃描   ${檔s.length} 個測試檔`,
      `各自組裝 ${明細.length}（基線 ${base.各自組裝}）`,
      ...明細.map((m) => `  ✘ ${m}`),
    ])
    const 新增 = 明細.filter((m) => !base.明細.includes(m))
    expect(新增, `新增了各自組裝的地方——請改用 allCppConcepts()：\n  ${新增.join('\n  ')}`).toEqual([])
    assertRatchet([['各自組裝', 明細.length, base.各自組裝]])
  })
})
