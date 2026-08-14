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
import { runCppDetailed, runCppBatch, runCppBatchDetailed, hasReferenceCompiler, referenceCompilerInfo } from '../helpers/run-cpp'
import { classifyRefFailure, type refFailClass } from '../helpers/ref-failure'
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
  /**
   * 🔴 **這一筆的信號是環境相依的**——換一台機器它可能不出現。
   *
   * ## 為什麼需要這個欄位（2026-08-14，CI 抓到）
   *
   * 唯一那筆判定是 **UB（讀未初始化變數）**，而兩台機器給出兩種結果：
   *
   * ```
   * macOS / clang   印堆疊垃圾 38518960  → 與直譯器的 0 不一致 → 判定命中
   * CI     / gcc    印 0                 → 一致 → **那筆判定變成孤兒**
   * ```
   *
   * **本機全綠、CI 紅，而兩邊都正確地執行了同一條規則。**
   *
   * > **孤兒檢查假設「信號消失＝底下的事實變了」。
   * > 而對一段沒有唯一答案的程式，信號消失也可能只代表【換了一台機器】。**
   *
   * ⚠️ 這不是把孤兒檢查放寬——它只對**已經寫明理由是 UB** 的那幾筆豁免，
   * 而那個理由本身就說了「參照那一側才不可靠」。其餘的判定照樣會過期。
   *
   * ⚠️ 而 `unstableReference` 抓不到這一類：同一台機器上的垃圾值是**穩定的**
   * （同樣的堆疊佈局，跑兩次一樣）。那個能力邊界寫在下方的注入測試裡，
   * **而它今天被證實了一次，用的是最貴的方式：CI 紅**。
   */
  environmentDependent?: boolean
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
  /** 環境相依（UB）——移出分子的那些，見 `不一致筆數只准下降` 裡的說明 */
  environmentDependent?: { count: number; details: details[] }
  /** 參照跑得動而直譯器跑不動的那些——**功能缺口**，與 `mismatch`（誤差）意義相反。 */
  gaps: { gapCount: number; byStage: Record<string, number>; details: gapDetail[] }
  /**
   * 🔴 **只有直譯器跑得動的那些——而這【不是】一種缺口，是一個警訊。**
   *
   * 以前它只有一個數字，而那個數字把兩件事算在同一欄：
   *
   * ```
   * toolCannotRun     編譯器【跑不動】（缺標頭…）  → 我們量測機構的極限
   * programIsIllegal   編譯器【拒絕】它            → 🔴 我們接受了 C++ 拒絕的程式
   * unclassified       判不出來                    → 不計入任一邊
   * ```
   *
   * > **一個把「工具跑不動」與「程式不合法」算在同一欄的量測，
   * > 正好看不見我們最該擔心的那一格。**
   */
  onlyOurs: { count: number; byClass: Record<string, number>; details: oursDetail[] }
  /**
   * 參照自己每次跑都不同的那幾段——UB（讀未初始化變數之類）。
   *
   * ⚠️ **必須進基線**：不記的話「加一段 UB 語料」就能悄悄把一筆誤差
   * 轉成不可判定，而報表上看起來像修好了一個 bug。
   * 與「分母必須進基線」同一條理由。
   */
  unstableReference: { count: number; details: { corpusKey: string; corpus: string; first: string; second: string }[] }
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

/**
 * 直譯器**在哪一階段**失敗——`parse`／`lift`／`execute` 意義完全不同。
 *
 * ⚠️ 這裡原本是 `try { … } catch { return null }`：**失敗原因被完全吞掉**，
 * 於是「只有參照跑得動」那 18 段在基線上只是一個數字，
 * **而數字不會告訴你缺的是哪個功能。**
 *
 * > **誤差存了 details，缺口沒存——而它們同樣是「這個模型還差什麼」的答案。**
 */
type failStage = 'parse' | 'lift' | 'execute'
interface runOutcome {
  output: string | null
  stage?: failStage
  message?: string
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

async function runInterpreter(code: string): Promise<runOutcome> {
  let tree
  try {
    tree = parser.parse(code)
  } catch (e) {
    return { output: null, stage: 'parse', message: errText(e) }
  }
  if (!tree) return { output: null, stage: 'parse', message: 'parser 回 null' }

  let semanticTree: SemanticNode
  try {
    semanticTree = lifter.lift(tree.rootNode as never) as SemanticNode
  } catch (e) {
    return { output: null, stage: 'lift', message: errText(e) }
  }
  if (!semanticTree) return { output: null, stage: 'lift', message: 'lift 回 null' }

  try {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(semanticTree)
    // ⚠️ 是 getOutput()，不是 getState().output——後者只回 { status }。
    // 先前有一次基線把執行結果錄成空字串就是踩這個（build-guardrail 第 10 步）。
    return { output: i.getOutput().join('') }
  } catch (e) {
    return { output: null, stage: 'execute', message: errText(e) }
  }
}

/**
 * 一段**參照跑得動而直譯器跑不動**的語料——也就是一個功能缺口。
 *
 * ⚠️ 與 `details`（誤差）分開存，因為它們的意義相反：
 * **誤差＝模型是錯的（會騙人）；缺口＝模型還沒長到那裡（仍然誠實）。**
 * 而 `concepts/等價與觀察集` 那條「兩者不可合併」在這裡同樣成立。
 */
/** 只有直譯器跑得動的一段——**帶著參照為什麼拒絕**。 */
interface oursDetail {
  corpusKey: string
  corpus: string
  refClass: refFailClass
  stage: string
  message: string
}

interface gapDetail {
  corpusKey: string
  corpus: string
  stage: failStage
  message: string
}

interface result {
  undecidable: number
  bothRun: number
  onlyReferenceRuns: number
  onlyInterpreterRuns: number
  neitherRuns: number
  details: details[]
  gaps: gapDetail[]
  ours: oursDetail[]
  /** 參照自己每次跑都不同的那幾段——UB，不是誤差。 */
  unstableReference: { corpusKey: string; corpus: string; first: string; second: string }[]
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
  const r: result = { undecidable: 0, bothRun: 0, onlyReferenceRuns: 0, onlyInterpreterRuns: 0, neitherRuns: 0, details: [], gaps: [], ours: [], unstableReference: [] }
  const decidable = corpus.filter((c) => !undecidable(c))
  r.undecidable = corpus.length - decidable.length
  // 參照那一側**並行**跑（8 路）。序列跑 300 段約 8 分鐘，而
  // 一條沒有人跑的護欄等於沒有護欄。
  // ⚠️ **保留失敗理由**——`runCppBatch` 把失敗壓成 `null`，
  // 於是「編譯器跑不動」與「編譯器拒絕」變成同一件事。
  const refDetailed = reference ? null : await runCppBatchDetailed(decidable)
  const refOutputs = reference ? decidable.map(reference) : refDetailed!.map((d) => (d.ok ? d.output : null))
  for (let i = 0; i < decidable.length; i++) {
    const c = decidable[i]
    const refOutput = refOutputs[i]
    const outcome = await runInterpreter(c)
    const directOutput = outcome.output
    if (refOutput !== null && directOutput !== null) {
      // ⚠️ **不一致時，先確認參照那一側自己是穩定的。**
      //
      // 讀未初始化變數是 UB：真編譯器每次跑印出的垃圾值不同，而直譯器
      // 老老實實回 0。把它算成「誤差」是**指控一個沒有唯一答案的問題有唯一答案**
      // ——而受指控的還是比較誠實的那一邊。
      //
      // 只對不一致的那幾筆重跑（今天 6 筆），所以成本可以忽略。
      // ⚠️ 這一步**不能對全部語料做**：那會讓分母也跟著抖，而分母抖動會
      // 讓「加一段不穩定的語料」變成一種改善（`build-guardrail`：縮分母比修分子容易）。
      if (refOutput.trim() !== directOutput.trim()) {
        // ⚠️ 注入那一側也要走同一條路——否則這個機制只有正式量測跑得到，
        // 而正式量測今天是 0 段（見那支注入的檔頭）。**沒有注入的機制等於沒有機制。**
        const again = reference ? reference(c) : (await runCppBatch([c]))[0]
        if (again !== null && again.trim() !== refOutput.trim()) {
          r.undecidable++
          r.unstableReference.push({ corpusKey: key(c), corpus: c.slice(0, 200).replace(/\n/g, '⏎'), first: refOutput.slice(0, 60), second: again.slice(0, 60) })
          continue
        }
      }
      r.bothRun++
      if (refOutput.trim() !== directOutput.trim()) {
        r.details.push({
          corpusKey: key(c),
          corpus: c.slice(0, 200).replace(/\n/g, '⏎'),
          interpreter: directOutput.slice(0, 100).replace(/\n/g, '⏎'),
          reference: refOutput.slice(0, 100).replace(/\n/g, '⏎'),
        })
      }
    } else if (refOutput !== null) {
      // 參照跑得動而我們跑不動 = **一個功能缺口**，而它以前只是一個數字
      r.onlyReferenceRuns++
      r.gaps.push({
        corpusKey: key(c),
        corpus: c.slice(0, 200).replace(/\n/g, '⏎'),
        stage: outcome.stage ?? 'execute',
        message: (outcome.message ?? '').slice(0, 160).replace(/\n/g, '⏎'),
      })
    } else if (directOutput !== null) {
      // 🔴 只有我們跑得動——而**為什麼參照跑不動**決定了這是誰的問題。
      r.onlyInterpreterRuns++
      const d = refDetailed?.[i]
      const stage = d?.stage ?? 'unknown'
      const message = d?.message ?? ''
      r.ours.push({
        corpusKey: key(c),
        corpus: c.slice(0, 160).replace(/\n/g, '⏎'),
        refClass: classifyRefFailure(d?.stage, message),
        stage,
        message: message.slice(0, 160).replace(/\n/g, '⏎'),
      })
    }
    else r.neitherRuns++
  }
  return r
}

/** 只有我們跑得動的那些，按「參照為什麼拒絕」分組。 */
function oursByClass(ours: readonly { refClass: refFailClass }[]): Record<string, number> {
  const out: Record<string, number> = { toolCannotRun: 0, programIsIllegal: 0, unclassified: 0 }
  for (const o of ours) out[o.refClass]++
  return out
}

/** 缺口按失敗階段分組——`parse`／`lift`／`execute` 對應完全不同的工作。 */
function gapsByStage(gaps: readonly gapDetail[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of gaps) out[g.stage] = (out[g.stage] ?? 0) + 1
  return out
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
  it('★ 注入：參照自己每次跑都不同 → 歸「不可判定」，不得算成誤差', async () => {
    // ⚠️ **今天真實語料上這一欄是 0**，所以只有這支注入證明機制會動。
    //
    // 那筆讀未初始化變數的 UB（直譯器 0、參照 38518960）**沒有被抓到**，
    // 因為同一台機器上的垃圾值是穩定的——跑兩次一樣。
    //
    // > **一個第一次跑就是 0 的檢查，與一個什麼都沒量到的檢查產出相同
    // > ——除非有注入證明它會動。**
    //
    // 所以這個機制擋的是**真的每次不同**的那一種（時間、位址、未初始化的堆），
    // 而不是所有 UB。能力邊界寫在這裡。
    const program = '#include <iostream>\nusing namespace std;\nint main(){ int x; cout << x << endl; }'
    let n = 0
    const drifting = (): string => `${(n += 1000)}\n`
    const r = await measure([program], drifting)
    expect(r.details, 'UB 被算成誤差了——那是指控一個沒有唯一答案的問題有唯一答案').toHaveLength(0)
    expect(r.unstableReference, '參照不穩定卻沒有被記下來').toHaveLength(1)
    expect(r.undecidable, '它必須落進不可判定那一欄').toBe(1)
    expect(r.bothRun, '不可判定的不得同時算進分母').toBe(0)
  })

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

    // 🔴 **環境相依的判定要移出分子，不能只在報表上註記。**
    //
    // 那一筆是 UB（讀未初始化變數），而兩台機器給出兩種結果：
    // macOS 的 clang 印堆疊垃圾 → 算一筆不一致；CI 的 gcc 印 0 → 一致。
    //
    // 只把它「判定過」而留在 `details` 裡的話，**這個數字本身就是環境相依的**：
    //
    // ```
    // 基線記 1  →  CI 實測 0  →  「棘輪有改善，請下調基線」  → CI 紅
    // 基線記 0  →  本機實測 1 →  「棘輪退步」                → 本機紅
    // ```
    //
    // **兩邊都無解**——因為分子裡混了一個沒有唯一答案的樣本。
    // 處置與 `undecidable`（讀 cin／rand）同一條：**它不該在分子裡**。
    //
    // ⚠️ 而它另立一欄而不是靜靜消失——`build-guardrail` 第 11 步：
    // 「已判定的移出『要看』，**另立一欄**」。縮分母比修分子容易，所以縮掉的要看得見。
    const envDependent = r.details.filter((d) => decided.get(d.corpusKey)?.environmentDependent)
    const mismatches = r.details.filter((d) => !decided.get(d.corpusKey)?.environmentDependent)
    const toReview = mismatches.filter((d) => !decided.has(d.corpusKey))
    // ⚠️ **環境相依的判定不算孤兒**：它的信號本來就可能在別的環境不出現。
    const orphans = decisions.filter(
      (d) => !d.environmentDependent && !r.details.some((m) => m.corpusKey === d.corpusKey),
    )

    printReport('行為的誤差（直譯器 vs 參照編譯器）', [
      `參照   ${referenceCompilerInfo().version}  ${referenceCompilerInfo().flags}`,
      '',
      `語料   不可判定（讀輸入／亂數）${r.undecidable}｜兩邊都跑得動 ${r.bothRun}｜只有參照 ${r.onlyReferenceRuns}｜只有直譯器 ${r.onlyInterpreterRuns}｜兩邊都不成 ${r.neitherRuns}`,
      `       ⚠️ 五欄都要看——縮分母比修分子容易，而「加一段讀 cin 的語料」就能縮分母`,
      `誤差   ${mismatches.length} 筆不一致（已判定 ${mismatches.length - toReview.length}，要看 ${toReview.length}）`,
      `環境   ${envDependent.length} 筆**移出分子**（UB——參照那一側沒有唯一答案，換台機器結果就不同）`,
      '',
      ...toReview.slice(0, 30).map((d, i) => `  ${i + 1}. ${d.corpusKey}\n       直譯器「${d.interpreter}」 參照「${d.reference}」`),
      '',
      `不穩   ${r.unstableReference.length} 段**參照自己每次跑都不同**（UB）——那不是誤差，是那段程式沒有唯一答案`,
      ...r.unstableReference.map((u) => `  • ${u.corpusKey}\n       第一次「${u.first}」 第二次「${u.second}」`),
      '',
      `缺口   ${r.gaps.length} 段參照跑得動而直譯器跑不動——**模型還沒長到那裡，不是它在騙人**`,
      `       階段分布：${Object.entries(gapsByStage(r.gaps)).map(([s, n]) => `${s}=${n}`).join('｜') || '（無）'}`,
      ...r.gaps.slice(0, 20).map((g, i) => `  ${i + 1}. [${g.stage}] ${g.message || '（無訊息）'}\n       ${g.corpus.slice(0, 90)}`),
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
        mismatch: { mismatchCount: mismatches.length, details: mismatches },
        environmentDependent: { count: envDependent.length, details: envDependent },
        gaps: { gapCount: r.gaps.length, byStage: gapsByStage(r.gaps), details: r.gaps },
        // 🔴 只有我們跑得動的那些——**按「參照為什麼拒絕」分類**，見型別上的說明
        onlyOurs: { count: r.ours.length, byClass: oursByClass(r.ours), details: r.ours },
        unstableReference: { count: r.unstableReference.length, details: r.unstableReference },
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
    assertRatchet([['不一致筆數', mismatches.length, base.mismatch.mismatchCount]])
  }, 900000)
})
