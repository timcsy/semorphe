/**
 * **Cella 的除錯模組**（spec 183）——`cella-lang/dap` 的工作階段要的那一組匯出，一個分支一個模組。
 *
 * 原始碼照 `cella-lang` README〈Running a program step by step〉逐字（每一行包一個 `<分支>.*` 的除錯入口）；
 * 板子上的程式多 `setInput` 與 `clockMs`（腳位是 5c 的事，這裡先匯出，不接）。
 * ⚠️ 與判決模組一樣：編好的位元組不需要 Cella 執行環境，可以存起來（`cache.ts`，鍵帶模組原始碼）。
 */
import type { CellaBranch, CellaRead } from './verdict'
import { loadCellaPackages } from './verdict'

/**
 * **Python 的除錯模組**（spec 195b）——`python.session` 的匯出（`@cella-lang/python` README〈Entries〉）。
 * 與 C 家族的差別：變數的 id 是字串（不是 `cfamily.DeclId`）、沒有 `divergences`。
 */
function pythonDebuggerSource(): string {
  const S = 'python.session.Session'
  const T = 'python.session.Stopping'
  return [
    'import python.session',
    `def load(source: String) -> ${S} { python.session.load(source) }`,
    `def run(kind: Nat, breakpoints: String, closed: Nat, fuel: Nat, x: ${S}) -> ${T} { python.session.run(kind, breakpoints, closed, fuel, x) }`,
    `def stopConf(x: ${S}, s: ${T}) -> ${S} { python.session.stopConf(x, s) }`,
    `def stopKind(s: ${T}) -> Nat { python.session.stopKind(s) }`,
    `def stopNode(s: ${T}) -> String { python.session.stopNode(s) }`,
    `def stopOut(s: ${T}) -> String { python.session.stopOut(s) }`,
    `def stopErr(s: ${T}) -> String { python.session.stopErr(s) }`,
    `def stopDetail(s: ${T}) -> String { python.session.stopDetail(s) }`,
    `def stopVisits(s: ${T}) -> String { python.session.stopVisits(s) }`,
    `def feed(text: String, x: ${S}) -> ${S} { python.session.feed(text, x) }`,
    `def globals(x: ${S}) -> String { python.session.globals(x) }`,
    `def frames(at: String, x: ${S}) -> String { python.session.frames(at, x) }`,
    `def setVarErr(n: Nat, id: String, text: String, x: ${S}) -> String { python.session.setVarErr(n, id, text, x) }`,
    `def setVarConf(n: Nat, id: String, text: String, x: ${S}) -> ${S} { python.session.setVarConf(n, id, text, x) }`,
    `def env(x: ${S}) -> String { python.session.env(x) }`,
  ].join('\n') + '\n'
}

export function debuggerSource(b: CellaBranch): string {
  if (b === 'python') return pythonDebuggerSource()
  const lines = [
    'import cfamily.syntax',
    `import ${b}`,
    `def load(source: String) -> ${b}.Session { ${b}.load(source) }`,
    `def run(kind: Nat, breakpoints: String, closed: Nat, fuel: Nat, x: ${b}.Session) -> ${b}.Stopping { ${b}.run(kind, breakpoints, closed, fuel, x) }`,
    `def stopConf(x: ${b}.Session, s: ${b}.Stopping) -> ${b}.Session { ${b}.stopConf(x, s) }`,
    `def stopKind(s: ${b}.Stopping) -> Nat { ${b}.stopKind(s) }`,
    `def stopNode(s: ${b}.Stopping) -> String { ${b}.stopNode(s) }`,
    `def stopOut(s: ${b}.Stopping) -> String { ${b}.stopOut(s) }`,
    `def stopErr(s: ${b}.Stopping) -> String { ${b}.stopErr(s) }`,
    `def stopDetail(s: ${b}.Stopping) -> String { ${b}.stopDetail(s) }`,
    `def divergences(s: ${b}.Stopping) -> String { ${b}.divergences(s) }`,
    // 每個節點進入幾次（cella 0.1.202610312349 起；`cella-lang/dap` 有這個匯出才給 `coverage()`）
    `def stopVisits(s: ${b}.Stopping) -> String { ${b}.stopVisits(s) }`,
    `def feed(text: String, x: ${b}.Session) -> ${b}.Session { ${b}.feed(text, x) }`,
    `def globals(x: ${b}.Session) -> String { ${b}.globals(x) }`,
    `def frames(at: String, x: ${b}.Session) -> String { ${b}.frames(at, x) }`,
    `def setVarErr(n: Nat, x: cfamily.DeclId, text: String, s: ${b}.Session) -> String { ${b}.setVarErr(n, x, text, s) }`,
    `def setVarConf(n: Nat, x: cfamily.DeclId, text: String, s: ${b}.Session) -> ${b}.Session { ${b}.setVarConf(n, x, text, s) }`,
    `def env(x: ${b}.Session) -> String { ${b}.env(x) }`,
    // 板子上的程式多兩個（spec 185）：暫停時改感測器輸入、模擬時鐘（`cella-lang/dap` 的 `setInput`／`inputScript` 用到）
    ...(b === 'arduino' ? [
      'def setInput(key: String, value: String, x: arduino.Session) -> arduino.Session { arduino.setInput(key, value, x) }',
      'def clockMs(x: arduino.Session) -> Nat { arduino.clockMs(x) }',
    ] : []),
  ]
  return lines.join('\n') + '\n'
}

export const DEBUGGER_EXPORTS = ['load', 'run', 'stopConf', 'stopKind', 'stopNode', 'stopOut', 'stopErr', 'stopDetail', 'divergences', 'stopVisits', 'feed', 'globals', 'frames', 'setVarErr', 'setVarConf', 'env']
const exportsOf = (b: CellaBranch): string[] =>
  b === 'arduino' ? [...DEBUGGER_EXPORTS, 'setInput', 'clockMs']
    : b === 'python' ? DEBUGGER_EXPORTS.filter((e) => e !== 'divergences')
      : DEBUGGER_EXPORTS

/** 編一個分支的除錯模組（約 20 秒）。 */
export async function compileCellaDebugger(read: CellaRead, b: CellaBranch): Promise<Uint8Array> {
  // 只載這個分支要的套件（spec 197c：C 的除錯不必載 Python）
  const cella = await loadCellaPackages(read, [b])
  return cella.compile_wasm_library(debuggerSource(b), exportsOf(b).join(','))
}
