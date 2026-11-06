/**
 * **錯誤訊息的例句清單**（〈錯誤訊息看得懂、改得動〉驗收第一條）
 *
 * 護欄量得到「有沒有文案」「帶不帶原文」，量不到「看不看得懂」——那要**人看全貌**。
 * 這支拿一組最小的程式交給真的 Cella，走產品同一條 `toDiagnostics`，把學生看到的字產生成一頁：
 * `assets/error-messages/例句.md`（積木那一句、程式碼那一句、詳細資訊，以及點開才看到的「為什麼／試試看」）。
 *
 * 🔴 平常是**比對**：文案或判決改了、那一頁沒跟著重產 → 紅。看過新的那一頁、確認是想要的，才重產：
 *
 * ```
 * SEMORPHE_UPDATE_ERROR_EXAMPLES=1 npx vitest run tests/integration/error-message-examples.test.ts
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runCella } from '../helpers/cella-run'
import { toDiagnostics, type Verdict } from '../../src/core/verdict-diagnostics'
import { diagnosticText, diagnosticParams, codeDiagnosticDetail, diagnosticLayers } from '../../src/core/projection/diagnostic-projection'
import { generateExpressionCode } from '../../src/core/projection/code-generator'
import { setMessages, resetMessages } from '../../src/i18n/messages'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import '../../src/languages/cpp/pack'
import { languagePack } from '../../src/core/language-packs'
import type { StylePreset } from '../../src/core/types'

const PAGE = path.resolve(__dirname, '../../assets/error-messages/例句.md')

/** 一種錯誤一支最小的程式。名稱是學生的說法，不是規則的代號。 */
const EXAMPLES: [string, string][] = [
  ['用到還沒有值的變數', 'int main() {\n    int total;\n    cout << total;\n}'],
  ['除以零', 'int main() {\n    int a = 0;\n    cout << 10 / a;\n}'],
  ['陣列越界', 'int main() {\n    int a[3];\n    a[5] = 1;\n}'],
  ['差一：用到最後一格的下一格', 'int main() {\n    int a[3];\n    a[3] = 1;\n}'],
  ['整數溢位', 'int main() {\n    int x = 2147483647;\n    x = x + 1;\n    cout << x;\n}'],
  ['找不到名字', 'int main() {\n    cout << score;\n}'],
  ['名字打錯（有長得很像的）', 'int main() {\n    int total = 1;\n    cout << totl;\n}'],
  ['大小寫打錯', 'int main() {\n    Cout << 1;\n}'],
  ['串流配錯運算子', 'int main() {\n    int x;\n    cin < x;\n}'],
  ['等號左邊不是變數', 'int main() {\n    int a = 1, b = 2;\n    a + b = 3;\n}'],
  ['呼叫時引數不合', 'int f(int x) {\n    return x;\n}\nint main() {\n    f(1, 2);\n}'],
  ['重複宣告', 'int main() {\n    int a = 1;\n    int a = 2;\n}'],
  ['回傳值不合', 'void f() {\n    return 1;\n}\nint main() {\n    f();\n}'],
  ['運算元型別不合', 'int main() {\n    string s = "a";\n    int x = s * 2;\n}'],
  ['型別轉不過去', 'int main() {\n    int x = "abc";\n}'],
  ['函式少了 return', 'int twice(int x) {\n    int y = x * 2;\n}\nint main() {\n    twice(3);\n}'],
  ['跑太久（可能是無窮迴圈）', 'int main() {\n    while (true) {\n    }\n}'],
]

const S = apcs as unknown as StylePreset
let page = ''

async function render(): Promise<string> {
  const pack = languagePack('cpp')
  const rows: string[] = []
  for (const [name, code] of EXAMPLES) {
    const r = await runCella(code, { style: 'apcs' })
    const { diagnostics, notes } = r.raw
      ? toDiagnostics({
          verdict: r.raw as unknown as Verdict, types: null, tree: r.tree, readsInput: false, hasStdin: false,
          knownNames: pack?.wellKnownNames, streamOperators: pack?.streamOperators,
          codeOf: (n) => generateExpressionCode(n, 'cpp', S),
        })
      : { diagnostics: [], notes: [] as string[] }
    rows.push(`## ${name}`, '', '```cpp', code, '```', '', `判決：\`${r.verdict}\``, '')
    if (diagnostics.length === 0) rows.push(`- （沒有標示）${notes.length ? `｜說明：${notes.join('；')}` : ''}`)
    for (const d of diagnostics) {
      const p = diagnosticParams(d.params)
      const detail = codeDiagnosticDetail(d)
      rows.push(`- 積木：${diagnosticText(d.rule, 'BLOCK', p)}`)
      rows.push(`- 程式碼：${diagnosticText(d.rule, 'CODE', p)}${detail ? `｜詳細資訊：${detail}` : ''}`)
      for (const l of diagnosticLayers(d.rule, p)) rows.push(`  - ${l}`)
    }
    rows.push('')
  }
  return [
    '# 錯誤訊息的例句', '',
    '> 由 `tests/integration/error-message-examples.test.ts` 產生——不要手改。每一種錯誤一支最小的程式，交給真的 Cella 判，',
    '> 走產品同一條路（`toDiagnostics` → 兩側的文案），印出學生看到的字。改了文案或升了 Cella，這一頁會跟著變——看過再重產。', '',
    ...rows,
  ].join('\n')
}

beforeAll(async () => {
  resetMessages()
  setMessages(zhTW as Record<string, string>)
  page = await render()
}, 300_000)

describe('錯誤訊息的例句清單', () => {
  it('入口條件：多數例子判得出來（不是全部翻不出）', () => {
    expect((page.match(/判決：`untranslated`/g) ?? []).length, page).toBeLessThan(EXAMPLES.length / 3)
  })

  it('🔴 那一頁與現在的文案一致（不一致：看過新的，再用 SEMORPHE_UPDATE_ERROR_EXAMPLES=1 重產）', () => {
    if (process.env.SEMORPHE_UPDATE_ERROR_EXAMPLES === '1') {
      fs.mkdirSync(path.dirname(PAGE), { recursive: true })
      fs.writeFileSync(PAGE, page + '\n')
    }
    const committed = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : ''
    expect(committed, '例句頁過期了——文案或判決改了').toBe(page + '\n')
  })

  it('🔴 學生看到的字裡沒有代號、沒有沒填上的格', () => {
    expect(page).not.toMatch(/DIAG_|RUNTIME_ERR_|\{\w+\}/)
  })
})
