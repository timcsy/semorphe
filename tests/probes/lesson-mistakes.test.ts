/**
 * **探測（不是護欄）**：第一課的學生犯錯時，畫面上實際出現什麼。
 *
 * ## 為什麼是探測而不是護欄
 *
 * 它量的是**兩件混在一起的事**——「這種錯有沒有被擋下」與「擋不下時說什麼」
 * ——而只有後者有硬性判準（第四十四條護欄守著）。
 * 前者**沒有目標值**：⚠️ `Cout` 大小寫錯**放行是對的**（那不是語法錯誤，
 * 語法上完全合法），該由階段 6.6 ⑤／6.7 的型別資訊處理。
 *
 * > **一個沒有目標值的量，做成護欄就會逼人去湊一個目標。**
 *
 * 所以這裡沒有棘輪：靠**看報表**推動。
 *
 * ## ⚠️ 自我否證
 *
 * **如果樣本數斷言變紅，代表語料沒進來，這份報表不算數**
 * ——錨在**樣本數**（合成量）上，🔴 不錨在「幾種被擋下」：後者正是會變動的東西。
 *
 * ## 🔴 而第一版有一欄不算數，那個教訓留在這裡
 *
 * 第一版還印了「參照編譯器怎麼說」。**它連對照組（正確的程式）都編不過**
 * ——探針餵的是原始碼，沒有走系統的 auto-include。
 * 那一欄**推導不出任何結論**，已移除。
 * （`build-guardrail` 6.5：「紅的是世界，還是語料？」）
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測錯誤訊息的措辭好不好**——沒有機械判準
 * - **不檢測「應該被擋下的都被擋下了」**——那個集合today沒有定義
 * - **不檢測積木側**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { canExecute } from '../../src/core/diagnostics'
import { RuntimeError } from '../../src/interpreter/errors'
import { setMessages, resetMessages } from '../../src/i18n/messages'
import { describeRuntimeStop } from '../../src/ui/runtime-message'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

/** 第一課的成品。所有樣本都是它的變異。 */
const OK = `int main() {
    cout << "Hello!" << endl;
    return 0;
}`

/**
 * 九種第一課的學生真的會犯的錯。
 *
 * ⚠️ **④⑤⑨ 是中文使用者的典型錯誤**（輸入法沒切回半形），
 * 而這個專案在 2026-08-15 之前**一次都沒有測過它們**。
 */
const MISTAKES: Record<string, string> = {
  '對照（正確）': OK,
  '① cout 那行漏分號': OK.replace('endl;', 'endl'),
  '② return 0 漏分號': OK.replace('return 0;', 'return 0'),
  '③ 漏右大括號': OK.slice(0, -1),
  '④ 全形分號 ；': OK.replace('endl;', 'endl；'),
  '⑤ 全形引號 “”': OK.replace('"Hello!"', '“Hello!”'),
  '⑥ 引號沒關': OK.replace('"Hello!"', '"Hello!'),
  '⑦ cout 寫成 Cout': OK.replace('cout', 'Cout'),
  '⑧ << 寫成 <': OK.replace('cout <<', 'cout <'),
  '⑨ 全形括號 （）': OK.replace('main()', 'main（）'),
}

describe('探測：第一課的學生犯錯時看到什麼', () => {
  it('逐條', async () => {
    // ★ 入口條件——錨在**樣本數**（合成量），見檔頭的自我否證
    expect(
      Object.keys(MISTAKES).length,
      '樣本沒進來，這份報表不算數——不是「錯誤都被修好了」',
    ).toBeGreaterThan(5)

    setMessages(zhTW as Record<string, string>)
    const rows: string[] = []
    for (const [label, src] of Object.entries(MISTAKES)) {
      const st = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
      const gate = canExecute(st)
      let shown = '🟢 語法閘門擋下'
      if (gate.ok) {
        const i = new SemanticInterpreter({ maxSteps: 100000 })
        try {
          await i.execute(st)
          shown = `跑完，輸出 ${JSON.stringify(i.getOutput().join(''))}`
        } catch (e) {
          shown =
            e instanceof RuntimeError
              ? `🔴 停下來：「${describeRuntimeStop(e.i18nKey, e.params)}」`
              : `✘ ${String(e).slice(0, 60)}`
        }
      }
      rows.push(`${label.padEnd(18)} | ${shown}`)
    }
    resetMessages()
    console.log('\n' + rows.join('\n') + '\n')

    // 🔴 唯一的硬斷言：**畫面上不得出現代號**。
    // 「幾種被擋下」刻意不斷言——它沒有目標值（見檔頭）。
    for (const row of rows) {
      expect(row, `🔴 代號跑到畫面上了：${row}`).not.toMatch(/RUNTIME_ERR_|%\d|\{"/)
    }
  }, 180000)
})
