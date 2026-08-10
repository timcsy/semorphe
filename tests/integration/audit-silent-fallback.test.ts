/**
 * **第三十三條護欄：靜默回退**——執行器遇到處理不了的輸入時，有沒有出聲。
 *
 * ## 它量什麼
 *
 * ```ts
 * if (arr.type !== 'array' || !Array.isArray(arr.value)) {
 *   return { type: 'int', value: 0 }        // ← 這個
 * }
 * ```
 *
 * 「這個容器是空的」與「**這根本不是容器**」在輸出上一模一樣。
 * 而 `concepts/執行機構.md` 早就給這個形狀命名了：
 *
 * > 「**靜默降級反模式**——多層 fallback 都用同一個預設值 `'x'`，
 * > 於是資料遺失和正常路徑長得一樣」
 *
 * ## ⚠️ 它為什麼值得一條護欄：它讓**別的**缺陷看不見
 *
 * 觸發本護欄的實例（`specs/110`）：`s.size()` 在字串上被辨識成
 * `cpp:vector_size`（身分錯），而 `vector_size` 對非陣列回 0
 * ——於是 `for (int i = 0; i < s.size(); i++)` **一次都不跑**，
 * 字串原樣輸出，而**沒有任何地方說出錯了**。
 *
 * **辨識的錯躲在執行的回退後面躲了很久。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判定哪一筆是錯的。** 合法的預設值與靜默回退在**語法上一模一樣**
 *   （`strcmp` 相等時回 0 是語義，不是回退）。
 *   → 第 6 步：**靜態判斷只能排順序，不能下結論。**
 *   判定的落點是 `tests/assets/silent-fallback-decisions.json`，每筆要有理由。
 * - **不檢測回退之外的靜默失敗**（吞例外、回 `null`）——另一個維度。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的執行器檔數」或「掃到的 return 總數」是 0，
 * > 代表工具壞了，不是世界長這樣。**
 *
 * 錨在**掃描的輸入量**上，不錨在回退筆數——後者正是這條護欄要推向零的東西，
 * 錨在它上面的健康檢查**會在成功的那天變紅**（`build-guardrail` 第 2 步，
 * 已經犯過七次的形狀）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'

const 護欄名 = 'silent-fallback'
const 判定檔 = path.join(REPO_ROOT, 'tests/assets/silent-fallback-decisions.json')

interface 命中 {
  位置: string
  條件: string
  回傳: string
}

interface 判定 {
  位置: string
  訊號: string
  判定: '合法' | '靜默回退'
  理由: string
}

interface 基線 {
  _meta: { note: string; ratchet: string }
  掃描: { 檔數: number; "return 總數": number }
  命中: { 筆數: number; 明細: 命中[] }
}

/** 執行器檔案——語言套件與核心的執行那一路。 */
function 執行器檔(): string[] {
  const out: string[] = []
  const 走 = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) 走(p)
      else if (e.name.endsWith('.ts') && /executors?\.ts$/.test(e.name)) out.push(p)
    }
  }
  走(path.join(REPO_ROOT, 'src/languages'))
  走(path.join(REPO_ROOT, 'src/interpreter'))
  return out
}

/**
 * 找「檢查失敗後回傳預設值」。
 *
 * ⚠️ **判準刻意寬**——寧可多報讓人判，也不要自己發明一個分得出合法與回退的
 * 規則。`build-guardrail` 第 5 步：判不出來就說判不出來，且不計入安全。
 */
function 掃(檔s: readonly string[]): { 命中: 命中[]; "return 總數": number } {
  const 命中: 命中[] = []
  let total = 0
  const 預設值 = /value:\s*(0|''|""|false|null|\[\]|\{\})\s*[,}]/
  for (const f of 檔s) {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    const rel = path.relative(REPO_ROOT, f)
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!/\breturn\b/.test(l) || !/value:/.test(l)) continue
      total++
      if (!預設值.test(l)) continue
      // 條件：同一行的 `if (…) return`，或往上找最近的 `if (`
      let 條件 = ''
      const 同行 = /if\s*\((.+?)\)\s*return/.exec(l)
      if (同行) 條件 = 同行[1]
      else {
        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
          const m = /if\s*\((.+?)\)\s*\{?\s*$/.exec(lines[j])
          if (m) { 條件 = m[1]; break }
        }
      }
      if (!條件) continue // 無條件的回傳不是回退
      命中.push({ 位置: `${rel}:${i + 1}`, 條件: 條件.trim().slice(0, 80), 回傳: l.trim().slice(0, 60) })
    }
  }
  return { 命中, "return 總數": total }
}

const 讀判定 = (): 判定[] =>
  fs.existsSync(判定檔) ? (JSON.parse(fs.readFileSync(判定檔, 'utf8')) as 判定[]) : []

describe('第三十三條護欄：靜默回退', () => {
  // ── 健康檢查：錨在掃描的輸入量（合成量），不錨在命中數 ─────────────
  it('★ 健康檢查：掃描真的吃到東西', () => {
    const 檔s = 執行器檔()
    expect(檔s.length, '一個執行器檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(10)
    const returnTotal = 掃(檔s)["return 總數"]
    expect(returnTotal, '一個帶 value 的 return 都沒有 → 掃描器沒吃到內容').toBeGreaterThan(20)
  })

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：檢查失敗後回預設值必須被報出', () => {
    const tmp = path.join(REPO_ROOT, 'tests/assets/_inject-fallback-executors.ts')
    fs.writeFileSync(tmp, `export const x = () => {\n  if (v.type !== 'array') return { type: 'int', value: 0 }\n  return { type: 'int', value: v.length }\n}\n`)
    try {
      const { 命中 } = 掃([tmp])
      expect(命中, '故意寫的回退沒被報 → 這條護欄什麼都抓不到').toHaveLength(1)
      expect(命中[0].條件).toContain("!== 'array'")
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  it('★ 注入②：無條件的回傳不得被誤報', () => {
    // 沒有這一支，一個「凡是 value: 0 都報」的掃描器也會通過注入①。
    const tmp = path.join(REPO_ROOT, 'tests/assets/_inject-clean-executors.ts')
    fs.writeFileSync(tmp, `export const x = () => {\n  return { type: 'int', value: 0 }\n}\n`)
    try {
      expect(掃([tmp]).命中, '無條件回 0 是正常的初始值，報它會讓這條護欄失去意義').toHaveLength(0)
    } finally {
      fs.rmSync(tmp, { force: true })
    }
  })

  // ── 判定落點（第 11 步） ────────────────────────────────────────
  it('每一筆判定必須有理由，且判定不得過期', () => {
    const 現 = 掃(執行器檔()).命中
    const 判定s = 讀判定()
    const 孤兒 = 判定s.filter((d) => !現.some((h) => h.位置 === d.位置))
    expect(
      判定s.filter((d) => !d.理由 || d.理由.length < 4),
      '沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(孤兒.map((d) => d.位置), '判定過期了——底下的程式碼變了，留著會讓過期的結論繼續生效').toEqual([])
  })

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('靜默回退只准下降', () => {
    const 檔s = 執行器檔()
    const 掃果 = 掃(檔s)
    const 命中 = 掃果.命中
    const returnTotal = 掃果["return 總數"]
    const 判定s = 讀判定()
    const 已判定 = new Map(判定s.map((d) => [d.位置, d]))
    const 要看 = 命中.filter((h) => !已判定.has(h.位置))
    const 回退 = 命中.filter((h) => 已判定.get(h.位置)?.判定 === '靜默回退')

    printReport('靜默回退（執行器遇到處理不了的輸入時有沒有出聲）', [
      `掃描   ${檔s.length} 個執行器檔｜${returnTotal} 個帶 value 的 return`,
      `命中   ${命中.length}（已判定 ${命中.length - 要看.length}，要看 ${要看.length}）`,
      `其中判為**靜默回退** ${回退.length} 筆 ← 棘輪盯的是這個數字`,
      '',
      ...要看.map((h, i) => `  ${i + 1}. ${h.位置}\n       if (${h.條件})\n       ${h.回傳}`),
      '',
      '⚠️ 合法與回退在語法上一模一樣（strcmp 相等回 0 是語義不是回退）——',
      '   本護欄只排順序，判定在 tests/assets/silent-fallback-decisions.json。',
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(護欄名, {
        _meta: {
          note:
            '靜默回退：執行器遇到處理不了的輸入時回傳一個與合法結果無法區分的預設值。\n' +
            '⚠️ 它的危害不只是自己錯，是**讓別的缺陷看不見**——觸發本護欄的實例是\n' +
            '`s.size()` 被辨識成 cpp:vector_size（身分錯），而 vector_size 對非陣列回 0，\n' +
            '於是 `for (i=0; i<s.size(); i++)` 一次都不跑而沒有任何訊號。辨識的錯躲在執行的回退後面。\n' +
            '⚠️ 棘輪盯的是**判為「靜默回退」的筆數**，不是命中總數——命中裡有合法的\n' +
            '（strcmp 相等回 0 是語義）。只盯總數的話，把一筆改判成「合法」就能讓數字下降。\n' +
            '⚠️ 判準刻意寬：寧可多報讓人判，也不要發明一個分得出合法與回退的規則——它們語法上相同。',
          ratchet: RATCHET_NOTE,
        },
        掃描: { 檔數: 檔s.length, 'return 總數': returnTotal },
        命中: { 筆數: 命中.length, 明細: 命中 },
      })
      return
    }

    const base = loadBaseline<基線>(護欄名)
    const 基線回退 = (base as unknown as { 回退筆數?: number }).回退筆數 ?? base.命中.筆數
    expect(要看, '有未判定的命中——護欄只排順序，判定要人做').toHaveLength(0)
    assertRatchet([['靜默回退筆數', 回退.length, 基線回退]])
  })
})
