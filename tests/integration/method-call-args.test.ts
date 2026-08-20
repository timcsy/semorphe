/**
 * 護欄：**通用方法呼叫的引數，在積木那一側不得消失。**
 *
 * ## 🔴 使用者在 Arduino IDE 實測到的
 *
 * ```
 * Serial.write(cmd);   →  積木：「對 Serial 執行 write（ ▯ ）」  ← 括號裡是空的
 * ```
 *
 * ⚠️ 而**語義樹是對的**（`children.args` 有那顆 `cmd`）、**產生器也是對的**
 * （產出 `Serial.write(cmd);`）。壞的只有**投影**那一側。
 *
 * > **一個只在投影那一側丟資料的 bug，
 * > lift 與 generate 各自的測試都看不到它。**
 *
 * ## 根因有【兩層】，而只修一層等於沒修
 *
 * ```
 * ① renderMapping 把 `ARGS` 當成【欄位】對到 `args` 這個【接點】
 *    —— 接點是節點陣列，一個文字欄位裝不下它
 * ② 而修完①之後產出的 `ARG_0`【沒有插槽可接】
 *    —— `block-registrar.ts` 只替 `cpp_func_call` 寫了動態引數，
 *       `cpp_method_call` 沒有。那正是專案記過的「雙重真相來源」
 * ```
 *
 * 本檔驗的是**兩層都通**：語義樹 → 積木狀態 → 回到語義樹。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) nodes(k, out)
  return out
}
interface BlockState { type?: string; inputs?: Record<string, unknown>; extraState?: Record<string, unknown> }
const allBlocks = (tree: SemanticNode): BlockState[] => {
  const st = renderToBlocklyState(tree) as unknown as { blocks: { blocks: BlockState[] } }
  const out: BlockState[] = []
  const walk = (b: BlockState | undefined): void => {
    if (!b) return
    out.push(b)
    for (const v of Object.values(b.inputs ?? {})) walk((v as { block?: BlockState })?.block)
    walk((b as { next?: { block?: BlockState } }).next?.block)
  }
  for (const b of st.blocks.blocks) walk(b)
  return out
}

describe('護欄：通用方法呼叫的引數不得在積木那一側消失', () => {
  it('🔴 使用者實測的那一段：Serial.write(cmd) 的引數要在積木上', () => {
    const tree = lift('void noteOn(int cmd) {\n  Serial.write(cmd);\n}\n')
    const call = nodes(tree).find((n) => n.componentId === 'cpp:method_call')
    expect(call, '沒有認出方法呼叫——下面全部空過').toBeDefined()   // ← 正向錨點
    expect(call?.children.args ?? [], '語義樹那一側').toHaveLength(1)

    const blk = allBlocks(tree).find((b) => b.type === 'cpp_method_call')
    expect(blk, '積木沒渲染出來').toBeDefined()
    // 🔴 這一條就是那個 bug 本身
    expect(Object.keys(blk?.inputs ?? {}), '積木上的引數插槽').toContain('ARG_0')
    expect(blk?.extraState?.argCount).toBe(1)
  })

  it('🔴 多引數也要全部在——一個都不准掉', () => {
    const tree = lift('void f() {\n  obj.doThing(1, 2, 3);\n}\n')
    const call = nodes(tree).find((n) => n.componentId === 'cpp:method_call')
    expect(call?.children.args ?? []).toHaveLength(3)               // ← 正向錨點
    const blk = allBlocks(tree).find((b) => b.type === 'cpp_method_call')
    expect(Object.keys(blk?.inputs ?? {}).filter((k) => k.startsWith('ARG_'))).toHaveLength(3)
  })

  it('零引數的方法：不得憑空多出插槽', () => {
    const tree = lift('void f() {\n  obj.reset();\n}\n')
    const blk = allBlocks(tree).find((b) => b.type === 'cpp_method_call')
    expect(blk, '積木要在').toBeDefined()                            // ← 正向錨點
    expect(Object.keys(blk?.inputs ?? {}).filter((k) => k.startsWith('ARG_'))).toHaveLength(0)
    expect(blk?.extraState?.argCount ?? 0).toBe(0)
  })

  it('⚠️ 而產生器那一側本來就是對的——這一條防的是「修投影時弄壞產出」', () => {
    const src = 'void noteOn(int cmd, int pitch) {\n  Serial.write(cmd);\n  Serial.write(pitch);\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(once).toContain('Serial.write(cmd);')                     // ← 正向錨點
    expect(once).toContain('Serial.write(pitch);')
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset), '漂移').toBe(once)
  })

  it('🔴 而運算式版也要有——它與敘述版的 extraState 格式必須相同', () => {
    // ⚠️ `STATEMENT_TO_EXPRESSION` 直接搬移 extraState（專案記過的契約）。
    const tree = lift('void f() {\n  int n = obj.getValue(7);\n}\n')
    const call = nodes(tree).find((n) => n.componentId === 'cpp:method_call')
    expect(call?.children.args ?? []).toHaveLength(1)                // ← 正向錨點
    const blk = allBlocks(tree).find((b) => (b.type ?? '').startsWith('cpp_method_call'))
    expect(blk?.extraState?.argCount).toBe(1)
    expect(Object.keys(blk?.inputs ?? {})).toContain('ARG_0')
  })
})
