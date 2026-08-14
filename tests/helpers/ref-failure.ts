/**
 * **參照那一側為什麼跑不動——而這有兩種完全不同的意思。**
 *
 * ```
 * toolCannotRun      工具跑不動      缺標頭、環境問題   → 【我們的量測機構】的極限
 * programIsIllegal    程式不合法      編譯器看懂了而且拒絕 → 🔴 我們接受了 C++ 拒絕的程式
 * unclassified        判不出來        訊息對不上任一判準   → 不計入任一邊
 * ```
 *
 * ⚠️ **第三類不可省**（`build-guardrail` 第 5 步）：判不出來就說判不出來，
 * 而且**不計入安全**——為了讓數字好看而樂觀歸類，比沒有分類更糟。
 *
 * ⚠️ 判準是**靜態的**（讀編譯器訊息），所以它**先在已知答案的樣本上驗過**
 * 才拿去跑真實語料（第 6 步）。見下方三支測試。
 */
export type refFailClass = 'toolCannotRun' | 'programIsIllegal' | 'unclassified'

/** 「找不到某個東西」——那是**環境**，不是程式。 */
const TOOL_PATTERNS = [
  'file not found',
  'no such file',
  'command not found',
  'cannot find',
  'unsupported option',
  'ld: library not found',
]

/** 編譯器**看懂了而且拒絕**——那是程式的問題。 */
const ILLEGAL_PATTERNS = [
  'expected',
  'undeclared',
  'was not declared',
  'no member named',
  'no matching function',
  'cannot convert',
  'invalid operands',
  'redefinition',
  'too few arguments',
  'too many arguments',
  'is not a member',
]

/**
 * 分類一則參照失敗。**吃字串不吃檔案**——注入才餵得進來。
 *
 * ⚠️ 順序有意義：先看「工具跑不動」。一段缺標頭的程式**也會**產生
 * 一堆 `expected`／`undeclared`（因為型別全都不見了），
 * 而那時真正的原因是缺標頭。**先判環境，再判程式。**
 */
export function classifyRefFailure(stage: string | undefined, message: string): refFailClass {
  const m = message.toLowerCase()
  if (TOOL_PATTERNS.some((p) => m.includes(p))) return 'toolCannotRun'
  if (ILLEGAL_PATTERNS.some((p) => m.includes(p))) return 'programIsIllegal'
  if (stage === 'run') return 'toolCannotRun'
  return 'unclassified'
}
