import type { SemanticNode } from '../../core/types'
import type { DependencyResolver } from '../../core/dependency-resolver'
import type { ProgramScaffold, ScaffoldConfig, ScaffoldResult, ScaffoldItem } from '../../core/program-scaffold'
// ⚠️ **副作用 import**——把 C++ 的鷹架宣告註冊進去。
//    少了它，`shellById` 在沒有載語言套件的路徑上找不到東西。
import './shells'
import { shellById, type ShellLine } from '../../core/shell'
import { resolveVisibility } from '../../core/program-scaffold'
import { collectComponents } from './auto-include'
import { expandHeaderAliases } from './header-aliases'

export class CppScaffold implements ProgramScaffold {
  private resolver: DependencyResolver
  /**
   * 有沒有程式外殼。
   *
   * 🔴 由**目標宣告**（`Target.entryShell`），不是由這裡認名字。
   * `'none'` 時 preamble／entryPoint／epilogue **全部是空的**——Arduino sketch
   * 沒有 `main()`，`setup()`／`loop()` 就是頂層。
   *
   * ⚠️ 而「空」在這裡是**明確的空陣列**，不是「跳過這一段」：
   * 下游把 `ScaffoldResult` 的四段當成一份完整的答案。
   */
  /**
   * 用哪一份鷹架宣告——**開放值域**（`src/languages/cpp/shells/*.json` 的 `id`）。
   *
   * 🔴 它在 2026-08-28 之前是 `'main' | 'none'`，也就是「有」跟「沒有」。
   *    第三種外框（Python 的 `__main__`、競賽的快速 IO、Java 的 class）
   *    在那個型別下**表達不出來**。
   */
  private entryShell = 'main'

  constructor(resolver: DependencyResolver, entryShell = 'main') {
    this.resolver = resolver
    this.entryShell = entryShell
  }

  /** 換目標時呼叫——⚠️ 換的是同一個實例，因為它被兩個地方持有（見 `ui/app.ts`）。 */
  setEntryShell(shell: string): void {
    this.entryShell = shell
  }

  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult {
    const { scaffoldDepth, manualImports = [], pinnedItems = [] } = config
    const manualSet = expandHeaderAliases(new Set(manualImports))

    // Collect components from semantic tree
    const components = new Set<string>()
    collectComponents(tree, components)

    // Resolve dependencies and filter manual imports
    const edges = this.resolver.resolve([...components])
    const filteredEdges = edges.filter(e => !manualSet.has(e.header))

    // Build scaffold items
    const imports: ScaffoldItem[] = filteredEdges.map(edge => {
      const code = edge.directive
      const pinned = pinnedItems.includes(code)
      const visibility = resolveVisibility(scaffoldDepth, pinned)
      return {
        code,
        visibility,
        reason: visibility === 'ghost' ? `因為你用了 ${edge.reason}` : undefined,
        section: 'imports' as const,
        pinned: pinned || undefined,
      }
    })

    // 🔴 **四段全部讀宣告**（`src/languages/cpp/shells/*.json`，2026-08-28）。
    //
    // 在此之前這裡有一行 `if (this.entryShell === 'none') return { …全空 }`
    // ＋ 三段寫死的字串（`using namespace std;`／`int main() {`／`return 0;`）。
    //
    // 🔴 那讓 `entryShell` 的值域只有「**有**」跟「**沒有**」
    // ——而「沒有鷹架」與「一種空的鷹架」在程式碼裡分不出來。
    // 使用者：「鷹架應該也不只一個吧？」
    //
    // > **鷹架不是一顆新積木，是「哪幾段組成外框，以及它們為什麼在那裡」。**
    //
    // ⚠️ `imports` **不在宣告裡**——那一段是依賴解析器算出來的
    //    （你用了 `cout` 才有 `<iostream>`），不是固定的。
    const shell = shellById(this.entryShell)
    if (!shell) {
      // 🔴 **出聲**。靜靜地當成「沒有外框」的話，一個打錯的 shell id
      //    會產出一支少了 `int main()` 的程式，而那看起來像 Arduino。
      throw new Error(`鷹架宣告 ${this.entryShell} 不存在——目標的 entryShell 指向一個沒有登記的外框`)
    }

    const section = (lines: readonly ShellLine[], sec: ScaffoldItem['section']): ScaffoldItem[] =>
      lines.map((l) => {
        const pinned = pinnedItems.includes(l.code)
        const visibility = resolveVisibility(scaffoldDepth, pinned)
        return {
          code: l.code,
          visibility,
          reason: visibility === 'ghost' ? l.reason : undefined,
          section: sec,
          pinned: pinned || undefined,
        }
      })

    const preamble = section(shell.preamble, 'preamble')
    const entryPoint = section(shell.entryPoint, 'entryPoint')
    const epilogue = section(shell.epilogue, 'epilogue')

    return { imports, preamble, entryPoint, epilogue }
  }
}
