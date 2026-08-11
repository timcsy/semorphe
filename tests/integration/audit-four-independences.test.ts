/**
 * **第三十九條護欄：P9 四項獨立性**
 *
 * ## 它為什麼存在
 *
 * `principles.md:117` 立了「**四項獨立性（品質閘門）**」，`:121` 逐字：
 *
 * > 「每個 Phase 完成後**必須通過**」
 *
 * 而在這條護欄之前，**31 條護欄裡零檢查**。一個從來沒有被執行過的品質閘門
 * 比沒有閘門更糟——**每個 Phase 都以為自己通過了**。
 *
 * 這是 `concepts/執行機構.md:522`「機制有了沒人接上」那一族最大的一個：
 * 前面那些是「一個機制沒人用」，這個是「**一個自稱是閘門的東西從來沒關過**」。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的 `src/ui` 檔數」、「掃到的 import 行數」或
 * > 「掃到的視圖方法呼叫數（含合法的生命週期）」是 0，
 * > 代表工具壞了，不是世界長這樣。**
 *
 * 三個錨全部是**掃描的輸入量**，不是這條護欄想推向零的東西
 * （`build-guardrail` 第 2 步的語法簽名——這個專案在這件事上犯過**七次**）。
 *
 * 簽名逐條自檢：
 * - 簽名一（健康檢查裡出現 `expect(<缺陷計數>).toBeGreaterThan(0)`）→ 無
 * - 簽名二（斷言一個合取：整顆／全部／每一個）→ 無
 * - 簽名三（注入裡出現真實路徑／身分）→ 注入全部用**合成路徑**
 *
 * ## 它量什麼——四條各自一個可數的量
 *
 * `principles.md:123-129` 的四條，逐條對到一個數字：
 *
 * | P9 的條文 | 這裡量什麼 | 判定 |
 * |---|---|---|
 * | 語言獨立性 | **視圖**（`ui/panels/`）import `languages/<lang>/`／`components/<lang>/` | 棘輪 |
 * | 視圖獨立性 | 面板互相 import | **硬性零** |
 * | 核心純淨性 | — | **不檢測**，見下 |
 * | 「跨層通訊只走 Bus」 | `ui/` 非面板檔直接呼叫視圖方法 | 棘輪 |
 *
 * ## ⚠️ 判準切過三刀，每一刀都有理由
 *
 * **① `languages/style` 不算違規。** P9 逐字是「無 `languages/cpp/` import」
 * ——`languages/style` 是**語言中立的介面**（`BlockStylePreset`／`CodingStyle`），
 * 拔掉 C++ 它還在。5 筆，不計。
 *
 * **② 組裝點（`app.ts`）另立一欄，不入棘輪。** P9 說的是「所有**視圖**仍啟動」。
 * `app.ts` 是 composition root，它的工作就是知道自己裝了什麼语言套件
 * ——就像 `main()` 知道所有依賴。**16 筆可見但不判違規。**
 *
 * ⚠️ 而它**必須可見**：如果哪天視圖那一欄歸零了而這一欄長到 50，
 * 那代表耦合搬進了組裝點，不是消失了。
 *
 * **③ 其餘 UI 檔（`toolbox-builder`／`block-registrar`／`sync-controller`）
 * 歸「無法確定」，而且計入棘輪。** 它們不是視圖也不是組裝點。
 * `build-guardrail` 第 5 步：**判不出來就說判不出來，且不計入安全。**
 *
 * ## ⚠️ 「跨層通訊」的判準修過一次——第一版量到 139，其中 26 筆是誤報
 *
 * 第一版用 `\w*[Pp]anel\.\w+\(`，抓到了：
 *
 * ```
 * leftPanel.appendChild(...)    ← 一個 div
 * bottomPanel.addTab(...)       ← 一個分頁容器
 * ```
 *
 * **名字裡有 Panel 不代表它是視圖。** 收緊成四個**已登錄成 `ViewHost`** 的
 * 具名接收者，並排除生命週期方法（`init`／`initialize`／`dispose`／`connectBus`）
 * ——`view-registry.ts` 的檔頭已經寫明生命週期由呼叫端直接管，那不是「通訊」。
 *
 * 139 → **125**。（`build-guardrail` 第 6 步：靜態判斷的第一版仍然會量錯。）
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測核心純淨性**——那是中立性護欄的地盤（`audit-neutrality`，
 *   掃 `src/core` ＋ `src/interpreter`）。這裡只補它掃不到的 `src/ui`。
 * - **不檢測「宿主獨立性」**（P9 第三條）——那要真的跑一次 VSCode。
 * - **不檢測執行期耦合**——只看靜態 import 與呼叫語法。
 *   一個透過字串查表拿到的語言專屬東西，這裡看不到。
 * - **不檢測「這個 import 該不該存在」**——只說「它跨了層」。
 *   要不要拆、怎麼拆，是設計題（見 `draft/2026-08-11-執行器直接持有五個面板.md`
 *   的三分類：廣播 ~20 該上匯流排、命令 ~55 要先想清楚、詢問 ~6 本來就是依賴）。
 *
 * ## 為什麼三個用棘輪、一個用硬性零（`build-guardrail` 6.8 的兩個問題）
 *
 * | | 「留一筆規範還成立嗎」 | 「修一筆要付多少」 | → |
 * |---|---|---|---|
 * | 視圖 import 語言 | 不成立 | ⚠️ `blockly-panel.ts:16` import `components/cpp/program/lift`，**拆不動** | 棘輪 |
 * | 視圖間 import | 不成立（開一個口整條失效） | 今天是 0，維持免費 | **硬性零** |
 * | 跨層直接呼叫 | 不成立 | 125 筆，其中 ~55 筆要先做架構決定 | 棘輪 |
 *
 * ⚠️ 視圖獨立性那條**第一次跑就是綠的**——而 6.5 說「第一次綠沒有一種是好消息」。
 * 這是那條規則的**已記錄例外**（同 `audit-anchor-rot`）：規範已經被守住了。
 * 這種情況靠的是**注入**，不是靠第一次的紅。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'

const 護欄名 = 'four-independences'

/** 已登錄成 `ViewHost` 的四個視圖。⚠️ `leftPanel`／`bottomPanel` 不在其中——它們是 DOM。 */
const 視圖們 = ['blocklyPanel', 'monacoPanel', 'consolePanel', 'variablePanel']

/** 生命週期不是通訊——`view-registry.ts` 的檔頭寫明它由呼叫端直接管。 */
const 生命週期 = ['init', 'initialize', 'dispose', 'connectBus']

interface 基線 {
  _meta: { note: string; ratchet: string }
  掃描: { 檔數: number; import行數: number; 視圖呼叫含生命週期: number }
  視圖import語言: number
  其餘UI檔import語言: number
  視圖間import: number
  跨層直接呼叫視圖: number
  可見不入棘輪: { 組裝點import語言: number }
  明細: {
    視圖import語言: string[]
    其餘UI檔import語言: string[]
    視圖間import: string[]
    跨層直接呼叫視圖: string[]
  }
}

// ── 判定函式：全部是純函式，注入才餵得進合成輸入 ─────────────────

/**
 * 這一行 import 的是不是**語言專屬**的東西。
 *
 * ⚠️ `languages/style` 是語言中立的介面，**不算**。
 */
export function 是語言專屬import(行: string): boolean {
  const m = 行.match(/from\s+'([^']+)'/)
  if (!m) return false
  const p = m[1]
  if (/\/languages\/style(\/|'|$)/.test(p) || p.endsWith('languages/style')) return false
  return /\/(languages|components)\/[a-z][a-z0-9_-]*\//.test(p)
}

/** 這一行是不是 import 了另一個面板（視圖獨立性）。 */
export function 是視圖間import(行: string): boolean {
  const m = 行.match(/from\s+'([^']+)'/)
  if (!m) return false
  return /(^|\/)[\w-]*panel[\w-]*$/i.test(m[1].replace(/\.[jt]s$/, ''))
}

/**
 * 這一行有幾次「直接呼叫一個視圖的方法」。
 *
 * ⚠️ 只認四個**已登錄**的視圖名，而且排除生命週期
 * ——第一版沒有這兩道，量出 139 筆，其中 26 筆是 `div.appendChild`。
 */
export function 數跨層呼叫(行: string): number {
  const re = new RegExp(`\\b(${視圖們.join('|')})[?!]?\\.([a-zA-Z_]\\w*)\\(`, 'g')
  let n = 0
  for (const m of 行.matchAll(re)) if (!生命週期.includes(m[2])) n++
  return n
}

function ui檔(): string[] {
  const out: string[] = []
  const 走 = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) 走(p)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
    }
  }
  走(path.join(REPO_ROOT, 'src/ui'))
  return out
}

function 量(): 基線 {
  const 檔s = ui檔()
  const 視圖import語言: string[] = []
  const 其餘UI檔import語言: string[] = []
  const 視圖間import: string[] = []
  const 跨層直接呼叫視圖: string[] = []
  let 組裝點import語言 = 0
  let import行數 = 0
  let 視圖呼叫含生命週期 = 0

  for (const f of 檔s) {
    const rel = path.relative(REPO_ROOT, f)
    const 是視圖 = rel.includes('/panels/')
    const 是組裝點 = rel.endsWith('ui/app.ts')
    const lines = fs.readFileSync(f, 'utf8').split('\n')

    lines.forEach((行, i) => {
      const 位置 = `${rel}:${i + 1}`
      if (/^\s*(import|}\s*from)/.test(行) || /from\s+'/.test(行)) {
        if (/from\s+'/.test(行)) import行數++
        if (是語言專屬import(行)) {
          if (是組裝點) 組裝點import語言++
          else if (是視圖) 視圖import語言.push(位置)
          else 其餘UI檔import語言.push(位置)
        }
        if (是視圖 && 是視圖間import(行)) 視圖間import.push(位置)
      }
      // 跨層通訊：面板自己的檔案不算（那是視圖內部）
      if (!是視圖) {
        視圖呼叫含生命週期 += (行.match(new RegExp(`\\b(${視圖們.join('|')})[?!]?\\.`, 'g')) ?? []).length
        const n = 數跨層呼叫(行)
        for (let k = 0; k < n; k++) 跨層直接呼叫視圖.push(位置)
      }
    })
  }

  return {
    _meta: {
      note:
        'P9「四項獨立性」（`principles.md:117`，自稱「每個 Phase 完成後必須通過」）。\n' +
        '⚠️ 四個數字意義不同：**視圖 import 語言**＝拔掉 C++ 視圖起不來；\n' +
        '**視圖間 import**＝硬性零，開一個口「視圖可抽換」就是假的；\n' +
        '**跨層直接呼叫**＝發號施令的一端知道接收端叫什麼名字。\n' +
        '⚠️ `組裝點import語言` 可見但不入棘輪——composition root 知道自己裝了什麼是正常的。\n' +
        '而它必須可見：視圖那欄歸零、這欄長大，代表耦合搬家不是消失。\n' +
        '⚠️ 下降必須是「真的拆掉了」，不是「把檔案排除在掃描外」或「改了判準」。',
      ratchet: RATCHET_NOTE,
    },
    掃描: { 檔數: 檔s.length, import行數, 視圖呼叫含生命週期 },
    視圖import語言: 視圖import語言.length,
    其餘UI檔import語言: 其餘UI檔import語言.length,
    視圖間import: 視圖間import.length,
    跨層直接呼叫視圖: 跨層直接呼叫視圖.length,
    可見不入棘輪: { 組裝點import語言 },
    明細: { 視圖import語言, 其餘UI檔import語言, 視圖間import, 跨層直接呼叫視圖 },
  }
}

describe('第三十九條護欄：P9 四項獨立性', () => {
  it('★ 入口條件：掃描真的吃到東西', () => {
    // 三個錨全部是掃描的**輸入量**。它們不會因為違規被修好而變動。
    const r = 量()
    expect(r.掃描.檔數, '一個 ui 檔都沒掃到 → 量測壞了').toBeGreaterThan(20)
    expect(r.掃描.import行數, '一行 import 都沒看到 → 掃描器沒吃到內容').toBeGreaterThan(100)
    expect(r.掃描.視圖呼叫含生命週期, '一次視圖方法呼叫都沒看到 → 正則沒對上').toBeGreaterThan(100)
  })

  it('★ 注入①：語言專屬 import 會被報', () => {
    expect(是語言專屬import("import { x } from '../../languages/foo/bar'")).toBe(true)
    expect(是語言專屬import("import { y } from '../components/foo/baz/lift'")).toBe(true)
    expect(是語言專屬import("} from '../languages/foo/quux'")).toBe(true)
  })

  it('★ 注入②：語言中立的 import 不得被報', () => {
    // 這一條不可省。沒有它，一個「什麼都報」的掃描器也能通過注入①。
    expect(是語言專屬import("import type { A } from '../languages/style'")).toBe(false)
    expect(是語言專屬import("import { B } from '../../core/semantic-bus'")).toBe(false)
    expect(是語言專屬import("import * as Blockly from 'blockly'")).toBe(false)
    expect(是語言專屬import('一行沒有 import 的字')).toBe(false)
  })

  it('★ 注入③：視圖間 import 會被報，非視圖的不會', () => {
    expect(是視圖間import("import { Foo } from './foo-panel'")).toBe(true)
    expect(是視圖間import("import { Bar } from '../panels/bar-panel.ts'")).toBe(true)
    expect(是視圖間import("import { Baz } from '../../core/view-host'")).toBe(false)
    expect(是視圖間import("import { Qux } from './panel-helpers/util'")).toBe(false)
  })

  it('★ 注入④：跨層呼叫只算已登錄的視圖，且排除生命週期', () => {
    expect(數跨層呼叫('this.monacoPanel?.setCode(x)')).toBe(1)
    expect(數跨層呼叫('a.blocklyPanel.foo(); b.consolePanel!.bar()')).toBe(2)
    // ⚠️ 這兩條是第一版量出 139 筆的原因——名字裡有 Panel 不代表它是視圖
    expect(數跨層呼叫('leftPanel.appendChild(el)')).toBe(0)
    expect(數跨層呼叫('bottomPanel.addTab(t)')).toBe(0)
    // 生命週期由呼叫端直接管，不是「通訊」
    expect(數跨層呼叫('this.monacoPanel.init(el)')).toBe(0)
    expect(數跨層呼叫('this.blocklyPanel?.dispose()')).toBe(0)
  })

  it('★ 硬性零：視圖之間不得互相 import', () => {
    const r = 量()
    // 開一個口，「拔掉任一視圖，其他不受影響」這句話就是假的。
    expect(r.明細.視圖間import, `視圖之間出現 import：\n  ${r.明細.視圖間import.join('\n  ')}`).toEqual([])
  })

  it('棘輪：三個耦合數字只准下降', () => {
    const r = 量()

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(護欄名, r satisfies 基線)
      return
    }

    // ⚠️ 報表印在讀基線**之前**——否則護欄第一次跑（基線還不存在）時
    // 拋出的是「基線檔不存在」，而**看不到它抓到了什麼**。
    // `build-guardrail` 6.5 要的是「先跑、確認紅、**逐項指名**」，
    // 而一個在指名之前就拋出的護欄，指不了名。
    const 基線值 = (k: keyof 基線): string => {
      try {
        return String(loadBaseline<基線>(護欄名)[k])
      } catch {
        return '尚無'
      }
    }
    printReport('P9 四項獨立性', [
      `掃描       ${r.掃描.檔數} 個 ui 檔／${r.掃描.import行數} 行 import`,
      `① 語言獨立性`,
      `   視圖 import 語言    ${r.視圖import語言}（基線 ${基線值('視圖import語言')}）`,
      ...r.明細.視圖import語言.map((x) => `     ✘ ${x}`),
      `   其餘 UI 檔          ${r.其餘UI檔import語言}（基線 ${基線值('其餘UI檔import語言')}）⚠️ 無法確定，保守計入`,
      ...r.明細.其餘UI檔import語言.map((x) => `     ? ${x}`),
      `   組裝點 app.ts       ${r.可見不入棘輪.組裝點import語言}（可見，不入棘輪）`,
      `② 視圖獨立性          ${r.視圖間import}（硬性零）`,
      `④ 跨層通訊只走 Bus`,
      `   直接呼叫視圖        ${r.跨層直接呼叫視圖}（基線 ${基線值('跨層直接呼叫視圖')}）`,
      ...[...new Set(r.明細.跨層直接呼叫視圖.map((x) => x.split(':')[0]))].map(
        (f) => `     ✘ ${f}：${r.明細.跨層直接呼叫視圖.filter((x) => x.startsWith(f + ':')).length} 處`,
      ),
    ])

    const base = loadBaseline<基線>(護欄名)

    for (const 欄 of ['視圖import語言', '其餘UI檔import語言', '跨層直接呼叫視圖'] as const) {
      const 新增 = r.明細[欄].filter((x) => !base.明細[欄].includes(x))
      expect(新增, `${欄} 新增了：\n  ${新增.join('\n  ')}`).toEqual([])
    }
    assertRatchet([
      ['視圖import語言', r.視圖import語言, base.視圖import語言],
      ['其餘UI檔import語言', r.其餘UI檔import語言, base.其餘UI檔import語言],
      ['跨層直接呼叫視圖', r.跨層直接呼叫視圖, base.跨層直接呼叫視圖],
    ])
  })
})
