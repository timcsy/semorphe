/**
 * spec 151：**兩條產出路徑都實作的轉換，效果必須一致。**
 *
 * ## 🔴 這一支怎麼來的
 *
 * `cpp:program` 有兩條產出路徑——**有鷹架**（UI 走的）與 **legacy**（測試走的）。
 * `generate.ts:70` 從 2026-08-17 就寫著這件事，**而 2026-08-19 的 spec 150
 * 又踩了一次**：標頭替換只寫在 legacy 那條，單元測試全綠、瀏覽器裡沒作用。
 *
 * ```
 * 946 支測試（全套 20%）走 legacy   2 支裝了鷹架   產品無條件裝鷹架
 * ```
 *
 * ## 🔴 而「哪條路是產品走的」我一開始就搞錯了
 *
 * `generate.ts:51` 逐字：
 *
 * ```ts
 * if (ctx.programScaffold && ctx.scaffoldConfig && !hasMainFunc) {
 * ```
 *
 * **兩條路產品都會走**：
 *
 * ```
 * 樹裡【有】 main（完整的 C++ 程式）      → legacy 路徑
 * 樹裡【沒有】main（L0 的身體／Arduino）  → 鷹架路徑
 * ```
 *
 * ⚠️ 我原本斷言「legacy 是產品到不了的死路」——**那是錯的**，
 * 而那個錯讓第一版的比對變成「legacy vs legacy」，
 * **兩邊當然一樣，而它什麼都沒量到**。
 *
 * > **一個「兩條路一樣」的綠燈，可能只是因為你兩次都走了同一條。**
 *
 * 🟢 抓到它的是**錨點**（「鷹架獨有的 preamble 要真的出現」）——
 * 它紅了，而那正是錨點存在的理由。
 *
 * ## ⚠️ 判準不是「兩條路產出一模一樣」
 *
 * 鷹架多做 preamble、進入點外殼——**那正是它存在的理由**。
 *
 * **量的是：同一個轉換，在【兩種樹形】下效果一不一致。**
 * 而每一組都先斷言**自己真的走到了那條路**（否則又是 legacy vs legacy）。
 *
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import {
  generateCode, setDependencyResolver, setProgramScaffold, setScaffoldConfig, setHeaderAliases,
} from '../../src/core/projection/code-generator'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { CppScaffold } from '../../src/languages/cpp/cpp-scaffold'
import type { StylePreset, Target } from '../../src/core/types'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import cppTarget from '../../src/languages/cpp/targets/cpp.json'
import cTarget from '../../src/languages/cpp/targets/c.json'
import d1mini from '../../src/languages/cpp/targets/wemos-d1-mini.json'

let tsParser: Parser
let lifter: Lifter
let resolver: ReturnType<typeof createPopulatedRegistry>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  resolver = createPopulatedRegistry()
  setDependencyResolver(resolver)
})

/**
 * 照產品的方式產出一次，並**斷言它真的走了預期的那條路**。
 *
 * 🔴 路由由**樹裡有沒有 `main`** 決定（`generate.ts:51`），不是由我們指定。
 */
function gen(
  src: string, style: unknown, target: Partial<Target>, expectPath: 'scaffold' | 'legacy',
): string {
  const tree = lifter.lift(tsParser.parse(src).rootNode as never)
  expect(tree, 'lift 回了 null → 這一條空過').not.toBeNull()

  // 逐項照 `app.ts` 配置——⚠️ 2026-08-20 的第一次探針漏了 `skeleton`，
  //    量出「Arduino 兩條路差很多」的假差異。
  const scaffold = new CppScaffold(resolver)
  scaffold.setSkeleton(target.skeleton ?? 'main')   // app.ts:608
  setProgramScaffold(scaffold)                          // app.ts:188
  setScaffoldConfig({ scaffoldDepth: 0 })               // app.ts:189
  setHeaderAliases(target.headerAliases)                // app.ts:191
  const out = generateCode(tree!, 'cpp', style as StylePreset)
  setHeaderAliases(undefined)

  // ★ **路由斷言**：源碼裡有沒有 `main` 決定走哪條，而這裡把它釘死。
  const srcHasMain = /\bint\s+main\s*\(/.test(src)
  expect(srcHasMain ? 'legacy' : 'scaffold',
    `這一條想測 ${expectPath} 路徑，而這段原始碼會走另一條`).toBe(expectPath)
  return out
}

/** 一段程式碼裡出現的所有 `#include <...>`。 */
const includesOf = (code: string) => (code.match(/#include\s*<[^>]+>/g) ?? []).sort()

describe('spec 151 · ★ 錨點：兩條路各自真的被走到', () => {
  it('🔴 沒有 `main` → 鷹架那條（它會補出進入點與 preamble）', () => {
    // APCS 風格的 `namespace_style` 是 `using`——⚠️ `google` 是 `explicit`，
    //    用它當錨點會誤判成「鷹架沒跑」。
    const out = gen('void f(){ std::cout << 1; }', apcsStyle, cppTarget as Partial<Target>, 'scaffold')
    expect(out, '鷹架沒有補出 preamble → 它可能整個沒跑').toContain('using namespace std;')
    expect(out, '鷹架沒有補出進入點').toContain('int main() {')
  })

  it('🔴 有 `main` → legacy 那條（鷹架不得再包一層）', () => {
    const out = gen('int main(){ std::cout << 1; return 0; }', apcsStyle, cppTarget as Partial<Target>, 'legacy')
    expect((out.match(/int main\s*\(/g) ?? []).length, '包出了第二個 main').toBe(1)
    expect(out, 'legacy 那條不該有 preamble').not.toContain('using namespace std;')
  })
})

/** 同一個轉換，在兩種樹形下各驗一次。 */
function bothShapes(
  name: string,
  srcWithMain: string, srcWithoutMain: string,
  style: unknown, target: Partial<Target>,
  assertOn: (code: string, path: string) => void,
): void {
  it(`🔴 ${name}——legacy 那條`, () => assertOn(gen(srcWithMain, style, target, 'legacy'), 'legacy'))
  it(`🔴 ${name}——鷹架那條`, () => assertOn(gen(srcWithoutMain, style, target, 'scaffold'), '鷹架'))
}

describe('spec 151 · 轉換①：C 方言的標頭改名', () => {
  bothShapes('`<iostream>` → `<stdio.h>`',
    '#include <iostream>\nint main(){ std::cout << 1; return 0; }',
    '#include <iostream>\nvoid f(){ std::cout << 1; }',
    cStyle, cTarget as Partial<Target>,
    (code, path) => {
      expect(includesOf(code).join(), `${path}：C 目標仍然吐 iostream`).not.toContain('iostream')
      expect(includesOf(code).join(), `${path}：C 目標沒有 stdio.h`).toContain('stdio.h')
    })
})

describe('spec 151 · 轉換②：板子的標頭替換（spec 150 就是只修了一條）', () => {
  bothShapes('手寫的 `<WiFi.h>` → `<ESP8266WiFi.h>`',
    '#include <WiFi.h>\nint main(){ WiFi.begin("a","b"); return 0; }',
    '#include <WiFi.h>\nvoid setup(){ WiFi.begin("a","b"); }\nvoid loop(){}',
    googleStyle, d1mini as unknown as Partial<Target>,
    (code, path) => {
      expect(includesOf(code).join(), `${path}：沒換成 ESP8266WiFi.h`).toContain('ESP8266WiFi.h')
      expect(includesOf(code).join(), `${path}：<WiFi.h> 留下來了`).not.toMatch(/<WiFi\.h>/)
    })

  bothShapes('**自動補**的標頭也要換',
    'int main(){ WiFi.begin("a","b"); return 0; }',
    'void setup(){ WiFi.begin("a","b"); }\nvoid loop(){}',
    googleStyle, d1mini as unknown as Partial<Target>,
    (code, path) => {
      expect(includesOf(code).join(), `${path}：自動補的標頭沒換`).toContain('ESP8266WiFi.h')
    })
})

describe('spec 151 · 轉換③：C 目標的 `bool` → `<stdbool.h>`', () => {
  bothShapes('補上 `<stdbool.h>`',
    'int main(){ bool ok = true; return ok ? 0 : 1; }',
    'void f(){ bool ok = true; (void)ok; }',
    cStyle, cTarget as Partial<Target>,
    (code, path) => {
      expect(includesOf(code).join(), `${path}：沒補 stdbool.h`).toContain('stdbool.h')
    })
})
