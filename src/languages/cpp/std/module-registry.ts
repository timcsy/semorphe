import type { StdModule } from './types'
import type { DependencyEdge, DependencyResolver } from '../../../core/dependency-resolver'

export class ModuleRegistry implements DependencyResolver {
  private modules = new Map<string, StdModule>()
  private componentToHeader = new Map<string, string>()

  register(mod: StdModule): void {
    this.modules.set(mod.header, mod)
    for (const component of mod.components) {
      this.componentToHeader.set(component.componentId, mod.header)
    }
  }

  registerComponentMapping(componentId: string, header: string): void {
    this.componentToHeader.set(componentId, header)
  }

  getHeaderForComponent(componentId: string): string | null {
    return this.componentToHeader.get(componentId) ?? null
  }

  resolve(componentIds: string[]): DependencyEdge[] {
    const seen = new Map<string, DependencyEdge>()
    for (const id of componentIds) {
      const header = this.componentToHeader.get(id)
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
