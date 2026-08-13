/**
 * `cpp:define` 的**自證測**——`#define` 的兩個角色是**分開**的
 *
 * ## 這裡放什麼
 *
 * 推導不出來的那件事：`#define` 同時做兩件無關的事，而它們可以各自壞掉。
 *
 * ```
 * ① 記下「這個名字被定義過」  → #ifdef / #ifndef 讀它
 * ② 把值綁成一個具名常數      → 後面的程式碼讀它
 * ```
 *
 * ②**在 2026-08-13 之前不存在**：第三十二條護欄的 18 段缺口裡有 2 段倒在這裡
 * （`#define LIMIT 100` 之後用 `LIMIT` → `UNDECLARED_VAR`）。
 *
 * ## ⚠️ 而它不是巨集展開——那條路是墓碑，且仍然成立
 *
 * `history/014-墓碑目錄.md:23` 否決「模擬 C preprocessor」，理由是
 * 「**S0-S2 的教學場景根本不需要（學生程式碼不會用框架巨集）**」。
 * 前半對、後半推得太遠：學生不用框架巨集，**但很常用 `#define MAX 100`**。
 *
 * → 所以有一支**負向**測釘住邊界：**函式巨集刻意不支援，而且必須繼續報錯**。
 * 沒有那一支的話，一個「順手把運算式也求值」的實作會全綠，
 * 而它已經跨進墓碑那一側了。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { resetDefinedMacros } from '../../../languages/cpp/core/executors/preprocessor'
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
  out.add(n.conceptId)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

async function run(code: string): Promise<string> {
  resetDefinedMacros()
  const tree = lift(code)
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(tree as SemanticNode)
  return i.getOutput().join('')
}

const head = '#include <iostream>\nusing namespace std;\n'

describe('cpp:define', () => {
  it('★ 正向錨點：這段碼真的產生了 cpp:define', () => {
    // 沒有這一支的話，下面每一支都可能在測別的東西
    expect(ids(lift(`${head}#define MAX 100\nint main(){ return 0; }`))).toContain('cpp:define')
  })

  it('整數常數綁進 scope——這 2 段是第三十二條護欄的缺口', async () => {
    expect(await run(`${head}#define MAX_SIZE 100\n#define PI 3\nint main(){ cout << MAX_SIZE << endl; cout << PI << endl; return 0; }`)).toBe(
      '100\n3\n',
    )
  })

  it('★ 全域定義，函式裡讀得到——scope 要跨過函式邊界', async () => {
    expect(
      await run(
        `${head}#define LIMIT 100\nint f(int n){ if (n > LIMIT) return -1; return n * 2; }\nint main(){ cout << f(5) << endl; cout << f(200) << endl; return 0; }`,
      ),
    ).toBe('10\n-1\n')
  })

  it('浮點與字串常數', async () => {
    expect(await run(`${head}#define E 2.5\n#define NAME "semorphe"\nint main(){ cout << E << endl; cout << NAME << endl; return 0; }`)).toBe(
      '2.5\nsemorphe\n',
    )
  })

  it('🔴 反向：函式巨集刻意不支援，而且必須繼續報錯', async () => {
    // ⚠️ 這一支守的是墓碑的邊界。它變綠的那天，表示有人開始在語義層
    // 求值巨集的運算式——那就是在重建 preprocessor。
    await expect(run(`${head}#define SQR(x) ((x)*(x))\nint main(){ cout << SQR(3); return 0; }`)).rejects.toThrow()
  })

  it('🔴 反向：值是運算式時不猜——AREA 沒有被綁成常數', async () => {
    await expect(run(`${head}#define W 3\n#define AREA (W*2)\nint main(){ cout << AREA; return 0; }`)).rejects.toThrow()
  })

  it('★ 兩個角色是分開的：#ifdef 仍然只看「有沒有定義過」', async () => {
    // 無值的 #define 綁不出常數，而 #ifdef 必須照樣成立
    expect(await run(`${head}#define DEBUG\nint main(){\n#ifdef DEBUG\n  cout << "on";\n#endif\n  return 0; }`)).toBe('on')
  })
})
