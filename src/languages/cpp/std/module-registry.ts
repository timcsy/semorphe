import type { StdModule } from './types'

export class ModuleRegistry {
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

  getRequiredHeaders(conceptIds: string[]): string[] {
    const headers = new Set<string>()
    for (const id of conceptIds) {
      const header = this.conceptToHeader.get(id)
      if (header) headers.add(header)
    }
    return [...headers].sort()
  }

  getModule(header: string): StdModule | undefined {
    return this.modules.get(header)
  }

  getAllModules(): StdModule[] {
    return [...this.modules.values()]
  }
}
