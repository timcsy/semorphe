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
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE, decisionKey } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const GUARD_NAME = 'behavior-error'
const decisionFile = path.join(REPO_ROOT, 'tests/assets/behavior-error-decisions.json')

interface decision {
  corpusKey: string
  signal: string
  /**
   * ⚠️ **值域縮過一次**（2026-08-10）：原本還有
   * `'語料需要標準輸入'` 與 `'語料是故意錯的示範'`，而 `不可判定()`
   * 把讀 `cin`／用 `rand` 的語料濾在**明細之前**——那兩個值於是
   * **永遠不可能被用到**，卻還留在值域裡看起來像有人在判。
   *
   * 這與 `#33` 是同一個根的兩個方向：
   * **機器分類與人的判定詞彙各自演化，而沒有東西在對齊它們。**
   * - `#33` 機器長出新類別、人的詞彙沒跟上 → 舊詞被硬套
   * - 這裡 機器**接管**了一個類別、人的詞彙沒縮回 → **死值留著**
   */
  decision: '真誤差' | '其他'
  reason: string
  /** 這一筆的成因。「一筆 ≠ 一個工作」——同一個根因下的筆數會一起消失。 */
  rootCause?: string
}

interface details {
  corpusKey: string
  corpus: string
  interpreter: string
  reference: string
}

interface Baseline {
  _meta: { referenceCompiler: string; flag: string; note: string; ratchet: string }
  corpus: { undecidable: number; bothRun: number; onlyReferenceRuns: number; onlyInterpreterRuns: number; neitherRuns: number }
  mismatch: { mismatchCount: number; details: details[] }
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
function fetchCorpus(): string[] {
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

/**
 * 語料的識別鍵。
 *
 * ⚠️ **第一版只截前 80 字元，而它會碰撞**（2026-08-10 `specs/110` 發現）：
 * 17 筆明細只有 16 個不同鍵、19 筆判定只有 16 個。後果是
 * **孤兒檢查與「要看」都不可靠**——一筆新誤差會被同鍵的舊判定遮掉，
 * 而報表上看起來是「已判定」。
 *
 * 這與「**以名字為基礎的比對忘了詞界**」是同一族：**識別碼必須識別得出那個東西。**
 * 所以補上全文的雜湊。
 */
const key = (c: string): string => {
  const normalize = c.replace(/\s+/g, ' ').trim()
  return decisionKey(normalize.slice(0, 60), normalize)
}

async function runInterpreter(code: string): Promise<string | null> {
  try {
    const tree = parser.parse(code)
    if (!tree) return null
    const semanticTree = lifter.lift(tree.rootNode as never) as SemanticNode
    if (!semanticTree) return null
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(semanticTree)
    // ⚠️ 是 getOutput()，不是 getState().output——後者只回 { status }。
    // 先前有一次基線把執行結果錄成空字串就是踩這個（build-guardrail 第 10 步）。
    return i.getOutput().join('')
  } catch {
    return null
  }
}

interface result {
  undecidable: number
  bothRun: number
  onlyReferenceRuns: number
  onlyInterpreterRuns: number
  neitherRuns: number
  details: details[]
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
const undecidable = (c: string): boolean => /\bcin\s*>>|\bscanf\s*\(|getline\s*\(|\brand\s*\(/.test(c)

/** 參照那一側可以被替換——注入測試靠它，而正式量測用真的編譯器。 */
type referenceRun = (code: string) => string | null

async function measure(corpus: readonly string[], reference?: referenceRun): Promise<result> {
  const r: result = { undecidable: 0, bothRun: 0, onlyReferenceRuns: 0, onlyInterpreterRuns: 0, neitherRuns: 0, details: [] }
  const decidable = corpus.filter((c) => !undecidable(c))
  r.undecidable = corpus.length - decidable.length
  // 參照那一側**並行**跑（8 路）。序列跑 300 段約 8 分鐘，而
  // 一條沒有人跑的護欄等於沒有護欄。
  const refOutputs = reference ? decidable.map(reference) : await runCppBatch(decidable)
  for (let i = 0; i < decidable.length; i++) {
    const c = decidable[i]
    const refOutput = refOutputs[i]
    const directOutput = await runInterpreter(c)
    if (refOutput !== null && directOutput !== null) {
      r.bothRun++
      if (refOutput.trim() !== directOutput.trim()) {
        r.details.push({
          corpusKey: key(c),
          corpus: c.slice(0, 200).replace(/\n/g, '⏎'),
          interpreter: directOutput.slice(0, 100).replace(/\n/g, '⏎'),
          reference: refOutput.slice(0, 100).replace(/\n/g, '⏎'),
        })
      }
    } else if (refOutput !== null) r.onlyReferenceRuns++
    else if (directOutput !== null) r.onlyInterpreterRuns++
    else r.neitherRuns++
  }
  return r
}

function readDecisions(): decision[] {
  return fs.existsSync(decisionFile) ? (JSON.parse(fs.readFileSync(decisionFile, 'utf8')) as decision[]) : []
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
    const corpus = fetchCorpus()
    expect(corpus.length, '一段完整程式都沒撈到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    const r = await measure(corpus.slice(0, 20))
    expect(r.bothRun, '前 20 段沒有一段兩邊都跑得動 → 量測機構壞了').toBeGreaterThan(0)
  }, 300000)

  // ── 雙向注入 ────────────────────────────────────────────────────
  it('★ 注入①：參照給出不同答案時，必須被報成誤差', async () => {
    // 真正的注入：**替換參照那一側**，讓它回一個確定不同的答案。
    // 不依賴「直譯器現在剛好有某個 bug」——那種錨會在修好的那天失效
    // （`build-guardrail` 第 2 步）。
    const program = '#include <iostream>\nusing namespace std;\nint main(){ cout << 42; return 0; }'
    const r = await measure([program], () => '這不是 42')
    expect(r.bothRun, '兩邊都有輸出，必須進分母').toBe(1)
    expect(r.details, '參照與直譯器答案不同卻沒被報 → 這條護欄看不見系統在騙人').toHaveLength(1)
    expect(r.details[0].reference).toContain('這不是 42')
    expect(r.details[0].interpreter).toContain('42')
  }, 60000)

  it('★ 注入②：兩邊一致的程式不得被誤報', async () => {
    const r = await measure(['#include <iostream>\nusing namespace std;\nint main(){ cout << 42; return 0; }'])
    expect(r.bothRun, '這一段兩邊都該跑得動').toBe(1)
    expect(r.details, '兩邊輸出相同卻被報成誤差 → 這條護欄會謊報系統在騙人').toHaveLength(0)
  }, 60000)

  it('★ 注入③：只有一邊跑得動的不得算成「一致」', async () => {
    // 模板：參照編譯得過，直譯器不理解 → 必須進「只有參照跑得動」欄，
    // 不得從分母消失也不得算成一致。
    const r = await measure(['#include <iostream>\ntemplate<typename T> T f(T x){ return x; }\nint main(){ std::cout << f(1); }'])
    expect(r.undecidable + r.bothRun + r.onlyReferenceRuns + r.onlyInterpreterRuns + r.neitherRuns, '每一段都必須落進某一欄').toBe(1)
  }, 60000)

  it('★ 注入④：不可判定的語料必須進自己那一欄，不得算成誤差', async () => {
    // 讀 cin 的程式在無輸入下沒有唯一答案——參照讀到未初始化記憶體、
    // 直譯器回 0，**兩邊都不算錯**。把它算成誤差，等於謊報系統在騙人。
    const r = await measure(['#include <iostream>\nusing namespace std;\nint main(){ int n; cin >> n; cout << n; }'])
    expect(r.undecidable, '讀標準輸入的語料必須進不可判定那一欄').toBe(1)
    expect(r.bothRun, '它不得進分母').toBe(0)
    expect(r.details, '它不得被算成誤差').toHaveLength(0)
  }, 60000)

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('不一致筆數只准下降', async () => {
    const corpus = fetchCorpus()
    const r = await measure(corpus)
    const decisions = readDecisions()
    const decided = new Map(decisions.map((d) => [d.corpusKey, d]))
    const toReview = r.details.filter((d) => !decided.has(d.corpusKey))
    const orphans = decisions.filter((d) => !r.details.some((m) => m.corpusKey === d.corpusKey))

    printReport('行為的誤差（直譯器 vs 參照編譯器）', [
      `參照   ${referenceCompilerInfo().version}  ${referenceCompilerInfo().flags}`,
      '',
      `語料   不可判定（讀輸入／亂數）${r.undecidable}｜兩邊都跑得動 ${r.bothRun}｜只有參照 ${r.onlyReferenceRuns}｜只有直譯器 ${r.onlyInterpreterRuns}｜兩邊都不成 ${r.neitherRuns}`,
      `       ⚠️ 五欄都要看——縮分母比修分子容易，而「加一段讀 cin 的語料」就能縮分母`,
      `誤差   ${r.details.length} 筆不一致（已判定 ${r.details.length - toReview.length}，要看 ${toReview.length}）`,
      '',
      ...toReview.slice(0, 30).map((d, i) => `  ${i + 1}. ${d.corpusKey}\n       直譯器「${d.interpreter}」 參照「${d.reference}」`),
      ...(orphans.length ? ['', `⚠️ 孤兒判定 ${orphans.length} 筆（訊號已消失，判定可能不再成立）：`, ...orphans.map((d) => `  - ${d.corpusKey}`)] : []),
    ])

    // ⚠️ 斷言放在產基線**之後**。放在之前會死結：孤兒判定要靠新基線才知道
    // 哪些消失了，而新基線又產不出來。**產基線是維護模式，不是一次量測。**
    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD_NAME, {
        _meta: {
          referenceCompiler: referenceCompilerInfo().version,
          flag: referenceCompilerInfo().flags,
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
        corpus: {
          undecidable: r.undecidable,
          bothRun: r.bothRun,
          onlyReferenceRuns: r.onlyReferenceRuns,
          onlyInterpreterRuns: r.onlyInterpreterRuns,
          neitherRuns: r.neitherRuns,
        },
        mismatch: { mismatchCount: r.details.length, details: r.details },
      })
      return
    }

    expect(orphans, '判定過期了。底下的事實變了，留著會讓一個過期的結論繼續生效。').toHaveLength(0)
    expect(
      decisions.filter((d) => !d.reason || d.reason.length < 4),
      '每一筆判定必須有理由——沒有理由的判定是把「懶得看」寫成「看過了」',
    ).toHaveLength(0)
    expect(
      decisions.filter((d) => !d.rootCause),
      '每一筆判定必須有根因——「一筆 ≠ 一個工作」，沒有根因就看不出哪些會一起消失',
    ).toHaveLength(0)

    const base = loadBaseline<Baseline>(GUARD_NAME)
    assertRatchet([['不一致筆數', r.details.length, base.mismatch.mismatchCount]])
  }, 900000)
})
