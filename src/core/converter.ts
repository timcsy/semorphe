import type { NewLanguageModule, LanguageRegistry as ILanguageRegistry } from '../languages/types'

/**
 * LanguageRegistryImpl — 管理已註冊的語言模組，提供 active 語言切換。
 */
export class LanguageRegistryImpl implements ILanguageRegistry {
  private modules = new Map<string, NewLanguageModule>()
  private activeId = ''

  register(module: NewLanguageModule): void {
    this.modules.set(module.languageId, module)
    if (!this.activeId) {
      this.activeId = module.languageId
    }
  }

  get(languageId: string): NewLanguageModule | undefined {
    return this.modules.get(languageId)
  }

  getAvailableLanguages(): string[] {
    return Array.from(this.modules.keys())
  }

  getActive(): NewLanguageModule {
    const mod = this.modules.get(this.activeId)
    if (!mod) throw new Error(`No active language module (activeId=${this.activeId})`)
    return mod
  }

  setActive(languageId: string): void {
    if (!this.modules.has(languageId)) {
      throw new Error(`Language module '${languageId}' not registered`)
    }
    this.activeId = languageId
  }
}
