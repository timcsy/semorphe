/**
 * Auto-include engine
 *
 * Scans a semantic tree to collect all concept IDs, then queries
 * DependencyResolver to determine which #include headers are required.
 * Merges with manually placed #include blocks (deduplication).
 */
import type { SemanticNode } from '../../core/types'
import type { DependencyResolver, DependencyEdge } from '../../core/dependency-resolver'
import { expandHeaderAliases, normalizeHeader } from './header-aliases'

/**
 * Collect all concept IDs from a semantic tree (recursive).
 */
export function collectConcepts(node: SemanticNode, out: Set<string>): void {
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
  return expandHeaderAliases(manual)
}

/**
 * Compute the set of #include headers required by the semantic tree,
 * based on concepts used and their module membership.
 *
 * Returns sorted, deduplicated DependencyEdge list excluding any already
 * present as manual #include blocks in the program body.
 */
export function computeAutoIncludes(
  root: SemanticNode,
  resolver: DependencyResolver,
): DependencyEdge[] {
  const concepts = new Set<string>()
  collectConcepts(root, concepts)

  const edges = resolver.resolve([...concepts])

  // Exclude headers already manually included
  const body = root.children.body ?? []
  const manual = collectManualIncludes(body)

  return edges.filter(e => !manual.has(e.header))
}

/**
 * Create a code patcher that fixes missing scaffold items (#include, using namespace, int main)
 * based on concepts used in the semantic tree.
 */
export function createCppCodePatcher(
  resolver: DependencyResolver,
): (code: string, tree: SemanticNode, namespaceStyle: 'using' | 'explicit', cogLevel?: number) => string | null {
  return (code, tree, namespaceStyle, cogLevel = 1) => {
    const concepts = new Set<string>()
    collectConcepts(tree, concepts)
    const edges = resolver.resolve([...concepts])
    let changed = false
    let patched = code

    // 1. Patch missing #include directives (also check C/C++ header equivalents)
    const existingHeaders = new Set<string>()
    const includeRe = /#include\s*[<"]([^>"]+)[>"]/g
    let m: RegExpExecArray | null
    while ((m = includeRe.exec(code)) !== null) {
      existingHeaders.add(normalizeHeader(m[1]))
    }
    const missingIncludes = edges.filter(e => !existingHeaders.has(normalizeHeader(e.header)))
    if (missingIncludes.length > 0) {
      const patch = missingIncludes.map(e => e.directive).join('\n') + '\n'
      const idx = patched.indexOf('#include')
      patched = idx >= 0 ? patched.slice(0, idx) + patch + patched.slice(idx) : patch + patched
      changed = true
    }

    // 2. Patch missing using namespace std
    if (namespaceStyle === 'using' && edges.length > 0 && !patched.includes('using namespace std')) {
      const lines = patched.split('\n')
      const lastInc = lines.reduce((a, l, i) => l.trimStart().startsWith('#include') ? i : a, -1)
      lines.splice(lastInc + 1, 0, 'using namespace std;')
      patched = lines.join('\n')
      changed = true
    }

    // 3. Patch missing int main() wrapper (L0 only — scaffold manages main)
    if (cogLevel === 0 && !patched.includes('int main(')) {
      // Extract header lines (#include, using namespace, blank) and body
      const lines = patched.split('\n')
      const headerEnd = lines.reduce((a, l, i) => {
        const t = l.trim()
        return (t.startsWith('#include') || t.startsWith('using ') || t === '') ? i + 1 : a
      }, 0)
      const header = lines.slice(0, headerEnd).join('\n')
      const bodyLines = lines.slice(headerEnd).filter(l => l.trim() !== '')
      const indented = bodyLines.map(l => '    ' + l).join('\n')
      patched = (header ? header + '\n' : '') +
        'int main() {\n' + (indented ? indented + '\n' : '') + '    return 0;\n}'
      changed = true
    }

    return changed ? patched : null
  }
}
