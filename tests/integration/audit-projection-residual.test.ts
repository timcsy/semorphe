/**
 * **第三十一條護欄：形態的殘差**——有多少原始碼掉進殘差通道。
 *
 * ## 它量什麼
 *
 * `raw_code` 是**殘差通道**：辨識不出來的節點帶著原文（`metadata.rawCode`）
 * 進入語義樹，而 `code-generator.ts:78` 真的讀它、把原文吐回去。所以
 * **沒有那顆元件，文字仍然還原得回來、參照編譯器仍然編得過。**
 *
 * `knowledge/concepts/等價與觀察集.md` §七：
 * 「**P1 不要求模型理解一切，只要求殘差補得齊。**」
 *
 * 這條護欄量的是「**補了多少**」——也就是模型**還沒長到**哪裡。
 *
 * ## ⚠️ 殘差不是誤差，這條護欄不量誤差
 *
 * ```
 * 殘差高  →  模型還沒長到那裡（系統**仍然正確**）    ← 本檔
 * 誤差高  →  模型是錯的（系統**會騙人**）            ← audit-behavior-error.test.ts
 * ```
 *
 * **兩者不可混成一個數字。** 混起來的話，多蓋幾顆元件會讓一個「會騙人」的
 * 數字看起來在改善。這是本護欄與那一條**刻意不共用結構**的理由。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測產出的碼對不對**——`raw_code` 原文照抄，它一定對。
 * - **不檢測執行結果**——那是誤差那條的事。
 * - **不檢測 `degradationCause` 填得對不對**——只統計分佈。
 *   （順帶記一筆：`(無)` 這個桶不是零，代表殘差通道有資料但**沒有歸因**。）
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「載入的語料段數」是 0 或語法完整那一欄是 0，代表工具壞了，
 * > 不是世界長這樣。**
 *
 * 錨在**語料載入量**上，不錨在殘差計數上——殘差計數正是這條護欄要推向零的
 * 東西，錨在它上面的健康檢查**會在成功的那天變紅**
 * （`build-guardrail` 第 2 步，已經犯過七次的形狀）。
 *
 * ## ⚠️⚠️ 這條護欄最難的一步是語料分欄，不是量測
 *
 * 第一版量成 **48.83%**，正確值 **0.23%**——差 200 倍。
 * **錯的不是程式，是語料**：820 段裡有 353 段是測試檔裡的**片段**
 * （語法本來就不完整），被當成了模型缺口。
 *
 * 所以兩欄都要記。只記完整那一欄的話，**濾掉語料會看起來像改善**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const 護欄名 = 'projection-residual'

interface 基線 {
  _meta: { note: string; ratchet: string }
  語料: { 語法完整: number; 語法有錯片段: number; 總字元: number }
  殘差: { 字元數: number; 節點數: number; 率百分比: number; 降級原因: Record<string, number>; 明細: 殘差明細[] }
}

let parser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

/** 從既有測試資產撈 C++ 片段。與誤差那條共用同一批來源，但**分欄規則不同**。 */
function 撈語料(): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/`([^`]{4,400})`/g)) {
      const c = m[1]
      if (!/[;{]/.test(c)) continue // 不像程式碼
      if (c.includes('${')) continue // 樣板字串，不是完整的碼
      out.push(c)
    }
  }
  return out
}

const 是殘差 = (id: string) => id === 'raw_code' || id === 'unresolved'

interface 殘差明細 {
  原文: string
  降級原因: string
}

interface 統計 {
  語法完整: number
  語法有錯片段: number
  總字元: number
  殘差字元: number
  殘差節點: number
  降級原因: Map<string, number>
  /** 逐項指名——只有數字的話，沒有人知道模型缺在哪裡（`build-guardrail` 6.5）。 */
  明細: 殘差明細[]
}

function 量(語料: readonly string[]): 統計 {
  const s: 統計 = { 語法完整: 0, 語法有錯片段: 0, 總字元: 0, 殘差字元: 0, 殘差節點: 0, 降級原因: new Map(), 明細: [] }
  const 走 = (n: SemanticNode) => {
    if (是殘差(n.conceptId)) {
      s.殘差節點++
      const 原文 = String(n.metadata?.rawCode ?? '')
      s.殘差字元 += 原文.length
      const 因 = String(n.metadata?.degradationCause ?? '(無)')
      s.降級原因.set(因, (s.降級原因.get(因) ?? 0) + 1)
      s.明細.push({ 原文: 原文.slice(0, 120).replace(/\n/g, '⏎'), 降級原因: 因 })
    }
    for (const ks of Object.values(n.children ?? {})) for (const k of ks) 走(k)
  }
  for (const c of 語料) {
    let tree
    try {
      tree = parser.parse(c)
    } catch {
      continue
    }
    if (!tree) continue
    // ⚠️ 分欄靠解析器自己的判定，不靠我們的啟發式。
    // 語法有錯 = 測試檔裡的片段，**不是模型缺口**。
    if ((tree.rootNode as unknown as { hasError: boolean }).hasError) {
      s.語法有錯片段++
      continue
    }
    let lifted: SemanticNode | null = null
    try {
      lifted = lifter.lift(tree.rootNode as never) as SemanticNode
    } catch {
      continue
    }
    if (!lifted) continue
    s.語法完整++
    s.總字元 += c.length
    走(lifted)
  }
  return s
}

describe('第三十一條護欄：形態的殘差', () => {
  // ── 健康檢查：錨在語料載入量（合成量），不錨在殘差計數 ───────────────
  it('★ 健康檢查：語料真的載入了', () => {
    const 語料 = 撈語料()
    expect(語料.length, '一段語料都沒撈到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    const s = 量(語料)
    expect(s.語法完整, '語法完整的語料為 0 → 解析器或分欄壞了').toBeGreaterThan(100)
    expect(s.總字元, '總字元為 0 → 量測沒有吃到內容').toBeGreaterThan(1000)
  })

  // ── 雙向注入：會報 ＋ 不亂報 ──────────────────────────────────────
  //
  // 第二個不可省。基線接近零的時候，一條「什麼都沒量到」的護欄與一條
  // 健康的護欄產出完全相同。
  it('★ 注入①：含殘差的輸入必須被計入', () => {
    // `asm` 區塊：語法完整，而模型不理解它。
    const s = 量(['int main(){ __asm__("nop"); return 0; }'])
    expect(s.語法完整, '這一段必須被判為語法完整').toBe(1)
    expect(s.殘差節點, '模型不理解的東西必須進殘差通道').toBeGreaterThan(0)
    expect(s.殘差字元, '殘差要帶著原文，否則還原不回來').toBeGreaterThan(0)
  })

  it('★ 注入②：完全認得的輸入不得被誤報', () => {
    const s = 量(['int main(){ int a = 1; return 0; }'])
    expect(s.語法完整).toBe(1)
    expect(s.殘差節點, '認得的東西被算成殘差 → 這條護欄會謊報模型缺口').toBe(0)
  })

  it('★ 注入③：語法有錯的片段不得計入殘差', () => {
    // 這是第一版量錯 200 倍的那個形狀——片段被當成模型缺口。
    const s = 量(['int a = ', 'if (x) {'])
    expect(s.語法有錯片段, '片段必須進另一欄').toBeGreaterThan(0)
    expect(s.總字元, '片段不得計入分母').toBe(0)
  })

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('殘差率只准下降', () => {
    const s = 量(撈語料())
    const 率 = Number(((s.殘差字元 / s.總字元) * 100).toFixed(2))

    printReport('形態的殘差', [
      `語料   語法完整 ${s.語法完整} 段 ／ 語法有錯（片段）${s.語法有錯片段} 段`,
      `       ⚠️ 兩欄都要看——只看完整那欄的話，濾掉語料會像改善`,
      `殘差   ${s.殘差字元} 字元 / ${s.總字元} = ${率}%（${s.殘差節點} 個節點）`,
      `降級原因   ${JSON.stringify(Object.fromEntries(s.降級原因))}`,
      '',
      '模型還沒長到的地方（逐項）：',
      ...s.明細.map((d, i) => `  ${i + 1}. [${d.降級原因}] ${d.原文}`),
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(護欄名, {
        _meta: {
          note:
            '形態的殘差：有多少原始碼掉進 raw_code 殘差通道，也就是模型**還沒長到**哪裡。\n' +
            '⚠️ 這不是誤差。殘差高＝模型沒長到那裡（系統仍然正確）；誤差高＝模型是錯的（系統會騙人）。\n' +
            '誤差在 behavior-error.json，**兩者不可合併**——混起來的話，多蓋幾顆元件會讓「會騙人」的數字看起來在改善。\n' +
            '⚠️ 語料分兩欄。第一版量成 48.83%（正確值 0.23%，差 200 倍），錯的不是程式是語料——\n' +
            '820 段裡 353 段是測試檔裡的片段（語法本來就不完整），被當成模型缺口。只記完整那一欄的話，濾掉語料會像改善。\n' +
            '下降的兩種原因要分清：因為**實作**了新元件（模型長大了）／因為**語料**變了（世界變了，模型沒變）。',
          ratchet: RATCHET_NOTE,
        },
        語料: { 語法完整: s.語法完整, 語法有錯片段: s.語法有錯片段, 總字元: s.總字元 },
        殘差: {
          字元數: s.殘差字元,
          節點數: s.殘差節點,
          率百分比: 率,
          明細: s.明細,
          降級原因: Object.fromEntries(s.降級原因),
        },
      })
      return
    }

    const base = loadBaseline<基線>(護欄名)
    assertRatchet([['殘差率(%)', 率, base.殘差.率百分比]])
  })
})
