/**
 * 面板的運算式產生：切換前後一字不差（060 契約）
 *
 * ## 這支測試在防什麼
 *
 * 面板原本有一套**自己的**節點→程式碼轉換（`simpleExpressionToCode` 裡的
 * switch）。060 把它刪掉，改呼叫系統唯一的那套。
 *
 * 這是純替換，所以每一個字元都必須相同。而風險特別高的原因是：
 * **那條路是降級路徑**——正常的抽取失敗才會走到它。平常跑不到的程式碼，
 * 改壞了不會有人發現。
 *
 * ## 為什麼把期望值寫死，而不是比對兩個實作
 *
 * 「比對兩個實作」在刪掉其中一個之後就沒得比了。期望值寫死在這裡，是**切換
 * 之前**從舊實作拍下來的——它記錄的是一次歷史事實，不是一個可重算的值。
 *
 * 不用 vitest snapshot 的理由見 `knowledge/skills/build-guardrail`：`-u` 會
 * 靜默更新，等於「跑一下就自動接受惡化」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateExpressionCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode } from '../../src/core/types'

const n = (
  concept: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ conceptId: concept, properties, children }) as unknown as SemanticNode

beforeAll(() => {
  registerCppLanguage()
})

/**
 * 舊 switch 涵蓋的**每一種** case，以及它在切換前產出的文字。
 *
 * 逐一對照 `blockly-panel.ts` 切換前的 `simpleExpressionToCode`——
 * 漏一個 case，那個 case 的漂移就不會被抓到。
 */
const outputBeforeSwitch: [string, SemanticNode, string][] = [
  ['cpp:literal_number', n('cpp:literal_number', { value: 5 }), '5'],
  ['cpp:literal_string', n('cpp:literal_string', { value: 'hi' }), '"hi"'],
  ['cpp:var_ref', n('cpp:var_ref', { name: 'x' }), 'x'],
  [
    'cpp:arithmetic',
    n('cpp:arithmetic', { operator: '+' }, { left: [n('cpp:var_ref', { name: 'a' })], right: [n('cpp:literal_number', { value: 1 })] }),
    'a + 1',
  ],
  [
    'cpp:compare',
    n('cpp:compare', { operator: '<' }, { left: [n('cpp:var_ref', { name: 'a' })], right: [n('cpp:literal_number', { value: 3 })] }),
    'a < 3',
  ],
  [
    'cpp:logic_not',
    n('cpp:logic_not', {}, { operand: [n('cpp:var_ref', { name: 'f' })] }),
    '!f',
  ],
  [
    'cpp:negate',
    n('cpp:negate', { operator: '-' }, { value: [n('cpp:var_ref', { name: 'v' })] }),
    '-v',
  ],
  [
    'cpp:func_call',
    n('cpp:func_call', { name: 'g' }, { args: [n('cpp:literal_number', { value: 2 }), n('cpp:var_ref', { name: 'y' })] }),
    'g(2, y)',
  ],
  [
    'cpp:array_at',
    n('cpp:array_at', { obj: 'arr' }, { index: [n('cpp:literal_number', { value: 1 })] }),
    'arr[1]',
  ],
  // ── 以下是語言專屬的，正是中立性報的那六筆
  [
    'cpp:string_at',
    n('cpp:string_at', { obj: 's' }, { index: [n('cpp:literal_number', { value: 0 })] }),
    's[0]',
  ],
  [
    'cpp:increment',
    n('cpp:increment', { name: 'i', operator: '++', position: 'postfix' }),
    'i++',
  ],
  [
    'cpp:ternary',
    n(
      'cpp:ternary',
      {},
      {
        condition: [n('cpp:var_ref', { name: 'c' })],
        true_expr: [n('cpp:literal_number', { value: 1 })],
        false_expr: [n('cpp:literal_number', { value: 2 })],
      },
    ),
    'c ? 1 : 2',
  ],
  ['cpp:cast', n('cpp:cast', { target_type: 'int' }, { value: [n('cpp:var_ref', { name: 'd' })] }), '(int)d'],
  ['cpp:builtin_constant', n('cpp:builtin_constant', { value: 'INT_MAX' }), 'INT_MAX'],
  // ⚠️ 舊 switch 寫的是 `case 'char_literal':`，而**那個概念不存在**——
  // 真正的概念是 `cpp_char_literal`。那是一個永遠不會觸發的死分支。
  //
  // **平行機制已經漂移過了，而沒有人發現。** 這正是 060 要治的病：
  // 兩套實作沒有任何東西在檢查它們一致，其中一套指向一個不存在的概念，
  // 測試照樣全綠。
  ['cpp:literal_char', n('cpp:literal_char', { value: 'a' }), "'a'"],
]

describe('面板的運算式產生：切換前後一字不差', () => {
  for (const [name, node, expected] of outputBeforeSwitch) {
    it(`${name} → ${expected}`, () => {
      expect(
        generateExpressionCode(node, 'cpp', 'apcs' as never),
        `舊 switch 產出 ${JSON.stringify(expected)}。這是純替換，不得有任何差異——` +
          '而這條是降級路徑，平常跑不到，改壞了不會有人發現。',
      ).toBe(expected)
    })
  }

  it('★ 這份清單不是空的——空的話後面的比對什麼都沒驗到', () => {
    expect(outputBeforeSwitch.length).toBeGreaterThan(12)
  })
})

describe('產不出來時的行為不得無聲改變（FR-005）', () => {
  it('★ 認不得的概念仍然產出可見的標記，不是空字串', () => {
    const out = generateExpressionCode(n('__no_such_concept__', {}), 'cpp', 'apcs' as never)
    expect(out, '認不得的概念無聲產出空字串——降級路徑上的靜默失敗最難發現').not.toBe('')
    expect(out).toContain('__no_such_concept__')
  })
})
