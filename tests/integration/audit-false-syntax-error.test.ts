/**
 * **第四十三條護欄：合法的程式不得被標成「你的語法錯了」。**
 *
 * ## 它從哪來
 *
 * 2026-08-14，spec `119` 把 `syntax_error` 從殘差通道（Info 級、灰色、
 * 主詞是「我還不認得」）搬到診斷通道（**Error 級、紅色、主詞是「你寫錯了」**）。
 *
 * 而 `src/core/lift/lifter.ts` 判定它的唯一訊號是**tree-sitter 產生了 ERROR 節點**：
 *
 * ```
 * if (node.type === 'ERROR' || this.hasErrorDescendant(node)) return 'syntax_error'
 * ```
 *
 * 那有兩種來源，而程式碼**分不出來**：
 *
 * ```
 * ① 真的寫錯了          使用者的問題        ✅ 該紅
 * ② 合法而文法不涵蓋    🔴 我們解析器的問題  ← 加嚴之後也紅著說「你的語法不完整」
 * ```
 *
 * ⚠️ **這是 `knowledge/history/062` 那筆錯格【反過來】**：
 * 那次是我們的問題被顯示成殘差，這次是**我們的問題被顯示成使用者的錯誤**。
 *
 * ## 為什麼要有這條護欄——`history/017` 早就寫過
 *
 * > 「**加嚴一個檢查，可能讓事情比不檢查更糟。**
 * > 一道檢查一旦會『拒絕』，就必須同時回答『被拒絕的東西去哪了』。」
 *
 * **`119` 沒有問過那個問題。** 這條護欄就是那個安全網。
 *
 * ## 自我否證聲明（第 2 步，寫在量測之前）
 *
 * > **如果「掃到的語料段數」低於 40，代表語料沒載入（或抽取壞了），
 * > 這條護欄不算數——不是「沒有誤標」。**
 *
 * ⚠️ 錨在**語料段數**（合成量）上。**不可**錨在誤標數——那正是這條要推向零的東西
 * （第 2 步的簽名一）。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「該標的有沒有標到」**——那是涵蓋率（`history/063` 記著三種形狀
 *   只有一種會被標）。本護欄只管**不該標的有沒有被標**
 * - **不檢測訊息寫得好不好**——那是 `audit-diagnostic-labels`（第四十二條）
 * - **不檢測 `unsupported`／`nonstandard_but_valid`**——它們走殘差通道，
 *   本來就不長得像錯誤
 * - ⚠️ **不保證語料涵蓋所有合法 C++**——55 段來自三個使用情境，
 *   而 `history/057` 逐字：「一份缺陷清單只包含**被記下來的缺陷**」。
 *   **語料擴大時這個數字可能變成非零，而那正是這條護欄存在的理由。**
 *
 * ## 棘輪（基線 0），不是硬性零——第 6.8 步的三個問題
 *
 * | 問題 | 答案 |
 * |---|---|
 * | 留一筆在那裡，規範還成立嗎 | ❌ **不成立**——一筆就是一次「把我們的問題說成學生的錯」 |
 * | 修一筆要付多少 | 🔴 **不便宜**：要分辨「文法不涵蓋」與「真的寫錯」，而那需要參照編譯器仲裁（委派，還沒做） |
 * | 這個量在別台機器上一樣嗎 | ✅ 純解析，tree-sitter 的 wasm 隨 repo 走，沒有外部工具（`history/059` 的第三個問題） |
 *
 * **規範成立 ＋ 修法不便宜 → 棘輪**（第 6.8 步）。基線是 0，
 * 而它上升時**必須指名是哪幾段**，不能只說數字變大了。
 *
 * ## ⚠️ 第一次跑是綠的（第 6.5 步的例外）
 *
 * 實測 55 段誤標 0——所以它靠**注入**證明自己會紅，不靠第一次的紅。
 * 與第三十五、四十一條相同。
 *
 * ## ⚠️ 而語料刻意不寫在這個檔案裡
 *
 * `audit-behavior-error` 會掃 `tests/integration/*.test.ts` 的**反引號字面**
 * 當 C++ 語料。把語料寫進這裡，會讓**另一條護欄的分母無聲地變大**。
 * → 語料住在 `tests/probes/scenario-corpus.ts`（不是 `.test.ts`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { COMPETITIVE, APCS_CORPUS, ARDUINO } from '../probes/scenario-corpus'
import { loadBaseline, writeBaseline, REPO_ROOT } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${REPO_ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${REPO_ROOT}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

interface hit {
  sample: string
  nodes: string[]
}

/** 樹上被標成語法錯誤的節點。**吃樹而不是吃原始碼**，注入才餵得進來。 */
function markedNodes(n: SemanticNode, out: string[] = []): string[] {
  if (n.metadata?.degradationCause === 'syntax_error') out.push(n.componentId)
  for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) markedNodes(c, out)
  return out
}

/** 語料全集。三個情境合成一份，鍵前綴標明來源。 */
function corpus(): Record<string, string> {
  const all: Record<string, string> = {}
  const src: [string, Record<string, string>][] = [
    ['競賽', COMPETITIVE],
    ['APCS', APCS_CORPUS],
    ['Arduino', ARDUINO],
  ]
  for (const [label, c] of src) for (const [k, v] of Object.entries(c)) all[label + '/' + k] = v
  return all
}

function measure(samples: Record<string, string>): hit[] {
  const out: hit[] = []
  for (const [name, code] of Object.entries(samples)) {
    const tree = createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode | null
    if (!tree) continue
    const nodes = markedNodes(tree)
    if (nodes.length) out.push({ sample: name, nodes })
  }
  return out
}

describe('第四十三條護欄：合法程式不得被誤標成語法錯誤', () => {
  it('★ 入口條件：語料真的載進來了（錨在段數，不錨在誤標數）', () => {
    expect(
      Object.keys(corpus()).length,
      '掃到的語料段數低於 40 → 語料沒載入或抽取壞了，這條護欄不算數（見檔頭的自我否證）',
    ).toBeGreaterThan(40)
  })

  it('★ 注入：一段真的壞掉的程式 → **必須被抓到，而且指得出是哪一段**', () => {
    // ⚠️ 合成輸入。少一個分號，而下一行是輸出——`history/063` 實測這是
    // 今天唯一會被標記的形狀（另兩種不會，那是涵蓋率的問題不是本護欄的）。
    const broken = { 'zz_synthetic/少分號': 'int main(){ int x = 1\n  x = x + 1;\n  return 0; }' }
    const hits = measure(broken)
    expect(hits.map((h) => h.sample), '真的壞掉的程式沒被抓到 → 判定邏輯沒在跑').toEqual([
      'zz_synthetic/少分號',
    ])
    // 釘住理由，不只釘結果（第 8 步）：要說得出是**哪個節點**被標的。
    expect(hits[0].nodes.length, '抓到了卻說不出是哪個節點').toBeGreaterThan(0)
  })

  it('★ 注入（反向）：一段乾淨的程式 → **不得亂報**', () => {
    const clean = { 'zz_synthetic/乾淨': 'int main(){ int x = 1;\n  x = x + 1;\n  return 0; }' }
    expect(measure(clean), '沒有語法錯誤卻報了').toEqual([])
  })

  it('★ 棘輪：合法語料被誤標的段數只准下降（基線 0）', () => {
    const hits = measure(corpus())
    const report = hits.map((h) => h.sample + '  ←  ' + h.nodes.join(', '))
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('false-syntax-error', {
        _meta: {
          note:
            '合法語料（三情境 55 段）被標成 syntax_error 的段數。基線 0。\n' +
            '⚠️ 上升時必須指名是哪幾段——那代表 tree-sitter 的文法不涵蓋某種【合法】寫法，' +
            '而我們把它顯示成「你的語法錯了」。\n' +
            '🔴 修法不便宜（要分辨「文法不涵蓋」與「真的寫錯」需要參照編譯器仲裁），' +
            '所以是棘輪不是硬性零——但基線 0 的意義是「今天一筆都沒有」。\n' +
            '語料變動也會改這個數字：擴語料而數字上升，那是【世界變了】不是【模型退步】，' +
            '兩種下降／上升要分清（build-guardrail 的「數字下降時先問是哪一種」）。',
        },
        falsePositives: hits.length,
        samples: report,
      })
      return
    }
    const base = loadBaseline<{ falsePositives: number }>('false-syntax-error')
    expect(
      report,
      '🔴 合法的程式被標成「你的語法錯了」——而它今天是紅色的錯誤級訊息。\n' +
        '這是 history/062 那筆錯格【反過來】：我們解析器的極限被顯示成學生的錯誤。\n' +
        '⚠️ 處置**不是**把它改回灰色（那會退回 119 之前），\n' +
        '而是分辨「文法不涵蓋」與「真的寫錯」——見 history/063 的第三個缺口。',
    ).toEqual([])
    expect(hits.length, '誤標數上升了').toBeLessThanOrEqual(base.falsePositives)
  })
})
