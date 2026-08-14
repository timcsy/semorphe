/**
 * **探測（不是護欄）**：資訊競賽／APCS／Arduino 三個使用情境，我們缺什麼。
 *
 * 每段量三路：
 *   辨識  raw_code／unresolved 節點數（殘差通道）
 *   投影  產出的碼餵回參照編譯器，輸出是否與原始碼一致
 *   執行  直譯器輸出 vs 參照編譯器輸出
 *
 * ## 為什麼是探測而不是護欄
 *
 * 既有的兩條護欄（`audit-projection-residual`／`audit-behavior-error`）從
 * **教學文件的程式碼區塊**撈語料，所以它們量的是「我們寫過的東西」。
 * 這一支反過來：**先想清楚使用者在哪裡用它**，再去看那些寫法通不通。
 *
 * > **一個語料庫如果來自我們自己的文件，它量不出「使用者會寫而我們沒寫過」的東西。**
 *
 * ⚠️ 沒有棘輪是刻意的——這裡的數字要靠**看報表**推動，而不是靠一條會擋 CI 的線。
 * 缺口修好之後對應的樣本會從報表消失；那才是它的訊號。
 *
 * ## 自我否證
 *
 * **如果任何一組的段數斷言變紅，代表語料沒載入，這份報表不算數**
 * ——錨在段數（合成量）上，不錨在缺口數上：缺口數正是這支要推向零的東西。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed } from '../helpers/run-cpp'
import { H, COMPETITIVE, APCS_CORPUS, ARDUINO } from './scenario-corpus'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' }, io_style: 'cout',
  naming_convention: 'camelCase', indent_size: 4, brace_style: 'K&R',
  namespace_style: 'using', header_style: 'individual',
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)


/** 競賽：可執行的完整程式 */

/** APCS：教學／檢定常見寫法 */

/** Arduino：沒有 main，參照編譯器編不過——只量辨識與投影 */

function residualOf(n: SemanticNode, acc: { count: number; kinds: Set<string> }): void {
  if (n.conceptId === 'raw_code' || n.conceptId === 'unresolved') {
    acc.count++
    acc.kinds.add(String(n.metadata?.rawCode ?? '').slice(0, 40).replace(/\n/g, '⏎'))
    return
  }
  for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) residualOf(c, acc)
}

async function probe(src: string, runnable: boolean) {
  const tree = parser.parse(src)!
  const st = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  const acc = { count: 0, kinds: new Set<string>() }
  residualOf(st, acc)
  let code = ''
  try { code = generateCode(st, 'cpp', style) } catch (e) { code = `GENTHROW ${(e as Error).message}` }

  let ours = '', ref = '', regen = ''
  if (runnable) {
    const r = runCppDetailed(src)
    ref = r.ok ? r.output : `✘${r.stage}:${r.message.split('\n').find(l => l.includes('error')) ?? ''}`.slice(0, 90)
    const rg = runCppDetailed(code)
    regen = rg.ok ? rg.output : `✘${rg.stage}:${rg.message.split('\n').find(l => l.includes('error')) ?? ''}`.slice(0, 90)
    const i = new SemanticInterpreter({ maxSteps: 200000 })
    try { await i.execute(st); ours = i.getOutput().join('') } catch (e) { ours = `✘${(e as Error).message}`.slice(0, 90) }
  }
  return { residual: acc.count, kinds: [...acc.kinds], code, ours, ref, regen }
}

describe('三情境覆蓋探測', () => {
  for (const [label, corpus, runnable] of [['競賽', COMPETITIVE, true], ['APCS', APCS_CORPUS, true], ['Arduino', ARDUINO, false]] as const) {
    it(`${label}`, async () => {
      // ★ 入口條件——錨在**語料段數**上（合成量），見檔頭的自我否證
      expect(Object.keys(corpus).length).toBeGreaterThan(5)
      const rows: string[] = []
      let residual = 0, execMismatch = 0, projMismatch = 0, refCannotRun = 0
      for (const [name, src] of Object.entries(corpus)) {
        const r = await probe(src, runnable)
        const flags: string[] = []
        if (r.residual > 0) { residual++; flags.push(`辨識${r.residual}:${r.kinds.join('|')}`) }
        if (runnable) {
          // 🔴 **「參照編不過」與「我們算錯」是兩件事**，而它們原本混在同一欄。
          //
          // `__gcd` 是 libstdc++ 的擴充，macOS 的 clang 用 libc++ 沒有它
          // ——那一筆是**我們比參照寬容**，不是我們算錯。混在一起的話，
          // 缺口的數字會被一批「參照跑不動」灌水，而那個方向是**看不出來的**：
          // 兩者的症狀都是「這一段紅了」。
          if (r.ref.startsWith('✘compile')) {
            refCannotRun++
            flags.push(`參照編不過（我們算出 ${JSON.stringify(r.ours)}）——不是我們的缺陷`)
          } else {
            if (r.ours !== r.ref) { execMismatch++; flags.push(`執行 ours=${JSON.stringify(r.ours)} ref=${JSON.stringify(r.ref)}`) }
            if (r.regen !== r.ref) { projMismatch++; flags.push(`投影 regen=${JSON.stringify(r.regen)}`) }
          }
        }
        if (flags.length) rows.push(`  ✘ ${name}\n      ${flags.join('\n      ')}`)
      }
      console.log(`\n═══ ${label}：${Object.keys(corpus).length} 段｜辨識缺 ${residual}｜執行不符 ${execMismatch}｜投影不符 ${projMismatch}｜參照編不過 ${refCannotRun}\n${rows.join('\n')}`)
    }, 300000)
  }
})
