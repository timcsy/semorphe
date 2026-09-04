/**
 * 🔴 **使用者自己定義的函式，贏過內建的名字樣式。**
 *
 * 缺陷（2026-09-04，寫 c-bridge 第 3 課的練習題時撞到的）：
 *
 * ```c
 * void swap(int *a, int *b) { … }   ← 使用者寫的
 * swap(&x, &y);                     → lift 成 cpp:var_swap（內建的 std::swap）
 * 執行                              → 「這個東西不能被指定值」
 * ```
 *
 * 症狀不是「找不到函式」，是一個**看起來與指標有關的執行期錯誤**
 * ——而真正的原因是他的函式從頭到尾沒有被呼叫過。
 *
 * > **一個名字樣式如果不看「這個名字在這支程式裡有沒有被使用者自己定義」，
 * > 它就會把使用者的函式偷換成內建的那一顆。**
 *
 * ⚠️ 判斷擋在**路由器**（`tryCallBranches`），不是在 28 個名字樣式裡各寫一次
 * ——名字的解析順序是「去問誰」，那是路由器的知識。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode } from '../../src/core/types'

let parser: CppParser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  parser = new CppParser()
  await parser.init('public')
  lifter = createTestLifter()
  registerCppLanguage()
}, 30_000)

async function liftCode(code: string): Promise<SemanticNode> {
  const tree = await parser.parse(code)
  const t = lifter.lift(tree.rootNode as never)
  if (!t) throw new Error('抬升回 null')
  return t
}

/** 這棵樹裡出現過哪些身分。 */
function ids(node: unknown): string[] {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    const x = n as { componentId?: string; children?: Record<string, unknown[]> }
    if (x.componentId) out.push(x.componentId)
    for (const list of Object.values(x.children ?? {})) for (const c of list ?? []) walk(c)
  }
  walk(node)
  return out
}

describe('使用者自己定義的函式贏過內建樣式', () => {
  it('★ 入口條件：沒有自己定義時，內建的 swap 樣式【還在】', async () => {
    // 🔴 這一條是自我否證：內建樣式如果整個壞了，下面那條會「碰巧通過」
    const t = await liftCode('int main(){int x=1,y=2; swap(x,y); return 0;}')
    expect(ids(t), '🔴 內建的 swap 樣式不見了 → 下面那條是空過的').toContain('cpp:var_swap')
  })

  it('🔴 自己定義了 swap ⟹ 呼叫的是【他的】，不是內建那一顆', async () => {
    const t = await liftCode(
      'void swap(int *a, int *b){int t=*a; *a=*b; *b=t;}\n' +
      'int main(){int x=1,y=2; swap(&x,&y); return 0;}')
    expect(ids(t), '🔴 使用者的函式被內建樣式偷換掉了').not.toContain('cpp:var_swap')
    expect(ids(t)).toContain('cpp:func_call')
  })

  it('⚠️ 遞迴：函式在自己的主體裡呼叫自己，也要認得', async () => {
    const t = await liftCode(
      'int max(int a, int b){ if (a < 1) return max(a + 1, b); return a; }\n' +
      'int main(){ return max(0, 1); }')
    // `max` 是內建樣式之一（`cpp:math_max`）——而這裡它是使用者的
    expect(ids(t), '🔴 遞迴呼叫被內建的 max 攔走了').not.toContain('cpp:math_max')
  })
})

/**
 * 🔴 **結構陣列**——`struct Point ps[3]; ps[0].x = 1;`
 *
 * 缺陷（2026-09-04，寫 c-bridge 第 5 課的練習題時撞到的）：
 * 每一格是 `defaultValue('struct Point')` ＝ 一個帶著那個字串型別的 **0**，
 * 於是 `ps[0].x = 1` 丟「**變數 '（不是一個結構）' 尚未宣告**」
 * ——而那句話指向的東西根本不存在於程式裡。
 *
 * > **一個「型別名我不認得，那就給 0」的預設值，
 * > 會在後面某一步炸出一個【與真正原因無關】的訊息。**
 */
describe('結構陣列的每一格是一個結構', () => {
  it('★ 宣告一個結構陣列，填值再讀回來', async () => {
    const { SemanticInterpreter } = await import('../../src/interpreter/interpreter')
    const out: string[] = []
    const i = new SemanticInterpreter()
    i.setOutputCallback((t) => out.push(t))
    const tree = await liftCode(
      'struct Point { int x; int y; };\n' +
      'int main(){ struct Point ps[2]; ps[0].x = 7; printf("%d\\n", ps[0].x); return 0; }')
    await i.execute(tree)
    expect(out.join(''), '🔴 結構陣列的每一格不是一個結構').toContain('7')
  })
})
