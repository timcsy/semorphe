/**
 * `cpp:string_at` 的**自證測**——`s[i]` 的型別是 **char**，而 char 是碼位
 *
 * ## 這裡放什麼
 *
 * 推導不出來的那件事：**char 在這個直譯器裡曾經有三種表示**。
 *
 * ```
 * cpp:literal_char   { type: 'char',   value: 65 }    ← 碼位（數字）
 * cpp:string_at      { type: 'string', value: 'A' }   🔴 錯的那一種
 * mutations.ts       { type: 'char',   value: 'A' }   ← 又一種
 * ```
 *
 * 🔴 症狀**只出現在算術上**：`s[i] - 32` 走 `toNumber` 的
 * `Number('a') || 0` 變成 0，於是算出 -32。而 `s[i] >= 'a'`（比較另有處理）
 * 與 `cout << s[i]`（顯示端認得）**都是對的**——所以整族大小寫轉換靜靜地不動，
 * 而每一個單獨的操作看起來都正常。
 *
 * > **同一個概念有三種表示時，錯的那一種只會在某些運算下現形。**
 *
 * ⚠️ 它佔第三十二條護欄 14 筆誤差裡的 **4 筆**，而其中兩筆的既有判定寫著
 * 「可能是 islower 未定義或**字元轉型**」——**那個猜測是對的**，只是當時沒有定位。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode } from '../../../core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function ids(n: SemanticNode | null, out = new Set<string>()): Set<string> {
  if (!n) return out
  out.add(n.componentId)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

async function run(code: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(code) as SemanticNode)
  return i.getOutput().join('')
}

const H = '#include <iostream>\n#include <string>\n#include <cctype>\nusing namespace std;\n'

describe('cpp:string_at', () => {
  it('★ 正向錨點：這段碼真的產生了 cpp:string_at', () => {
    expect(ids(lift(`${H}int main(){ string s="ab"; char c = s[0]; return 0; }`))).toContain('cpp:string_at')
  })

  it('🔴 算術：s[0] - 32 是 65，不是 -32', async () => {
    // 這一支就是那 4 筆誤差的最小重現。
    expect(await run(`${H}int main(){ string s="ab"; cout << (s[0]-32); return 0; }`)).toBe('65')
  })

  it('大小寫轉換的整族——寫回字串也要生效', async () => {
    expect(
      await run(`${H}int main(){ string s="ab"; for(int i=0;i<s.size();i++){ if(s[i]>='a'&&s[i]<='z') s[i]=s[i]-32; } cout << s; return 0; }`),
    ).toBe('AB')
  })

  it('★ 而顯示仍然是字元，不是數字', async () => {
    // ⚠️ 改成碼位之後最容易壞的就是這裡：`cout << s[0]` 若印出 97 就是換了一個病。
    expect(await run(`${H}int main(){ string s="ab"; cout << s[0]; return 0; }`)).toBe('a')
  })

  it('★ 比較仍然對——它本來就是對的，不得被這次改動弄壞', async () => {
    expect(await run(`${H}int main(){ string s="ab"; cout << (s[0]>='a') << (s[0]=='a') << (s[0]<'b'); return 0; }`)).toBe('111')
  })

  it('★ cctype 認得它', async () => {
    expect(await run(`${H}int main(){ string s="a1"; cout << isalpha(s[0]) << isdigit(s[1]); return 0; }`)).toBe('11')
  })

  it('🔴 反向：索引越界要出聲', async () => {
    await expect(run(`${H}int main(){ string s="ab"; cout << s[9]; return 0; }`)).rejects.toThrow()
  })
})
