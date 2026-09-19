/**
 * **轉型的三種寫法，產得回去嗎**——`cpp:cast`（2026-09-19）。
 *
 * ## 🔴 它從一個【我自己造的】迴歸來
 *
 * 第 194 刀讓 lift 認領了兩種新的轉型寫法：
 *
 * ```
 * int()        call(function: primitive_type, args: [])        值初始化
 * (ll)(x+1)    call(function: parenthesized_expression, args)  C 風格轉型
 * ```
 *
 * 而**產生器沒有跟上**：
 *
 * ```
 * 寫的          產回去的        後果
 * int()         (int)           不是合法的 C++ ——再 lift 一次整段走樣
 * (ll)(x+1)*z   (ll)x+1*z       合法，而它算的是別的東西
 * ```
 *
 * 語料的語義不動點從 **218/218 掉到 216/218**，而
 * `interpreter-matches-compiler` 那 3 條**全都是綠的**——因為它們只跑，不產碼。
 *
 * > **一個新的 lift 認領了一種寫法，而產生器產不回那種寫法
 * > ——形狀上是「多支援了一種語法」，實際上是「多了一種會壞掉的程式」。**
 *
 * ⚠️ 而抓到它的是**語料的探針**，那支探針沒設 `STUDYCPP_DIR` 就會跳過
 * ——所以這裡把形狀蒸餾成常駐的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

const H = '#include <bits/stdc++.h>\nusing namespace std;\n#define ll long long\n'
const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const wrap = (body: string): string => `${H}int main(){ int x=3,z=2; ${body} return 0; }\n`
const squash = (s: string): string => s.replace(/\s+/g, '')

/**
 * 從語料蒸餾出來的形狀——不是抄一整支。
 *
 * ⚠️ **`double(3)` 不在這張表裡，它在下面那一個 `describe`**：那個形狀會被
 * 正規化成 `(double)3`——**合法、同義、而且是不動點**。它屬於
 * 「文字不同 ≠ 錯」那一類，而把它放進這張要求逐字相同的表，
 * 量到的會是判準太嚴，不是缺陷。
 */
const SHAPES: readonly [string, string][] = [
  ['語料：`int()` 值初始化（basic/4_variable）', 'int v = int();'],
  ['語料：`(ll)(x+1)*z`（w/APCS/f638_2t）', 'cout << (ll)(x+1)*z;'],
  ['★ `(int)x` 照舊', 'double d=2.7; cout << (int)d;'],
  ['★ `(ll)x*z` 照舊（運算元不必括號）', 'cout << (ll)x*z;'],
  ['★ 巢狀轉型', 'cout << (int)(ll)x;'],
]

describe('轉型：產回去一字不差', () => {
  it('★ 入口條件——這條路真的跑得動', () => {
    const ids: string[] = []
    const walk = (n: SemanticNode): void => {
      ids.push(n.componentId)
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) walk(k)
    }
    walk(lift(wrap('int v = int();')))
    expect(ids, '🔴 `int()` 沒有被認成轉型 → 下面在驗空氣').toContain('cpp:cast')
  })

  describe('① 產出的程式碼', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const out = generateCode(lift(wrap(body)), 'cpp', S)
      expect(squash(out), '🔴 產出的程式碼變了').toContain(squash(body))
    })
  })

  /**
   * 🔴 **這一關才是抓到它的那一關**——`(int)` 是語法錯，再 lift 一次就走樣。
   */
  describe('② 語義的不動點', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const once = generateCode(lift(wrap(body)), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S), '🔴 來回一趟就走樣了').toBe(once)
    })
  })
})

/**
 * **`double(3)` → `(double)3`：一個【量出來的】正規化。**
 *
 * C++ 有兩種拼法而它們是同一件事，於是 lift 把兩種收成一顆 `cpp:cast`，
 * 產出時只有一種拼法。⚠️ 判準有三層，而第三層是
 * 「**文字不同 ≠ 錯，行為不同才是**」（`CLAUDE.md` 逐字）。
 *
 * 🔴 **而它必須被【釘住】而不是被略過**：正規化與走樣的差別只在
 * 「產出的那一個寫法對不對」，而那正是 194 那個迴歸的形狀
 *（`int()` 也是一個正規化——只是它產出的 `(int)` 不合法）。
 */
describe('轉型：兩種拼法收斂成一種（正規化，不是缺陷）', () => {
  it('`double(3)/2` 產成 C 風格，而它是不動點', () => {
    const once = generateCode(lift(wrap('cout << double(3)/2;')), 'cpp', S)
    expect(squash(once), '🔴 正規化的落點變了——它是不是還合法？').toContain('cout<<(double)3/2;')
    expect(generateCode(lift(once), 'cpp', S), '🔴 正規化之後又走樣＝那個落點不合法').toBe(once)
  })
})

/**
 * **`ll(x)`——小名的函式式轉型**（2026-09-19 這一關量到，**當場修**）。
 *
 * `#define ll long long` 之後寫 `ll(x)`：`ll` 在 `LiftContext` 裡**已經**標成
 * `kind: 'type'`（`lifter.ts` 的 `recordMacroAlias`），而函式式那一路**沒有問它**
 * ——`isTypeName` 在此之前只有一個呼叫點（`cpp/lifters/io.ts` 的括號那一路）。
 *
 * ```
 * (ll)(x+1)   🟢 cpp:cast       括號那一路問了 isTypeName
 * ll(x)       🔴 cpp:func_call  函式式那一路沒問  → 執行時 UNDEFINED_FUNC: ll
 * ```
 *
 * 🔴 **而它的①②③④全是綠的**：產出的程式碼一字不差（`ll(x)` 原樣吐回），
 * 只有⑤那一路會紅。語料 **0 處**，所以沒有任何一支語料走到它。
 *
 * > **一個只錯在⑤那一路的缺陷，形狀是完美的
 * > ——而形狀完美正是它活下來的原因。**
 */
describe('小名的函式式轉型', () => {
  it('★ 身分是轉型，不是呼叫', () => {
    const ids: string[] = []
    const walk = (n: SemanticNode): void => {
      ids.push(n.componentId)
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) walk(k)
    }
    walk(lift(wrap('cout << ll(x)*z;')))
    expect(ids, '🔴 `ll(x)` 又掉回泛用呼叫了').toContain('cpp:cast')
  })

  it('產成 C 風格（與 `double(3)` 同一個正規化），而它是不動點', () => {
    const once = generateCode(lift(wrap('cout << ll(x)*z;')), 'cpp', S)
    expect(squash(once)).toContain('cout<<(ll)x*z;')
    expect(generateCode(lift(once), 'cpp', S), '不動點').toBe(once)
  })

  /**
   * 🔴 **引數多於一個的不得被認領**——`pii(1,2)` 是**建構**不是轉型。
   * 那是上面那個分支的 `<= 1` 在擋的東西，而沒有這條測試它會安靜地掉一個引數。
   */
  it('★ `pii(1,2)` 是建構，不得被當成轉型', () => {
    const src = `${H}#define pii pair<int,int>\nint main(){ pii p = pii(1,2); cout << p.first; return 0; }\n`
    const ids: string[] = []
    const walk = (n: SemanticNode): void => {
      ids.push(n.componentId)
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) walk(k)
    }
    walk(lift(src))
    expect(ids, '🔴 兩個引數的被吃成轉型 → 掉了一個引數').not.toContain('cpp:cast')
  })
})
