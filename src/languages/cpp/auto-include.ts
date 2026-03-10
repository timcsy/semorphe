/**
 * Auto-include engine
 *
 * Scans a semantic tree to collect all concept IDs, then queries
 * ModuleRegistry to determine which #include headers are required.
 * Merges with manually placed #include blocks (deduplication).
 */
import type { SemanticNode } from '../../core/types'
import type { ModuleRegistry } from './std/module-registry'

/**
 * Collect all concept IDs from a semantic tree (recursive).
 */
function collectConcepts(node: SemanticNode, out: Set<string>): void {
  out.add(node.concept)
  for (const children of Object.values(node.children)) {
    for (const child of children) {
      collectConcepts(child, out)
    }
  }
}

/**
 * Collect manually placed #include headers from the program's body.
 */
function collectManualIncludes(body: SemanticNode[]): Set<string> {
  const manual = new Set<string>()
  for (const node of body) {
    if (node.concept === 'cpp_include' && typeof node.properties.header === 'string') {
      manual.add(`<${node.properties.header}>`)
    }
  }
  return manual
}

/**
 * Compute the set of #include headers required by the semantic tree,
 * based on concepts used and their module membership.
 *
 * Returns sorted, deduplicated header list excluding any already
 * present as manual #include blocks in the program body.
 */
export function computeAutoIncludes(
  root: SemanticNode,
  registry: ModuleRegistry,
): string[] {
  const concepts = new Set<string>()
  collectConcepts(root, concepts)

  const requiredHeaders = registry.getRequiredHeaders([...concepts])

  // Exclude headers already manually included
  const body = root.children.body ?? []
  const manual = collectManualIncludes(body)

  return requiredHeaders.filter(h => !manual.has(h))
}
