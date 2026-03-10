import type { SemanticNode } from '../../core/types'
import type { DependencyResolver } from '../../core/dependency-resolver'
import type { ProgramScaffold, ScaffoldConfig, ScaffoldResult, ScaffoldItem } from '../../core/program-scaffold'
import { resolveVisibility } from '../../core/program-scaffold'
import { collectConcepts } from './auto-include'
import { expandHeaderAliases } from './header-aliases'

export class CppScaffold implements ProgramScaffold {
  private resolver: DependencyResolver
  constructor(resolver: DependencyResolver) {
    this.resolver = resolver
  }

  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult {
    const { cognitiveLevel, manualImports = [], pinnedItems = [] } = config
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
      const visibility = resolveVisibility(cognitiveLevel, pinned)
      return {
        code,
        visibility,
        reason: visibility === 'ghost' ? `因為你用了 ${edge.reason}` : undefined,
        section: 'imports' as const,
        pinned: pinned || undefined,
      }
    })

    const preambleCode = 'using namespace std;'
    const preamblePinned = pinnedItems.includes(preambleCode)
    const preamble: ScaffoldItem[] = [{
      code: preambleCode,
      visibility: resolveVisibility(cognitiveLevel, preamblePinned),
      reason: resolveVisibility(cognitiveLevel, preamblePinned) === 'ghost' ? '標準函式庫需要' : undefined,
      section: 'preamble',
      pinned: preamblePinned || undefined,
    }]

    const entryCode = 'int main() {'
    const entryPinned = pinnedItems.includes(entryCode)
    const entryPoint: ScaffoldItem[] = [{
      code: entryCode,
      visibility: resolveVisibility(cognitiveLevel, entryPinned),
      reason: resolveVisibility(cognitiveLevel, entryPinned) === 'ghost' ? '程式進入點' : undefined,
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
        visibility: resolveVisibility(cognitiveLevel, returnPinned),
        reason: resolveVisibility(cognitiveLevel, returnPinned) === 'ghost' ? '程式正常結束' : undefined,
        section: 'epilogue',
        pinned: returnPinned || undefined,
      },
      {
        code: closeCode,
        visibility: resolveVisibility(cognitiveLevel, closePinned),
        reason: resolveVisibility(cognitiveLevel, closePinned) === 'ghost' ? 'main 函式結尾' : undefined,
        section: 'epilogue',
        pinned: closePinned || undefined,
      },
    ]

    return { imports, preamble, entryPoint, epilogue }
  }
}
