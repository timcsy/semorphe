import type { StdModule } from './types'
import type { DependencyEdge, DependencyResolver } from '../../../core/dependency-resolver'

export class ModuleRegistry implements DependencyResolver {
  private modules = new Map<string, StdModule>()
  private conceptToHeader = new Map<string, string>()

  register(mod: StdModule): void {
    this.modules.set(mod.header, mod)
    for (const concept of mod.concepts) {
      this.conceptToHeader.set(concept.conceptId, mod.header)
    }
  }

  registerConceptMapping(conceptId: string, header: string): void {
    this.conceptToHeader.set(conceptId, header)
  }

  getHeaderForConcept(conceptId: string): string | null {
    return this.conceptToHeader.get(conceptId) ?? null
  }

  resolve(conceptIds: string[]): DependencyEdge[] {
    const seen = new Map<string, DependencyEdge>()
    for (const id of conceptIds) {
      const header = this.conceptToHeader.get(id)
      if (header && !seen.has(header)) {
        seen.set(header, {
          directive: `#include ${header}`,
          sourceType: 'stdlib',
          header,
          reason: id,
        })
      }
    }
    return [...seen.values()].sort((a, b) => a.header.localeCompare(b.header))
  }

  getModule(header: string): StdModule | undefined {
    return this.modules.get(header)
  }

  getAllModules(): StdModule[] {
    return [...this.modules.values()]
  }
}
