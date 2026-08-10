/**
 * 遮罩的雙向注入（059 契約 1）
 *
 * ## 為什麼餵合成字串，不掃真實檔案
 *
 * 錨在真實檔案狀態上的測試，會在那些檔案被修好的那天失效——那時它會從
 * 「守住一個性質」變成「叫未來的讀者不要相信一個正確的結果」。
 *
 * **本專案這週已經為此翻車兩次**（辨識歧義護欄錨在 `declaration` 那一群、
 * 雙重真相護欄斷言「兩處都有定義 > 10」）。見 `knowledge/skills/build-guardrail`
 * 第 2 步。
 *
 * ## 兩個方向都要釘
 *
 * | 注入 | 證明什麼 |
 * |---|---|
 * | 真的身分引用 | 遮罩**沒有**把真違規濾掉 |
 * | 同名的非身分字串 | 遮罩**真的接上了** |
 *
 * **第二個不可省**：沒有它，遮罩根本沒生效也會通過第一支。
 * **第一個更不可省**：沒有它，一個「什麼都不報」的掃描器會通過第二支——
 * 而那正是本功能最大的風險（規格 Risks 第一列）。
 */
import { describe, it, expect } from 'vitest'
import { scanText } from '../../helpers/component-scan'

/** 用一個絕不會與真實概念撞名的探針 id，避免測試被真實資料影響 */
const PROBE = 'zz_probe_concept'

describe('遮罩：真的身分引用必須仍被報出（FR-003）', () => {
  it('★ registry 查表——最典型的身分引用', () => {
    const hits = scanText(`generators.set('${PROBE}', (node, ctx) => emit(node))`, [PROBE])
    expect(
      hits.code,
      '遮罩把真違規濾掉了。這是本功能最大的風險——一個「什麼都不報」的掃描器' +
        '會通過所有反向注入，而報表上的數字會一路下降到 0。',
    ).toEqual([PROBE])
  })

  it('★ switch 分支——第二種身分位置', () => {
    const hits = scanText(`switch (n.conceptId) { case '${PROBE}': return 1 }`, [PROBE])
    expect(hits.code).toEqual([PROBE])
  })

  it('★ `.type ===` 比較必須**仍然**被報出——遮罩 B 是被否決的', () => {
    // `block.type === 'cpp_string_declare'`（Blockly 積木型別）與
    // `node.type === 'comment'`（語法樹節點型別）在文字上完全相同。
    // 遮掉這個形式會連 14 筆真違規一起濾掉。見 research.md 決策 2。
    const hits = scanText(`if (block.type === '${PROBE}') return`, [PROBE])
    expect(
      hits.code,
      '有人實作了被否決的遮罩 B。它會遮掉 block.type === 的真違規——' +
        '實測 14 筆。理由見 specs/059-concept-id-vs-lookalike/research.md 決策 2。',
    ).toEqual([PROBE])
  })
})

describe('裸的物件鍵也算引用（082 補的盲點）', () => {
  /**
   * 元件身分寫成 `cpp_char_is_alpha: (c) => …`（沒有引號）時，
   * **原本完全看不見**——判定只比對引號字串字面。
   *
   * 核心層那四個字元分類函式因此一筆都沒被數到：**中立性報「0」的時候，
   * 它們還在核心裡。**
   *
   * 不只維度（身分 vs 語法）會消失在數字裡，同一維度的不同書寫形式也會。
   */
  it('★ 裸的物件鍵必須被報出', () => {
    const hits = scanText(`const t = {\n  ${PROBE}: (c) => true,\n}`, [PROBE])
    expect(
      hits.code,
      '裸的物件鍵沒被數到 → 這是 082 之前的行為，那時中立性的「0」是假的',
    ).toContain(PROBE)
  })

  it('★ 但屬性存取不得誤報——`x.zz_probe_concept` 是讀一個欄位', () => {
    expect(
      scanText(`const v = obj.${PROBE}\nconst w = 1`, [PROBE]).code,
      '把屬性存取當成身分引用的話，每一個同名欄位都會變成違規',
    ).toEqual([])
  })
})

describe('遮罩：同名的非身分字串不得被報出（FR-004）', () => {
  it('★ 型別位置：介面屬性的聯集成員', () => {
    const hits = scanText(
      `export interface Annotation {\n  type: '${PROBE}' | 'pragma' | 'lint_directive'\n}`,
      [PROBE],
    )
    expect(
      hits.code,
      '型別位置的字串在編譯後根本不存在，不可能是執行期的身分引用。' +
        '報出來的話，中立性的數字含有雜訊——而整個階段 6.5 的優先序都建立在那個數字上。',
    ).toEqual([])
  })

  it('★ 型別位置：type 別名', () => {
    const hits = scanText(`type Kind = '${PROBE}' | 'other'`, [PROBE])
    expect(hits.code).toEqual([])
  })

  it('★ UI 欄位預設值：Blockly 欄位建構式的第一引數', () => {
    // 那是使用者在積木上看到的提示文字，不是識別碼
    const hits = scanText(`.appendField(new Blockly.FieldTextInput('${PROBE}'), 'TEXT')`, [PROBE])
    expect(hits.code).toEqual([])
  })

  it('★ UI 欄位預設值：多行輸入欄位', () => {
    const hits = scanText(`new FieldMultilineInput('${PROBE}')`, [PROBE])
    expect(hits.code).toEqual([])
  })
})

describe('遮罩：保守——判不出來算違規，不算安全（FR-002）', () => {
  it('★ 單獨一個字串字面沒有可辨識的位置資訊 → 仍算違規', () => {
    const hits = scanText(`const x = '${PROBE}'`, [PROBE])
    expect(
      hits.code,
      '為了讓數字好看而樂觀歸類，比沒有護欄更糟——放行必須是**判得出來**的結果，' +
        '不是判不出來的預設。',
    ).toEqual([PROBE])
  })

  it('★ 單一成員的型別位置不算聯集 → 仍算違規（遮罩 A 要求 ≥2 個成員）', () => {
    // 只有一個成員的話，`x: 'foo'` 與物件字面 `{ x: 'foo' }` 在文字上分不開，
    // 而後者可能是真的身分引用。保守起見不遮。
    const hits = scanText(`const o = { type: '${PROBE}' }`, [PROBE])
    expect(hits.code).toEqual([PROBE])
  })
})
