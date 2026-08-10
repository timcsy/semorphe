/**
 * **第三十二條護欄：行為的誤差**——直譯器與參照編譯器差多少。
 *
 * ## 它量什麼，以及為什麼它與殘差那條是兩條
 *
 * ```
 * 殘差高  →  模型還沒長到那裡（系統**仍然正確**）    ← audit-projection-residual
 * 誤差高  →  模型是錯的（系統**會騙人**）            ← 本檔
 * ```
 *
 * **兩者不可混成一個數字。** 混起來的話，多蓋幾顆元件（降低殘差）會讓一個
 * 「會騙人」的數字看起來在改善。所以是兩條基線兩個檔，刻意不共用結構。
 *
 * ## 為什麼這一條非蓋不可
 *
 * 蓋它之前，`tests/` 裡有 27 個檔提到參照編譯器，而**沒有一個在自動比較**
 * 「直譯器 vs 參照」——那些答案是**人工量一次、凍進註解與預期字串**，例如
 * `declare-family-semantics.test.ts` 的 `it('★ g++ 說是 123（不是 111）', …)`。
 *
 * 一個凍結的讀數是**宣告**，不是量測。而
 * `knowledge/concepts/等價與觀察集.md`：「**行為由量測定義，不由宣告定義**」。
 * 回饋週期是無限大 ⇒ **開環**，而 §三 記過開環正是出事的地方。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「兩邊都跑得動的段數」是 0，代表量測機構壞了，不是世界長這樣。**
 *
 * 錨在**分母**上——那是這條護欄的輸入量，不是它要推向零的東西。
 * 錨在「不一致筆數 > 0」上會在修好直譯器的那天變紅
 * （`build-guardrail` 第 2 步，已經犯過七次）。
 *
 * ## ⚠️⚠️ 分母必須進基線
 *
 * 只記分子的話，**讓直譯器多壞掉幾段就能讓誤差下降**——縮分母比修分子容易。
 * 所以五欄都記：不可判定／兩邊都跑得動／只有參照／只有直譯器／兩邊都不成。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測產出的碼**——那是來回轉換那批的事。
 * - **不檢測模型覆蓋率**——那是殘差那條。
 * - **不判定哪一筆是「真的」誤差**——靜態與實測都只能排順序。判定的落點是
 *   `tests/assets/behavior-error-decisions.json`，每一筆必須有理由
 *   （`build-guardrail` 第 11 步）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed, runCppBatch, hasReferenceCompiler, referenceCompilerInfo } from '../helpers/run-cpp'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const 護欄名 = 'behavior-error'
const 判定檔 = path.join(REPO_ROOT, 'tests/assets/behavior-error-decisions.json')

interface 判定 {
  語料鍵: string
  訊號: string
  判定: '真誤差' | '語料需要標準輸入' | '語料是故意錯的示範' | '其他'
  理由: string
  /** 這一筆的成因。「一筆 ≠ 一個工作」——同一個根因下的筆數會一起消失。 */
  根因?: string
}

interface 明細 {
  語料鍵: string
  語料: string
  直譯器: string
  參照: string
}

interface 基線 {
  _meta: { 參照編譯器: string; 旗標: string; note: string; ratchet: string }
  語料: { 不可判定: number; 兩邊都跑得動: number; 只有參照跑得動: number; 只有直譯器跑得動: number; 兩邊都不成: number }
  誤差: { 不一致筆數: number; 明細: 明細[] }
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

/** 撈**完整程式**（帶 `int main`）。片段不能執行，與殘差那條的分欄規則不同。 */
function 撈語料(): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/`([^`]{4,600})`/g)) {
      // ⚠️ 檔案文字裡的 `\\n`（兩個字元）是樣板字面值的跳脫，還原成 C++ 原始碼
      // 時應該是 `\n`（反斜線＋n）。第一版寫成 `/\\n/ → 換行`，把
      // `\\n` 拆成「反斜線＋真換行」＝ C 的**續行符**，於是 printf 的格式
      // 字串被吃掉，8 段語料被誤報成誤差。**第三次語料出問題，而這次是自找的。**
      const c = m[1].replace(/\\\\/g, '\\')
      if (!/int\s+main/.test(c)) continue
      if (c.includes('${')) continue
      out.push(c)
    }
  }
  return [...new Set(out)]
}

const 鍵 = (c: string): string => c.replace(/\s+/g, ' ').trim().slice(0, 80)

async function 跑直譯器(code: string): Promise<string | null> {
  try {
    const tree = parser.parse(code)
    if (!tree) return null
    const 語義樹 = lifter.lift(tree.rootNode as never) as SemanticNode
    if (!語義樹) return null
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(語義樹)
    // ⚠️ 是 getOutput()，不是 getState().output——後者只回 { status }。
    // 先前有一次基線把執行結果錄成空字串就是踩這個（build-guardrail 第 10 步）。
    return i.getOutput().join('')
  } catch {
    return null
  }
}

interface 結果 {
  不可判定: number
  兩邊都跑得動: number
  只有參照跑得動: number
  只有直譯器跑得動: number
  兩邊都不成: number
  明細: 明細[]
}

/**
 * **不可判定的語料**——不是誤差，是這段程式在無人值守下沒有唯一答案。
 *
 * 兩種：
 * - **讀標準輸入**：無輸入時參照讀到未初始化記憶體（垃圾值），直譯器回 0。
 *   兩邊都不算錯，這段程式本身是欠定的。
 * - **用亂數／時間**：每次跑都不同。
 *
 * ⚠️ 這與殘差那條的「語法有錯片段」是**同一個形狀**：語料品質問題，
 * 而處置也必須相同——**另立一欄，不是靜默排除**。靜默排除的話，
 * 「加一段讀 cin 的語料」就能讓誤差率下降。
 */
const 不可判定 = (c: string): boolean => /\bcin\s*>>|\bscanf\s*\(|getline\s*\(|\brand\s*\(/.test(c)

/** 參照那一側可以被替換——注入測試靠它，而正式量測用真的編譯器。 */
type 參照執行 = (code: string) => string | null

async function 量(語料: readonly string[], 參照?: 參照執行): Promise<結果> {
  const r: 結果 = { 不可判定: 0, 兩邊都跑得動: 0, 只有參照跑得動: 0, 只有直譯器跑得動: 0, 兩邊都不成: 0, 明細: [] }
  const 可判定 = 語料.filter((c) => !不可判定(c))
  r.不可判定 = 語料.length - 可判定.length
  // 參照那一側**並行**跑（8 路）。序列跑 300 段約 8 分鐘，而
  // 一條沒有人跑的護欄等於沒有護欄。
  const 參輸出s = 參照 ? 可判定.map(參照) : await runCppBatch(可判定)
  for (let i = 0; i < 可判定.length; i++) {
    const c = 可判定[i]
    const 參輸出 = 參輸出s[i]
    const 直輸出 = await 跑直譯器(c)
    if (參輸出 !== null && 直輸出 !== null) {
      r.兩邊都跑得動++
      if (參輸出.trim() !== 直輸出.trim()) {
        r.明細.push({
          語料鍵: 鍵(c),
          語料: c.slice(0, 200).replace(/\n/g, '⏎'),
          直譯器: 直輸出.slice(0, 100).replace(/\n/g, '⏎'),
          參照: 參輸出.slice(0, 100).replace(/\n/g, '⏎'),
        })
      }
    } else if (參輸出 !== null) r.只有參照跑得動++
    else if (直輸出 !== null) r.只有直譯器跑得動++
    else r.兩邊都不成++
  }
  return r
}

function 讀判定(): 判定[] {
  return fs.existsSync(判定檔) ? (JSON.parse(fs.readFileSync(判定檔, 'utf8')) as 判定[]) : []
}

describe('第三十二條護欄：行為的誤差', () => {
  // ── FR-006：缺編譯器要紅，不得 skip ────────────────────────────────
  it('★ 參照編譯器必須存在（缺席時要紅，不是跳過）', () => {
    expect(
      hasReferenceCompiler(),
      '找不到參照編譯器。這條護欄**不得跳過**——一筆看不見的缺陷與一筆不存在的缺陷，在報表上長得一模一樣。',
    ).toBe(true)
  })

  // ── 健康檢查：錨在分母（輸入量），不錨在不一致筆數 ──────────────────
  it('★ 健康檢查：語料真的載入且兩邊都跑得動', async () => {
    const 語料 = 撈語料()
    expect(語料.length, '一段完整程式都沒撈到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    const r = await 量(語料.slice(0, 20))
    expect(r.兩邊都跑得動, '前 20 段沒有一段兩邊都跑得動 → 量測機構壞了').toBeGreaterThan(0)
  }, 300000)

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：參照給出不同答案時，必須被報成誤差', async () => {
    // 真正的注入：**替換參照那一側**，讓它回一個確定不同的答案。
    // 不依賴「直譯器現在剛好有某個 bug」——那種錨會在修好的那天失效
    // （`build-guardrail` 第 2 步）。
    const 程式 = '#include <iostream>\nusing namespace std;\nint main(){ cout << 42; return 0; }'
    const r = await 量([程式], () => '這不是 42')
    expect(r.兩邊都跑得動, '兩邊都有輸出，必須進分母').toBe(1)
    expect(r.明細, '參照與直譯器答案不同卻沒被報 → 這條護欄看不見系統在騙人').toHaveLength(1)
    expect(r.明細[0].參照).toContain('這不是 42')
    expect(r.明細[0].直譯器).toContain('42')
  }, 60000)

  it('★ 注入②：兩邊一致的程式不得被誤報', async () => {
    const r = await 量(['#include <iostream>\nusing namespace std;\nint main(){ cout << 42; return 0; }'])
    expect(r.兩邊都跑得動, '這一段兩邊都該跑得動').toBe(1)
    expect(r.明細, '兩邊輸出相同卻被報成誤差 → 這條護欄會謊報系統在騙人').toHaveLength(0)
  }, 60000)

  it('★ 注入③：只有一邊跑得動的不得算成「一致」', async () => {
    // 模板：參照編譯得過，直譯器不理解 → 必須進「只有參照跑得動」欄，
    // 不得從分母消失也不得算成一致。
    const r = await 量(['#include <iostream>\ntemplate<typename T> T f(T x){ return x; }\nint main(){ std::cout << f(1); }'])
    expect(r.不可判定 + r.兩邊都跑得動 + r.只有參照跑得動 + r.只有直譯器跑得動 + r.兩邊都不成, '每一段都必須落進某一欄').toBe(1)
  }, 60000)

  it('★ 注入④：不可判定的語料必須進自己那一欄，不得算成誤差', async () => {
    // 讀 cin 的程式在無輸入下沒有唯一答案——參照讀到未初始化記憶體、
    // 直譯器回 0，**兩邊都不算錯**。把它算成誤差，等於謊報系統在騙人。
    const r = await 量(['#include <iostream>\nusing namespace std;\nint main(){ int n; cin >> n; cout << n; }'])
    expect(r.不可判定, '讀標準輸入的語料必須進不可判定那一欄').toBe(1)
    expect(r.兩邊都跑得動, '它不得進分母').toBe(0)
    expect(r.明細, '它不得被算成誤差').toHaveLength(0)
  }, 60000)

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('不一致筆數只准下降', async () => {
    const 語料 = 撈語料()
    const r = await 量(語料)
    const 判定s = 讀判定()
    const 已判定 = new Map(判定s.map((d) => [d.語料鍵, d]))
    const 要看 = r.明細.filter((d) => !已判定.has(d.語料鍵))
    const 孤兒 = 判定s.filter((d) => !r.明細.some((m) => m.語料鍵 === d.語料鍵))

    printReport('行為的誤差（直譯器 vs 參照編譯器）', [
      `參照   ${referenceCompilerInfo().version}  ${referenceCompilerInfo().flags}`,
      '',
      `語料   不可判定（讀輸入／亂數）${r.不可判定}｜兩邊都跑得動 ${r.兩邊都跑得動}｜只有參照 ${r.只有參照跑得動}｜只有直譯器 ${r.只有直譯器跑得動}｜兩邊都不成 ${r.兩邊都不成}`,
      `       ⚠️ 五欄都要看——縮分母比修分子容易，而「加一段讀 cin 的語料」就能縮分母`,
      `誤差   ${r.明細.length} 筆不一致（已判定 ${r.明細.length - 要看.length}，要看 ${要看.length}）`,
      '',
      ...要看.slice(0, 30).map((d, i) => `  ${i + 1}. ${d.語料鍵}\n       直譯器「${d.直譯器}」 參照「${d.參照}」`),
      ...(孤兒.length ? ['', `⚠️ 孤兒判定 ${孤兒.length} 筆（訊號已消失，判定可能不再成立）：`, ...孤兒.map((d) => `  - ${d.語料鍵}`)] : []),
    ])

    // ⚠️ 斷言放在產基線**之後**。放在之前會死結：孤兒判定要靠新基線才知道
    // 哪些消失了，而新基線又產不出來。**產基線是維護模式，不是一次量測。**
    if (process.env.GENERATE_BASELINE) {
      writeBaseline(護欄名, {
        _meta: {
          參照編譯器: referenceCompilerInfo().version,
          旗標: referenceCompilerInfo().flags,
          note:
            '行為的誤差：直譯器輸出與參照編譯器輸出不一致的筆數，也就是模型**理解錯**的部分。\n' +
            '⚠️ 這不是殘差。誤差高＝模型是錯的（系統會騙人）；殘差高＝模型還沒長到那裡（系統仍然正確）。\n' +
            '殘差在 projection-residual.json，**兩者不可合併**——混起來的話，多蓋幾顆元件會讓「會騙人」的數字看起來在改善。\n' +
            '⚠️ 四欄語料統計缺一不可。只記不一致筆數的話，**讓直譯器多壞掉幾段就能讓誤差下降**——縮分母比修分子容易。\n' +
            '⚠️ 參照編譯器記的是**版本字串原文**：macOS 的 /usr/bin/g++ 是 Apple clang 的別名，\n' +
            '記成「g++」的話，換一台機器跑出不同數字時沒有人查得出原因。\n' +
            '哪一筆是「真的」誤差要人判，落點在 tests/assets/behavior-error-decisions.json，每一筆必須有理由。',
          ratchet: RATCHET_NOTE,
        },
        語料: {
          不可判定: r.不可判定,
          兩邊都跑得動: r.兩邊都跑得動,
          只有參照跑得動: r.只有參照跑得動,
          只有直譯器跑得動: r.只有直譯器跑得動,
          兩邊都不成: r.兩邊都不成,
        },
        誤差: { 不一致筆數: r.明細.length, 明細: r.明細 },
      })
      return
    }

    expect(孤兒, '判定過期了。底下的事實變了，留著會讓一個過期的結論繼續生效。').toHaveLength(0)
    expect(
      判定s.filter((d) => !d.理由 || d.理由.length < 4),
      '每一筆判定必須有理由——沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(
      判定s.filter((d) => !d.根因),
      '每一筆判定必須有根因——「一筆 ≠ 一個工作」，沒有根因就看不出哪些會一起消失',
    ).toHaveLength(0)

    const base = loadBaseline<基線>(護欄名)
    assertRatchet([['不一致筆數', r.明細.length, base.誤差.不一致筆數]])
  }, 900000)
})
