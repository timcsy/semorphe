/**
 * **第七十四條護欄**：不是積木面板的面板，不得 import 積木引擎。
 *
 * ## 它從哪來
 *
 * 2026-08-26 查「面板只 import 協定」那一項（`vision.md:481`）時量到的：
 *
 * ```
 * flow-panel.ts:44     import * as Blockly from 'blockly/core'
 * flow-panel.ts:47     const msg = (key, fallback) => (Blockly.Msg[key] as string) || fallback
 *                      ↑ 整個引擎，只為了這一行
 * console-panel.ts:1   import * as Blockly from 'blockly'      ← 同一個病，而它拉的是全包
 * ```
 *
 * ⚠️ 這**不是新的病**——`src/core/messages.ts:20` 逐字記著它上一次發作：
 *
 * > 「**載入一個語言 ＝ 載入整個 Blockly（連帶 jsdom）**，
 * >  而那個語言套件與積木沒有任何關係。」
 *
 * 把「語言套件」換成「面板」，那句話一字不改地成立。而它上一次的修法
 * （`core/messages.ts` 的 `msg(key, fallback)` 埠）**已經在了**，
 * 簽名與 `flow-panel` 的區域版逐字相同——面板只是還沒搬上去。
 *
 * ## 🔴 為什麼要新蓋一條，而不是擴充既有的
 *
 * 這條規範今天落在**兩條護欄之間**，兩邊都刻意不管它：
 *
 * ```
 * 第三十九條 · 語言獨立性   刻意不把 Blockly 算成語言專屬 import
 *                          （`audit-four-independences.test.ts:357` 的自我驗證
 *                            逐字斷言 isLanguageSpecificImport("…from 'blockly'") === false）
 *                          ——那個判斷是【對的】：Blockly 不是一個語言
 * 第三十九條 · 視圖獨立性   只看「面板互相 import」，不看面板 import 引擎
 * ```
 *
 * > **一條規範落在兩條護欄之間，與沒有護欄是同一件事。**
 *
 * 它服務的是 `principles.md:174`「**視圖獨立性**：拔掉任一視圖 → 其他不受影響，
 * 視圖間零 import」，推導自 P1 ＋ P3（`principles.md:169`）。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「掃到的面板檔數」低於下限、或讀進的總字數低於下限，
 * > 代表掃描器沒讀到檔案（目錄改名、副檔名變了），這份報表不算數
 * > ——不是「面板都乾淨了」。**
 *
 * 錨在**掃到幾個檔 ／ 讀進幾個字**（輸入量）：清掉一個違規**不會**讓它們變小，
 * 把 `Blockly.Msg` 換成 `msg()` 之後那個檔還在、字數還在。
 * 🔴 **刻意不錨在「違規檔數」**——那正是這條護欄要推向零的
 * （`build-guardrail` 第 2 步，那個形狀已經犯過九次）。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「面板只 import 協定」留一個口，那句話就是假的
 * 修一筆要付多少？       便宜——`Blockly.Msg[k] || fb` → `msg(k, fb)`，一行對調
 * 別台機器一樣嗎？       ✅ 純靜態，讀的是 repo 裡的檔案
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 `import type`**——型別在編譯時被抹掉，不會把引擎拉進 bundle。
 *   （`app.ts:3` 用 `import type` 拿 BlocklyPanel 的型別，那是正當的。）
 *   ⚠️ 這一句刻意**不把那段碼寫進反引號**——`tests/integration/` 裡帶 `;` 或大括號的
 *   反引號片段會被**別的七支護欄**當成 C++ 語料撈走，而那份掃描器的配對本身有缺陷
 *   （2026-08-26 實測：1079 段裡 344 段根本是測試碼）。詳見 `draft/`。
 * - **不檢測間接 import**（A → B → `blockly`）——只看面板檔自己的 import 行。
 *   ⚠️ 所以一個「把 `import * as Blockly` 搬進隔壁 helper」的改法**騙得過它**，
 *   而那不是修好，是搬家。要擋那個得做依賴圖，是另一條護欄。
 * - **不檢測面板 import 的其他重物**（Monaco、tree-sitter）——各有各的判準。
 *   `monaco-panel` import Monaco 與 `blockly-panel` import Blockly 同樣正當。
 * - **不檢測「引擎被用來做什麼」**——`Blockly.Msg` 與 `Blockly.inject` 在這支眼裡
 *   一樣重。判「這個面板該不該碰引擎」的是下面的具名豁免，不是用量。
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

/** 被掃的目錄——面板與版面兩處，都是「使用者看得到的殼」。 */
const PANEL_DIRS = ['src/ui/panels', 'src/ui/layout']

/**
 * **積木引擎的套件名**。`blockly` 與它的任何子路徑（`blockly/core`、`blockly/msg/…`）。
 * ⚠️ 用前綴比對而不是 `includes('blockly')`——後者會把 `./blockly-helpers`
 * 這種**相對路徑的自家檔案**也算進來（注入②釘住這一點）。
 */
const ENGINE = /^blockly(\/|$)/

/**
 * **具名豁免**——每一筆要寫得出理由，寫不出來的就不是豁免，是違規。
 *
 * ⚠️ 這不是錨點：它不斷言任何缺陷存在，所以不受 `build-guardrail` 簽名三的限制。
 * 而它會過期，於是下面有一支孤兒檢查（第 11 步：判定過期不會被棘輪抓到）。
 */
const EXEMPT: Record<string, string> = {
  'src/ui/panels/blockly-panel.ts':
    '它【就是】積木投影本身——inject／serialization／WorkspaceSvg／Events 等 12 種 API。' +
    '把引擎從它身上拿掉等於刪掉這個面板。',
  'src/ui/panels/ghost-drag-strategy.ts':
    '它實作的是【Blockly 自己的介面】`IDragStrategy`——回傳值的型別由引擎定義，' +
    '不是「為了查一個字」而拉進來的。與 `blockly-panel` 同一個理由：' +
    '把引擎拿掉，這個檔就沒有東西可以實作了。' +
    '⚠️ 而它【不是面板】，只是住在面板旁邊（唯一的消費者是 `blockly-panel`）。',
}

/** 一行 import 拉進了引擎嗎。回傳被 import 的路徑，沒有就回 null。 */
export function engineImportOf(line: string): string | null {
  // `import type …` 在編譯時被抹掉 → 不算（見檔頭「不檢測什麼」）
  if (/^\s*import\s+type\s/.test(line)) return null
  const m = /^\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/.exec(line)
  if (!m) return null
  return ENGINE.test(m[1]) ? m[1] : null
}

interface Scan {
  files: string[]
  chars: number
  violations: Array<{ file: string; spec: string; line: number }>
}

function scan(): Scan {
  const files: string[] = []
  let chars = 0
  const violations: Scan['violations'] = []
  for (const dir of PANEL_DIRS) {
    const abs = path.join(REPO_ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const f of fs.readdirSync(abs).filter((n) => n.endsWith('.ts'))) {
      const rel = `${dir}/${f}`
      const src = fs.readFileSync(path.join(abs, f), 'utf8')
      files.push(rel)
      chars += src.length
      if (rel in EXEMPT) continue
      src.split('\n').forEach((line, i) => {
        const spec = engineImportOf(line)
        if (spec) violations.push({ file: rel, spec, line: i + 1 })
      })
    }
  }
  return { files, chars, violations }
}

describe('第七十四條護欄：面板不得 import 積木引擎', () => {
  const r = scan()

  it('★ 入口條件：掃描真的吃到東西', () => {
    // ⚠️ 錨在輸入量上。把 `Blockly.Msg` 換成 `msg()` 之後，
    // 檔案還在、字數還在——這兩個數字**不會因為違規被修好而變小**。
    expect(r.files.length, `一個面板檔都沒掃到 → ${PANEL_DIRS.join('／')} 路徑錯了，下面的 0 是假的`)
      .toBeGreaterThanOrEqual(6)
    expect(r.chars, '面板檔讀進來是空的 → 讀檔壞了').toBeGreaterThan(10_000)
  })

  it('★ 注入①：拉進引擎的 import 必須被報出', () => {
    expect(engineImportOf("import * as Blockly from 'blockly'")).toBe('blockly')
    expect(engineImportOf("import * as Blockly from 'blockly/core'")).toBe('blockly/core')
    expect(engineImportOf("import { Msg } from 'blockly/core'")).toBe('blockly/core')
  })

  it('★ 注入②：不是引擎的、以及被抹掉的，都不得被報', () => {
    // 這一條不可省。沒有它，一個「看到 blockly 就報」的實作也能通過注入①。
    expect(engineImportOf("import type * as Blockly from 'blockly'"), '型別 import 編譯時被抹掉').toBe(null)
    expect(engineImportOf("import { help } from './blockly-helpers'"), '自家的相對路徑檔').toBe(null)
    expect(engineImportOf("import x from 'not-blockly'"), '名字裡有 blockly 的別的套件').toBe(null)
    expect(engineImportOf("// import * as Blockly from 'blockly'"), '註解不是 import').toBe(null)
    expect(engineImportOf("const s = \"import * as Blockly from 'blockly'\""), '字串不是 import').toBe(null)
  })

  it('★ 具名豁免不得變成孤兒——檔案沒了就要有人來拔掉它', () => {
    // 第 11 步：判定與基線不同，**基線過期會被棘輪抓到，判定過期不會**。
    const orphans = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(REPO_ROOT, f)))
    expect(orphans, `這些豁免指著不存在的檔案，理由已經不成立：\n  ${orphans.join('\n  ')}`).toEqual([])
  })

  it('硬性零：面板不得 import 積木引擎', () => {
    printReport('第七十四條：面板 × 積木引擎', [
      `掃到面板檔        ${r.files.length}（${r.chars} 字）`,
      `具名豁免          ${Object.keys(EXEMPT).length}`,
      `違規              ${r.violations.length}（硬性零）`,
      ...r.violations.map((v) => `  🔴 ${v.file}:${v.line}  ← ${v.spec}`),
    ])
    expect(
      r.violations.map((v) => `${v.file}:${v.line} ← ${v.spec}`),
      '這些面板為了幾件小事把整個積木引擎拉進來。\n' +
        '埠已經在了：`core/messages.ts` 的 `msg(key, fallback)`（查字）。\n' +
        '⚠️ 而【搬進隔壁 helper 不算修好】——這支只看直接 import，騙得過它。',
    ).toEqual([])
  })
})
