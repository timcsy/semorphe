/**
 * 護欄：**護欄自己有幾條，要有一個地方說了算。**
 *
 * ## 🔴 為什麼需要它
 *
 * 2026-08-19 的 knowie judge 掃出這一族散落的數字：
 *
 * ```
 * experience.md:211    「35 條（今天 37 條）」
 * experience.md:2791   「43～44 條」
 * experience.md:3058   「45 條」
 * draft/…擴充的形狀    「47 條」
 * history/087         「第 47 條」
 * ```
 *
 * ⚠️ 而實測 `audit-*.test.ts` 只有 46 個檔，**且護欄根本不全叫 `audit-*`**
 * ——`bus-update-not-user-edit.test.ts` 自己就是一條，它不叫那個名字。
 *
 * 於是「第 47 條」這個說法**沒有人能驗證**，而每一份文件各自漂。
 *
 * > **執行機構自己的判準用在它自己身上：
 * > 一個沒有機械檢查的數字，會在每一份文件裡各自漂。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果掃到的檔案數是 0，代表這支測試的路徑寫錯了，不是護欄消失了。**
 * 判斷依據是下面「★ 健康檢查」那一支——它錨在**掃到幾個測試檔**（合成量），
 * 🔴 **不是錨在護欄數**：護欄數是這條護欄要追蹤的東西，
 * 拿它當入口條件的話，成功的那天就會紅。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判斷一條護欄好不好**——只數「有幾個檔在用護欄的基礎設施」
 * - **不強制命名**：`audit-*` 只是慣例。硬性要求改名會讓一批既有檔案
 *   為了通過這條而搬家，而搬家本身沒有增加任何保障
 * - 不數 `it()` 的支數（那個數字每次加測試都會動，記了也沒人維護）
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'tests/integration')

/** 一個測試檔算不算護欄——**看它用不用護欄的基礎設施**，不看檔名。 */
const MARKERS = ['loadBaseline', 'assertRatchet', 'writeBaseline']

function guardrailFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.test.ts'))
    .filter((f) => {
      const src = readFileSync(join(DIR, f), 'utf8')
      return MARKERS.some((m) => src.includes(m))
    })
    .sort()
}

function allTestFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.test.ts'))
}

describe('護欄：護欄的條數要有一個地方說了算', () => {
  // ── ★ 健康檢查：錨在掃到幾個測試檔，不在護欄數 ────────────────
  it('★ 健康檢查：掃到的測試檔數不得為零', () => {
    expect(allTestFiles().length, '一個測試檔都沒掃到 → 路徑寫錯了，下面的數字是假的')
      .toBeGreaterThan(50)
  })

  it('★ 注入：一個不含任何護欄標記的檔案，不得被算成護欄', () => {
    // 合成輸入——⚠️ 不用任何真實檔名，見自我否證聲明
    const fake = 'import { describe, it } from "vitest"\ndescribe("x", () => { it("y", () => {}) })'
    expect(MARKERS.some((m) => fake.includes(m)), '判定會把普通測試算成護欄').toBe(false)
  })

  it('報出目前的條數與清單', () => {
    const files = guardrailFiles()
    // 🔴 **這是這條護欄的產出**：一個可以被引用的數字，而它從程式碼算出來。
    console.log(`\n護欄：${files.length} 條（依「用不用護欄基礎設施」判定，不看檔名）`)
    const odd = files.filter((f) => !f.startsWith('audit-'))
    if (odd.length > 0) {
      console.log(`  ⚠️ 其中 ${odd.length} 條不叫 audit-*：${odd.join('、')}`)
      console.log('     （命名是慣例不是規範——見檔頭「本護欄不檢測什麼」）')
    }
    expect(files.length).toBeGreaterThan(0)
  })

  it('🔴 知識庫裡不得把護欄條數宣稱成【現況】', () => {
    // ⚠️ 只掃**三個入口檔**：history/ 是病歷，它記的是「當時是幾條」，
    //    那是**正確的**——改掉它等於竄改紀錄。
    //
    // 🔴 **而第一版的判準太鈍，第一次跑就抓到自己的錯**：它禁止「任何」條數，
    //    於是把三筆**過去的觀察**（「當時 43～44 條全綠」）一起報出來。
    //    那些不是腐爛，是紀錄。
    //
    // > **一個數字是不是債，看它宣稱的是【現在】還是【當時】。**
    //
    // 所以判的是「條數 ＋ 現在式標記」：今天／目前／現行／現在。
    // ⚠️ 只有這種會過期——而它過期時沒有任何機構會出聲。
    const NOW = /今天|目前|現行|現在/
    const roots = ['knowledge/principles.md', 'knowledge/vision.md', 'knowledge/experience.md']
    const hits: string[] = []
    for (const p of roots) {
      const lines = readFileSync(join(process.cwd(), p), 'utf8').split('\n')
      lines.forEach((l, i) => {
        if (/\d+\s*[～~]?\s*\d*\s*條護欄/.test(l) && NOW.test(l)) {
          hits.push(`${p}:${i + 1}  ${l.trim().slice(0, 72)}`)
        }
      })
    }
    expect(hits, `\n把護欄條數宣稱成現況（改成「見 tests/integration/」或引用本護欄的報表）：\n${hits.join('\n')}\n`)
      .toEqual([])
  })
})
