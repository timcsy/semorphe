/**
 * **第九十八條護欄**：剝掉一個字面前綴時，長度要用 `.length` 算，不要手寫數字。
 *
 * ## 它從哪來
 *
 * 2026-08-31，`app.ts` 的骨架選單：
 *
 * ```ts
 * if (v.startsWith('skeleton:')) this.setSkeleton(v.slice(6))     // 🔴 'skeleton:' 是 9 個字
 * else if (v.startsWith('mode:')) this.setScaffoldMode(v.slice(5)) //    'mode:' 是 5，剛好對
 * ```
 *
 * `'skeleton:arduino'.slice(6)` ＝ `'on:arduino'` → 查不到那份骨架 →
 * `setSkeleton` 第一行就 `return`。**「選骨架」這個功能從來沒有真的執行過**，
 * 而使用者逐字回報的是「換骨架沒反應」「C++ 也無法點選其他骨架」。
 *
 * ⚠️ **症狀不是報錯**（console 有一行 error，而沒有人在看）：畫面上就是
 * 「點了，什麼都沒發生」。而它與隔壁那個**對的**分支在同一個 `if/else` 裡。
 *
 * > **兩個手寫的長度並排時，錯的那個看起來與對的那個一樣正常。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果掃到的 `.ts` 檔少於 100、或一組 `startsWith(…)…slice(N)` 都配不到，
 * > 代表掃描器沒讀到原始碼——這份報表不算數，不是「長度都算對了」。**
 *
 * ⚠️ 錨在**掃到幾個檔、配到幾組**（合成量），**不是**錨在「錯的還剩幾組」
 * ——後者會在這條護欄成功的那天變紅。
 *
 * ## 🔴 第一次跑是綠的，而那是【例外】
 *
 * `build-guardrail` §6.5 要求新護欄第一次跑必須是紅的。這一條不是——
 * 因為**它要抓的那一筆在同一輪被修掉了**（護欄該先蓋，而這次是缺陷先被使用者
 * 撞到）。所以它的健康完全靠下面的注入，不靠第一次的紅。
 *
 * ## 為什麼是硬性零
 *
 * - 「留一筆規範還成立嗎？」——留一個算錯的長度，那個功能就是壞的。**不成立。**
 * - 「修一筆要付多少？」——把數字換成 `.length`。**不會改變任何正確的行為。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測 `slice` 的其他用法**（`slice(1)` 剝一個引號、`slice(0, n)` 截斷）
 *   ——只看「同一段裡先 `startsWith('字面')` 才 `slice(數字)`」這個形狀。
 * - **不檢測變數前綴**（`startsWith(PREFIX)`）——那本來就不會算錯。
 * - **不檢測 `substring`／正則**——今天沒有這個形狀，有了再加。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

export interface Pair { readonly literal: string; readonly n: number; readonly line: number }

/**
 * 同一段裡「先 `startsWith('字面')`、再 `slice(數字)`」的每一組。
 *
 * ⚠️ 刻意不跨行找：跨行的話 `if (a.startsWith('x')) { … } b.slice(3)` 會被配在
 * 一起，而它們無關。**寧可漏報也不誤報——一個會誤報的檢查會被關掉。**
 */
export function prefixSlicePairs(text: string): Pair[] {
  const out: Pair[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.trimStart().startsWith('*') || l.trimStart().startsWith('//')) continue
    for (const m of l.matchAll(/startsWith\((['"])(.+?)\1\)[^\n]*?slice\((\d+)\)/g)) {
      out.push({ literal: m[2], n: Number(m[3]), line: i + 1 })
    }
  }
  return out
}

export const isWrong = (p: Pair): boolean => p.literal.length !== p.n

describe('第九十八條護欄：剝前綴的長度不要手寫', () => {
  const files = walk(SRC)
  const pairs = files.flatMap((f) =>
    prefixSlicePairs(fs.readFileSync(f, 'utf8')).map((p) => ({ ...p, file: path.relative(SRC, f) })))

  it('★ 入口條件——真的讀到原始碼，也真的配到這個形狀', () => {
    // 錨在合成量（掃到幾個檔、配到幾組），見檔頭的自我否證聲明。
    // 🔴 這兩個數字【不會】因為算錯的長度被修好而變小。
    expect(
      files.length,
      `🔴 只掃到 ${files.length} 個 .ts → 路徑錯了，這份報表不算數。⚠️ 這【不】代表長度都算對。`,
    ).toBeGreaterThan(100)
    expect(
      pairs.length,
      `🔴 一組 startsWith(…)…slice(N) 都沒配到 → 正則沒吃到東西，這份報表不算數`,
    ).toBeGreaterThan(0)
  })

  it('★ 注入（會報）：長度算錯的要被抓到', () => {
    // ⚠️ 合成字面，不是真實程式碼——真實的會被修好，而合成規則不會
    const bad = prefixSlicePairs(`if (v.startsWith('aaaa:')) f(v.slice(3))`)
    expect(bad.map((p) => [p.literal, p.n])).toEqual([['aaaa:', 3]])
    expect(bad.every(isWrong), '🔴 算錯的長度沒被判為錯').toBe(true)
  })

  it('★ 注入（不亂報）：長度算對的不可被判為錯', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支
    const ok = prefixSlicePairs(`if (v.startsWith('aaaa:')) f(v.slice(5))`)
    expect(ok.map((p) => p.n)).toEqual([5])
    expect(ok.some(isWrong), '🔴 正確的寫法被誤判').toBe(false)
  })

  it('★ 注入：註解與變數前綴不算數', () => {
    expect(prefixSlicePairs(`  // v.startsWith('aaaa:') 然後 v.slice(3)`), '🔴 把註解當程式碼').toEqual([])
    expect(prefixSlicePairs(`   * v.startsWith('aaaa:') … v.slice(3)`), '🔴 把說明當程式碼').toEqual([])
    expect(prefixSlicePairs(`if (v.startsWith(P)) f(v.slice(3))`), '🔴 變數前綴不該被配到').toEqual([])
  })

  it('🔴 硬性零：一組算錯的長度都不准有', () => {
    const wrong = pairs.filter(isWrong)
    if (wrong.length) {
      console.log('\n🔴 前綴長度算錯：')
      for (const w of wrong) {
        console.log(`   ${w.file}:${w.line}  startsWith('${w.literal}')（${w.literal.length} 字）… slice(${w.n})`)
      }
    }
    expect(
      wrong.map((w) => `${w.file}:${w.line}`),
      '🔴 有前綴的長度是手寫的而且算錯了——那個功能會靜靜地不執行。' +
        '修法：把數字換成 `前綴.length`（宣告成常數再用）。',
    ).toEqual([])
  })
})
