/**
 * 探針：**靠名字認人的 lift 樣式，會不會搶走使用者自己宣告的名字？**
 *
 * ## 🔴 這個問題有一份判例
 *
 * `cpp:pin_constant` 的 lift 樣式 2026 年被拿掉，理由逐字（那顆膠囊的 `_lift_why`）：
 *
 * > 語料裡有 `enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };`，
 * > 而 `cout << LOW` 印出 **0**（樣式把它認成腳位常數）而不是 **-1**。
 * >
 * > **一個靠「識別字的名字」認人的樣式，會把使用者自己宣告的名字搶走。**
 *
 * 而同一段病歷裡有一句**沒有被驗證過的推測**：
 *
 * > ⚠️ 既有的 `builtin_constant` 用同一個做法（`EOF`／`NULL` 靠名字 lift），
 * > 而**那些名字幾乎沒有人會重新宣告**——差別在這裡，不在做法。
 *
 * 🔴 **「幾乎沒有人會」是一個關於使用者的猜測，不是一個機制上的保證。**
 * 這一支去試：真的有人宣告 `EOF` 時會怎樣。
 *
 * > **一個「因為沒有人會這樣做所以安全」的理由，
 * > 保護的是常見情況——而 bug 住在別的地方。**
 *
 * ## ⚠️ 它不判斷該不該修
 *
 * 只把行為量出來。修法（讓 lift 期知道「這個名字被宣告過」）是一刀，
 * 而它的規模由這份量測決定。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode | null =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode | null

const walk = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks ?? []) walk(k, out)
  return out
}

/** 這段碼裡，那個名字被 lift 成什麼元件身分。 */
function componentOf(code: string, name: string): string[] {
  const t = lift(code)
  if (!t) return ['(lift 回 null)']
  return [...new Set(walk(t)
    .filter((n) => String(n.properties?.value ?? n.properties?.name ?? '') === name)
    .map((n) => n.componentId ?? '(無身分)'))]
}

/** 跑一段完整的程式，回它印出什麼。 */
async function run(code: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lift(code) as never)
  return interp.getOutput().join('')
}

describe('探針：靠名字認人的樣式會不會搶走宣告', () => {
  it('★ 入口條件——lifter 起得來', () => {
    expect(lift('int main() { return 0; }')).not.toBeNull()
  })

  /**
   * 🔴 **判例本身**：`pin_constant` 的樣式已經拿掉了，所以這一條今天該是安全的
   * ——它是這份量測的**對照組**。
   */
  it('對照組：`enum Level { LOW = -1 }` 的 LOW 不再被搶（樣式已拿掉）', () => {
    const ids = componentOf('enum Level { LOW = -1 };\nint main() {\n    int x = LOW;\n    return 0;\n}\n', 'LOW')
    // eslint-disable-next-line no-console
    console.log(`\n  LOW → ${ids.join('、') || '（沒有節點帶這個名字）'}`)
    expect(ids.includes('cpp:pin_constant'),
      '🔴 樣式又回來了——它會把使用者宣告的名字搶走').toBe(false)
  })

  /**
   * 🔴 **真正要量的那一條**：`EOF` 被使用者宣告了會怎樣。
   *
   * 病歷說「那些名字幾乎沒有人會重新宣告」——而那是一個關於**使用者**的猜測。
   */
  it('🔴 使用者宣告了 `EOF`：它還會被認成內建常數嗎', () => {
    const code = 'enum Marker { EOF = -99 };\nint main() {\n    int x = EOF;\n    return 0;\n}\n'
    const ids = componentOf(code, 'EOF')
    const out = lift(code) ? generateCode(lift(code)!, 'cpp', apcs as StylePreset) : ''
    // eslint-disable-next-line no-console
    console.log(`\n  EOF → ${ids.join('、') || '（沒有節點帶這個名字）'}`)
    // eslint-disable-next-line no-console
    console.log(`  來回之後：\n${out.split('\n').map((l) => '    ' + l).join('\n')}\n`)
    expect(ids.length + out.length).toBeGreaterThan(0)
  })

  it('🔴 使用者宣告了 `NULL`：同上', () => {
    const ids = componentOf('enum Marker { NULL = 7 };\nint main() {\n    int x = NULL;\n    return 0;\n}\n', 'NULL')
    // eslint-disable-next-line no-console
    console.log(`\n  NULL → ${ids.join('、') || '（沒有節點帶這個名字）'}\n`)
    expect(ids.length).toBeGreaterThanOrEqual(0)
  })

  /**
   * 🔴 **這一條才是傷害**——身分被搶只是形狀，**印錯數字**才是使用者看得到的。
   *
   * 判例（`pin_constant`）當年的症狀逐字：「`cout << LOW` 印出 **0**
   * 而不是 **-1**」。這裡問同一句話，換成 `EOF`。
   */
  it('🔴 執行：使用者宣告 `EOF = -99`，它印出什麼', async () => {
    const code = '#include <iostream>\nusing namespace std;\nenum Marker { EOF = -99 };\n'
      + 'int main() {\n    cout << EOF << endl;\n    return 0;\n}\n'
    let out = ''
    try { out = await run(code) } catch (e) { out = `（丟錯：${(e as Error).message.slice(0, 60)}）` }
    // eslint-disable-next-line no-console
    console.log(`\n  cout << EOF  →  ${JSON.stringify(out)}   （宣告的是 -99）\n`)
    expect(typeof out).toBe('string')
  })

  /** ⚠️ 沒有人宣告時**應該**被認成內建常數——那是這些樣式存在的理由。 */
  it('沒有人宣告時，`EOF` 是內建常數（樣式該做的事）', () => {
    const ids = componentOf('int main() {\n    int x = EOF;\n    return 0;\n}\n', 'EOF')
    // eslint-disable-next-line no-console
    console.log(`\n  （無宣告）EOF → ${ids.join('、') || '（沒有節點帶這個名字）'}\n`)
    expect(ids.length).toBeGreaterThanOrEqual(0)
  })
})
