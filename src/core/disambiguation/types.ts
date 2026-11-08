/**
 * 規格消歧（spec 218）的型別——**核心：不認得任何一種情境、不碰 DOM、不碰檔案系統、不認得任何提供者**。
 *
 * 一份題目可以有多種合理的讀法（解讀）；每個解讀一份參考解答。系統產生一批情境（輸入），把學生的程式與每份解答都交給判決，
 * 回報學生的程式和哪幾個解讀一致、和其餘的第一次不一致在哪裡。分工：候選＝操作者；成不成立＝判決提供者；並排與點選＝semorphe；定題意與紀錄＝cos-mos。
 */
import type { SemanticNode } from '../types'

/** 一份題目的一種讀法 */
export interface Interpretation {
  id: string
  label: string
}

/**
 * 一次執行的輸入。`kind` 由領域套件登記（C 的標準輸入、Arduino 的時間序列輸入……），**核心只當它是一把不透明的鍵**；
 * `payload` 的形狀由那個種類自己定。`label` 是給人看的一句（「空輸入」「第 300 ms 按下按鈕」）。
 */
export interface Scenario {
  kind: string
  payload: unknown
  label: string
}

/** 判決的結果（只取比對要的那幾格） */
export interface RunOutcome {
  verdict: 'accept' | 'reject' | 'unknown' | 'untranslated' | 'pending'
  /** 印出來的（accept／unknown 時有意義） */
  out: string
  /** 板子的最後狀態（腳位 → 值），Arduino 情境才有 */
  board?: Record<string, number>
  problems: { kind: string; reason?: string }[]
}

/** 判決由呼叫端注入——瀏覽器包 Cella 的 worker、Node 的批次與測試各自包自己的 */
export type Judge = (tree: SemanticNode, scenario: Scenario) => Promise<RunOutcome>

export interface Mismatch {
  scenario: Scenario
  student: RunOutcome
  reference: RunOutcome
}

export interface Incomparable {
  scenario: Scenario
  side: 'student' | 'reference'
  verdict: RunOutcome['verdict']
  reason: string
}

export interface InterpretationResult {
  id: string
  label: string
  /** consistent：全部可比情境都相同；inconsistent：有一個不同（附第一個）；incomparable：一個可比的情境都沒有 */
  status: 'consistent' | 'inconsistent' | 'incomparable'
  firstMismatch?: Mismatch
  incomparable: Incomparable[]
}

export interface ComparisonResult {
  results: InterpretationResult[]
  /** 在這批情境下彼此輸出完全相同的解讀群（兩個以上才列）——「這批情境分不出這幾種讀法」 */
  indistinguishable: string[][]
  scenarios: Scenario[]
}
