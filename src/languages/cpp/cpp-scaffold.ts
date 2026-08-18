import type { SemanticNode } from '../../core/types'
import type { DependencyResolver } from '../../core/dependency-resolver'
import type { ProgramScaffold, ScaffoldConfig, ScaffoldResult, ScaffoldItem } from '../../core/program-scaffold'
import { resolveVisibility } from '../../core/program-scaffold'
import { collectConcepts } from './auto-include'
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
  private entryShell: 'main' | 'none' = 'main'

  constructor(resolver: DependencyResolver, entryShell: 'main' | 'none' = 'main') {
    this.resolver = resolver
    this.entryShell = entryShell
  }

  /** 換目標時呼叫——⚠️ 換的是同一個實例，因為它被兩個地方持有（見 `ui/app.ts`）。 */
  setEntryShell(shell: 'main' | 'none'): void {
    this.entryShell = shell
  }

  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult {
    const { scaffoldDepth, manualImports = [], pinnedItems = [] } = config
    const manualSet = expandHeaderAliases(new Set(manualImports))

    // Collect concepts from semantic tree
    const concepts = new Set<string>()
    collectConcepts(tree, concepts)

    // Resolve dependencies and filter manual imports
    const edges = this.resolver.resolve([...concepts])
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

    // 🔴 沒有外殼 → **只留 imports**。
    if (this.entryShell === 'none') {
      return { imports, preamble: [], entryPoint: [], epilogue: [] }
    }

    const preambleCode = 'using namespace std;'
    const preamblePinned = pinnedItems.includes(preambleCode)
    const preamble: ScaffoldItem[] = [{
      code: preambleCode,
      visibility: resolveVisibility(scaffoldDepth, preamblePinned),
      reason: resolveVisibility(scaffoldDepth, preamblePinned) === 'ghost' ? '標準函式庫需要' : undefined,
      section: 'preamble',
      pinned: preamblePinned || undefined,
    }]

    const entryCode = 'int main() {'
    const entryPinned = pinnedItems.includes(entryCode)
    const entryPoint: ScaffoldItem[] = [{
      code: entryCode,
      visibility: resolveVisibility(scaffoldDepth, entryPinned),
      reason: resolveVisibility(scaffoldDepth, entryPinned) === 'ghost' ? '程式進入點' : undefined,
      section: 'entryPoint',
      pinned: entryPinned || undefined,
    }]

    const returnCode = '    return 0;'
    const closeCode = '}'
    const returnPinned = pinnedItems.includes(returnCode)
    const closePinned = pinnedItems.includes(closeCode)
    const epilogue: ScaffoldItem[] = [
      {
        code: returnCode,
        visibility: resolveVisibility(scaffoldDepth, returnPinned),
        reason: resolveVisibility(scaffoldDepth, returnPinned) === 'ghost' ? '程式正常結束' : undefined,
        section: 'epilogue',
        pinned: returnPinned || undefined,
      },
      {
        code: closeCode,
        visibility: resolveVisibility(scaffoldDepth, closePinned),
        reason: resolveVisibility(scaffoldDepth, closePinned) === 'ghost' ? 'main 函式結尾' : undefined,
        section: 'epilogue',
        pinned: closePinned || undefined,
      },
    ]

    return { imports, preamble, entryPoint, epilogue }
  }
}
