/**
 * **解析器沒指名缺口時，語言那側的推論**（2026-11-06，漏分號提示）。
 *
 * tree-sitter 在某些形狀會補出 MISSING「;」（下一行是宣告、return、`}`），那時我們說得出「這裡少了一個 `;`」；
 * 而下一行是 cout、cin、賦值、呼叫函式時它只給 ERROR——學生看到的是「這一行的語法不完整」，看不出是少了分號。
 *
 * core 不知道怎麼重新剖析（那是語言的事——`languages/cpp/lang/missing-semicolon.ts`），所以這裡只是一個登記處。
 * 🔴 判準是**量得到**：補上之後那一段的錯誤要真的消失才回報，而且回報的是 `likely`（「可能」）。
 *    量不到就什麼都不加——守住 `syntax-gap` 那幾支「不亂猜」。
 */
import type { SyntaxGap } from '../diagnostics'
import type { AstNode } from './types'

type Inferer = (node: AstNode) => SyntaxGap[]
const INFERERS: Inferer[] = []

export function registerSyntaxGapInference(fn: Inferer): void {
  if (!INFERERS.includes(fn)) INFERERS.push(fn)
}

/** 第一個推得出東西的語言說了算；都推不出就是空的。 */
export function inferSyntaxGaps(node: AstNode): SyntaxGap[] {
  for (const f of INFERERS) {
    const g = f(node)
    if (g.length > 0) return g
  }
  return []
}

/**
 * **確定的推論**（量得到、不是猜）——排在解析器指名的缺口**之前**（2026-11-07）。
 * 解析器的錯誤恢復會隨手補一個 token（`...`），那時它「指名」的缺口反而誤導；一個量得到的更好的說法要先說。
 * 例：「這一行寫在函式外面」（`languages/cpp/lang/statement-outside-function.ts`）。
 */
const PRECISE: Inferer[] = []

export function registerPreciseSyntaxGapInference(fn: Inferer): void {
  if (!PRECISE.includes(fn)) PRECISE.push(fn)
}

export function inferPreciseSyntaxGaps(node: AstNode): SyntaxGap[] {
  for (const f of PRECISE) {
    const g = f(node)
    if (g.length > 0) return g
  }
  return []
}
