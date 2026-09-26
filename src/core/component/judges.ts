/**
 * **判定者**——一條契約說「我保證什麼」之後，**誰會因為它假了而叫**。
 *
 * ## 它從哪來
 *
 * `knowledge/draft/2026-09-22-元件宣告的契約化.md` §十一之三 定的最重要一件事：
 *
 * > **你不宣告等級，等級是「誰判它」算出來的。**
 *
 * 於是 `evidence: "L2"` 這種欄位不該存在（它會說謊），而該存的是**判定者**。
 * 而 §十一之五 指出空出來的那一格才是最該數的數字：
 *
 * ```
 * 契約總數          我們寫了多少
 * 🔴 judge == null  我們【自以為】驗了多少
 * ```
 *
 * 🔴 **它對得上 `principles.md` 的最終檢驗表那一列，而對應是逐字的**：
 *
 * > | 這裡出錯會有人發現嗎 | **誠實降級**：答案是「不會」的每一處都是等待發生的靜默降級 |
 *
 * `judge: null` 就是那一格的機械化形式。⟹ **它的筆數是契約的誠實度度量**，
 * 與 P6 的「`raw_code` 覆蓋率是誠實度的度量，不是缺陷數量的度量」同形。
 *
 * ## 🔴 為什麼值是「種類」而不是工具名
 *
 * draft 原本列的是 `tree-sitter` ／ `blockly` ／ `reference:g++` ／ `cella`
 * ——**那些是工具名，而這個檔在 `src/core/`**。
 *
 * ```
 * P9 核心純淨性   core 不 import view
 * P9 語言獨立性   拔掉 C++ 之後這個檔還要成立
 * ```
 *
 * `blockly` 是視圖的、`g++` 是 C++ 的。把它們寫進核心，等於讓「誰判它」
 * 這件事**知道它是誰在判**——而那正是這一整個階段在拆的耦合。
 *
 * > **一個判定者的【種類】跨域成立；它的【實作】屬於那個域。**
 *
 * ⟹ 核心存種類（閉集），具體綁定屬於語言／視圖套件（`judgeBy`）。
 *
 * ## ⚠️ 閉集，而加值是顯式動作
 *
 * 與 `law`（`shared` ／ `exclusive`）、`RefusalReason` 同一條規矩
 * （`concepts/元件.md`：「各域自己的是封閉詞彙表，而加字是顯式動作」）。
 * **列舉值有剪枝力，謂詞沒有**——換成自由字串之後，沒有人知道總共有幾種判定者，
 * 而「有幾條契約沒有判定者」就數不出來了。
 *
 * ## 🔴 一個當場被自己的入口條件斷言抓到的設計缺陷（2026-09-26，落地當天）
 *
 * 第一版的護欄問的是「**有沒有判定者**」，而加上 `PATH_JUDGE` 的預設之後
 * 那個數字**結構上必為 0**——每一路都有預設，所以沒有一格是裸的。
 *
 * ⚠️ 而那正好是同一天第 240 刀學到的那條的**分子版本**：
 *
 * > **一條硬性零如果它的分母是零，它永遠成立——而那與「做到了」長得一樣。**
 *
 * ⟹ **真正的問題不是「有沒有判定者」，是「那個判定者【看過這一顆】嗎」。**
 *
 * ```
 * 宣告上   六路都有預設判定者              ← 這是【宣稱】
 * 實測上   只有 execute 那一路量過覆蓋率     ← 125 / 210,裸著 85
 * 其餘五路  🔴 判定者宣稱覆蓋,而【沒有人量過】
 * ```
 *
 * 🟢 抓到它的是護欄自己那條「覆蓋率不是 100%，那代表工具壞了」——
 * **寫在量測之前的自我否證聲明，第一次跑就兌現了。**
 *
 * ## 🔴 而第二輪（把 `evidence` 讓人讀一遍）改正了三格
 *
 * 第一版的 `evidence` 是**照 draft 填的，沒有人讀過那些檔**。讀完之後：
 *
 * ```
 * lift      🔴 指著 roundtrip-all,而那個檔 `lift` 出現【0 次】
 *           它的三個 describe 是 Render／Extract／Code generation
 *           ⟹ lift 【沒有逐元件的判定者】,只有 29 個手寫案例
 * generate  🔴 指著 audit-completeness（那條只驗「有沒有檔案」)
 *           真正的判定者是 roundtrip-all,而它的標題【說謊】：
 *           `if (!spec.codeTemplate?.pattern) continue` —— 走手寫產生器的 250 顆整批跳過
 * render    🟡 指著 audit-lesson-loadable（只涵蓋課文用到的）
 *           真正逐元件的是 roundtrip-all 的 Render coverage：345 / 349
 * ```
 *
 * > **一個叫「every component」的檢查，可以在第二行就 `continue` 掉七成
 * > ——而它的名字與它的讀數都不會出聲。**
 *
 * ⟹ 於是這張表多兩欄：`judges`（**它判的是什麼**，人讀出來的一句）
 * 與 `coverage`（逐元件的覆蓋率，`null` ＝ 沒有人量過）。
 * **`judges` 的存在讓下一個人否證得了我**——那是正向錨點的形狀。
 *
 * ## 本檔不回答什麼
 *
 * - **不回答「那個判定者判得對不對」**——它只說「有一個」。
 *   一個判錯的判定者與一個對的判定者，在這裡長得一樣。
 * - **不回答 `preconditions` 與 `invariants` 的判定者**。那兩格的判定者
 *   **要宣告**（draft §十一之四），而宣告出來的欄位會說謊——第一刀刻意不碰。
 */
import { FIVE_PATHS, type FivePath } from './types'

/**
 * 判定者的**種類**。閉集——加值是顯式動作。
 *
 * ⚠️ 每一個都是「誰來判」，**不是「用什麼工具判」**。
 */
export type JudgeKind =
  /** 文法判得出來：產出餵回 parser 會不會過。具體 parser 屬於語言套件。 */
  | 'grammar'
  /** 渲染器判得出來：產出的 state 載不載得進工作區。具體渲染器屬於視圖套件。 */
  | 'renderer'
  /** 相等判定：來回一趟回到同一個東西。 */
  | 'equality'
  /** 外部參照實作：跟一個我們沒有寫的東西對答案。⚠️ 貴 ⟹ 取樣。 */
  | 'reference'
  /** 執行期檢查：跑到就檢查，違反 ＝ 一條診斷。 */
  | 'runtime'
  /** 形式核：型別檢查器，全稱。 */
  | 'formal'
  /** 🔴 人。**寫明，不留白**——「這顆積木好懂」的判定者就是這個。 */
  | 'human'

export const JUDGE_KINDS: readonly JudgeKind[] = [
  'grammar', 'renderer', 'equality', 'reference', 'runtime', 'formal', 'human',
]

export function isJudgeKind(x: unknown): x is JudgeKind {
  return typeof x === 'string' && (JUDGE_KINDS as readonly string[]).includes(x)
}

/**
 * 六路。**`FIVE_PATHS` 不動**——它是完備性護欄的母體，
 * 而 347 顆元件沒有 `formalize`，把它加進去會讓那條護欄一夜之間紅 347 筆。
 *
 * > **一條護欄的母體變大，讀數會變差，而那與「品質下降」長得一樣。**
 */
export type SixPath = FivePath | 'formalize'
export const SIX_PATHS: readonly SixPath[] = [...FIVE_PATHS, 'formalize']

/**
 * 每一路的**預設判定者**，以及**它今天在哪裡跑**。
 *
 * 🔴 **`evidence` 不是裝飾**：它讓「判定者已經在跑」這句話可以被機械檢查
 * （第一刀的判準逐字是「把**既有的**判定者接上去，不是加一個新欄位」）。
 * 護欄會驗那個檔存不存在——⚠️ 而它**不驗那個檔真的在判這一路**，
 * 那需要人讀，而本檔不假裝它做得到。
 *
 * ⚠️ **預設不是每顆元件各寫一份**：`generate` 的判定者對 349 顆都是同一個。
 * 逐顆寫等於造 349 份雙重真相。**per-元件只在它【不同】的時候才寫。**
 */
export const PATH_JUDGE: Readonly<Record<SixPath, {
  kind: JudgeKind | null
  evidence: string
  /** 🔴 **它判的【是什麼】——這一句是人讀出來的**，而下一個人可以拿它否證我。 */
  judges: string
  /** 逐元件的覆蓋率。`null` ＝ **沒有人量過**（棘輪數的就是它）。 */
  coverage: { covered: number; of: number } | null
}>> = {
  lift: {
    kind: 'equality',
    evidence: 'tests/integration/full-roundtrip.test.ts',
    judges: '29 個【手寫】案例的 code → 語義樹 → code 回到原文。🔴 **沒有逐元件的檢查**。',
    coverage: null,
  },
  generate: {
    kind: 'grammar',
    evidence: 'tests/integration/roundtrip-all.test.ts',
    judges: '「Code generation coverage」。⚠️ **而它的標題說謊**：`if (!spec.codeTemplate?.pattern) continue`'
      + ' —— 走【手寫產生器】的那些整批跳過，而那正是最可能出錯的一批。',
    coverage: { covered: 99, of: 349 },
  },
  render: {
    kind: 'renderer',
    evidence: 'tests/integration/roundtrip-all.test.ts',
    judges: '「Render coverage」：每一顆渲染成它宣告的積木型別。',
    coverage: { covered: 345, of: 349 },
  },
  extract: {
    kind: 'equality',
    evidence: 'tests/integration/roundtrip-all.test.ts',
    judges: '「Extract coverage」：每一顆積木抽回它自己的身分。',
    coverage: { covered: 345, of: 349 },
  },
  execute: {
    kind: 'reference',
    evidence: 'tests/integration/interpreter-matches-compiler.test.ts',
    judges: '跟參照編譯器對答案（語料驅動，不是逐元件）。',
    coverage: { covered: 125, of: 210 },
  },
  formalize: {
    kind: 'formal',
    evidence: 'tests/probes/cella-formalize-guard.test.ts',
    judges: '形式核載得進 cella，而洞的型別逐字是缺的那段契約。',
    coverage: { covered: 2, of: 2 },
  },
}

/** 一顆元件在某一路上的判定者——**per-元件覆蓋優先，否則吃該路的預設**。 */
export function judgeOf(
  path: SixPath,
  postconditions?: Record<string, { judge?: unknown } | undefined>,
): JudgeKind | null {
  const own = postconditions?.[path]?.judge
  if (isJudgeKind(own)) return own
  if (own === null) return null
  return PATH_JUDGE[path]?.kind ?? null
}
