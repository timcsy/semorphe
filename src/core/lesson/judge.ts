/**
 * **判題用哪一份輸出**（spec 200，重構階段 6b；設計 draft 五之一）。
 *
 * 判題原本是「跑一次、比 stdout」——比的是學生**這一次執行**印出來的東西。兩個問題：
 *
 * ```
 * 輸入是學生自己打的     打的不是題目的測資，就算程式對了也比不上
 * 輸出對、但有未定義行為  越界讀到剛好是對的值——在這台機器上通過，換一台就不一定
 * ```
 *
 * Cella 的判決兩個都解：它用**題目宣告的測資**（`check.stdin`）跑同一棵樹，同時給 `out` 與 `problems`。
 * 所以判題先問判決；判決給不出結果（還沒載好、判不出來、程式要讀輸入而題目沒給）才退回這一次執行的輸出，
 * **並說出用的是哪一份**——兩條路判出來的意思不同，學生要知道（P6：降級必須可見）。
 *
 * 🪦 階段 6c 拆掉 JS 直譯器之後，「這一次執行的輸出」仍然在（執行改由 Cella 跑）；退回的路留著。
 */
import type { Verdict } from '../verdict-diagnostics'
import { compareOutput, type OutputComparison } from './lesson'

export type JudgeSource =
  /** 判決：用題目的測資跑、沒有發現問題 */
  | 'verdict'
  /** 判決：發現未定義行為——不論輸出，不算通過 */
  | 'verdict-reject'
  /** 這一次執行的輸出（判決不在、判不出來、或沒有測資可餵） */
  | 'run'

export interface JudgeResult {
  comparison: OutputComparison
  source: JudgeSource
  /** 未定義行為的種類（`verdict-reject` 才有）；退回 `run` 時是退回的原因 */
  why?: string
}

export function judgeOutput(input: {
  /** 同一棵樹、題目測資的判決；`null` ＝ 判決不在（沒有提供者、還沒載好） */
  verdict: Verdict | null
  /** 程式會讀標準輸入 */
  readsInput: boolean
  /** 題目有宣告測資 */
  hasStdin: boolean
  /** 這一次執行印出來的（只有 stdout） */
  transcript: string
  want: string
}): JudgeResult {
  const { verdict, readsInput, hasStdin, transcript, want } = input
  const run = (why: string): JudgeResult => ({ comparison: compareOutput(transcript, want), source: 'run', why })
  if (!verdict) return run('判斷功能還沒載好')
  // 程式要讀輸入、題目卻沒給測資：判決吃到的是空輸入，輸出不代表學生的程式——用他自己這一次的
  if (readsInput && !hasStdin) return run('這一題沒有宣告測資')
  if (verdict.verdict === 'reject') {
    const kinds = [...new Set(verdict.problems.map((p) => p.kind).filter((k) => k !== 'hole'))]
    return { comparison: { passed: false, lines: compareOutput(verdict.out, want).lines }, source: 'verdict-reject', why: kinds.join('、') }
  }
  if (verdict.verdict !== 'accept') return run('判斷判不出這支程式')
  return { comparison: compareOutput(verdict.out, want), source: 'verdict' }
}
