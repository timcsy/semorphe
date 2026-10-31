/**
 * **Cella 的除錯模組**（spec 183）——`cella-lang/dap` 的工作階段要的那一組匯出，一個分支一個模組。
 *
 * 原始碼照 `cella-lang` README〈Running a program step by step〉逐字（每一行包一個 `<分支>.*` 的除錯入口）；
 * 板子上的程式多 `setInput` 與 `clockMs`（腳位是 5c 的事，這裡先匯出，不接）。
 * ⚠️ 與判決模組一樣：編好的位元組不需要 Cella 執行環境，可以存起來（`cache.ts`，鍵帶模組原始碼）。
 */
import type { CellaBranch, CellaRead } from './verdict'
import { loadCellaPackages } from './verdict'

export function debuggerSource(b: CellaBranch): string {
  const lines = [
    'import cfamily.syntax',
    `import ${b}`,
    `def load (source : String) : ${b}.Session := ${b}.load source`,
    `def run (kind : Nat) (breakpoints : String) (closed : Nat) (fuel : Nat) (x : ${b}.Session) : ${b}.Stopping := ${b}.run kind breakpoints closed fuel x`,
    `def stopConf (x : ${b}.Session) (s : ${b}.Stopping) : ${b}.Session := ${b}.stopConf x s`,
    `def stopKind (s : ${b}.Stopping) : Nat := ${b}.stopKind s`,
    `def stopNode (s : ${b}.Stopping) : String := ${b}.stopNode s`,
    `def stopOut (s : ${b}.Stopping) : String := ${b}.stopOut s`,
    `def stopErr (s : ${b}.Stopping) : String := ${b}.stopErr s`,
    `def stopDetail (s : ${b}.Stopping) : String := ${b}.stopDetail s`,
    `def divergences (s : ${b}.Stopping) : String := ${b}.divergences s`,
    `def feed (text : String) (x : ${b}.Session) : ${b}.Session := ${b}.feed text x`,
    `def globals (x : ${b}.Session) : String := ${b}.globals x`,
    `def frames (at : String) (x : ${b}.Session) : String := ${b}.frames at x`,
    `def setVarErr (n : Nat) (x : cfamily.DeclId) (text : String) (s : ${b}.Session) : String := ${b}.setVarErr n x text s`,
    `def setVarConf (n : Nat) (x : cfamily.DeclId) (text : String) (s : ${b}.Session) : ${b}.Session := ${b}.setVarConf n x text s`,
    `def env (x : ${b}.Session) : String := ${b}.env x`,
    // 板子上的程式多兩個（spec 185）：暫停時改感測器輸入、模擬時鐘（`cella-lang/dap` 的 `setInput`／`inputScript` 用到）
    ...(b === 'arduino' ? [
      'def setInput (key : String) (value : String) (x : arduino.Session) : arduino.Session := arduino.setInput key value x',
      'def clockMs (x : arduino.Session) : Nat := arduino.clockMs x',
    ] : []),
  ]
  return lines.join('\n') + '\n'
}

export const DEBUGGER_EXPORTS = ['load', 'run', 'stopConf', 'stopKind', 'stopNode', 'stopOut', 'stopErr', 'stopDetail', 'divergences', 'feed', 'globals', 'frames', 'setVarErr', 'setVarConf', 'env']
const exportsOf = (b: CellaBranch): string[] => (b === 'arduino' ? [...DEBUGGER_EXPORTS, 'setInput', 'clockMs'] : DEBUGGER_EXPORTS)

/** 編一個分支的除錯模組（約 20 秒）。 */
export async function compileCellaDebugger(read: CellaRead, b: CellaBranch): Promise<Uint8Array> {
  const cella = await loadCellaPackages(read)
  return cella.compile_wasm_library(debuggerSource(b), exportsOf(b).join(','))
}
