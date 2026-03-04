/** LocaleBundle — 一個語言環境的完整翻譯資料 */
export interface LocaleBundle {
  readonly localeId: string
  readonly blocks: Record<string, string>
  readonly types: Record<string, string>
}

/** LocaleLoader 介面 */
export interface LocaleLoaderInterface {
  load(localeId: string): Promise<LocaleBundle>
  getCurrentLocale(): string
  getAvailableLocales(): string[]
}

/** Blockly.Msg injection target */
export interface BlocklyMsg {
  [key: string]: string
}

/**
 * LocaleLoader — 載入 locale JSON 並注入 Blockly.Msg
 */
export class LocaleLoader implements LocaleLoaderInterface {
  private currentLocale = ''
  private bundles = new Map<string, LocaleBundle>()
  private blocklyMsg: BlocklyMsg | null = null

  /** Set the Blockly.Msg target object for injection */
  setBlocklyMsg(msg: BlocklyMsg): void {
    this.blocklyMsg = msg
  }

  async load(localeId: string): Promise<LocaleBundle> {
    // Check cache
    const cached = this.bundles.get(localeId)
    if (cached) {
      this.currentLocale = localeId
      this.injectToBlocklyMsg(cached)
      return cached
    }

    // Dynamic import based on locale ID
    let blocks: Record<string, string> = {}
    let types: Record<string, string> = {}

    try {
      const blocksModule = await import(`./${localeId}/blocks.json`)
      blocks = blocksModule.default ?? blocksModule
    } catch {
      // Fallback: empty blocks
    }

    try {
      const typesModule = await import(`./${localeId}/types.json`)
      types = typesModule.default ?? typesModule
    } catch {
      // Fallback: empty types
    }

    const bundle: LocaleBundle = { localeId, blocks, types }
    this.bundles.set(localeId, bundle)
    this.currentLocale = localeId
    this.injectToBlocklyMsg(bundle)
    return bundle
  }

  /** Load from pre-built bundle data (for testing or SSR) */
  loadFromData(localeId: string, blocks: Record<string, string>, types: Record<string, string>): LocaleBundle {
    const bundle: LocaleBundle = { localeId, blocks, types }
    this.bundles.set(localeId, bundle)
    this.currentLocale = localeId
    this.injectToBlocklyMsg(bundle)
    return bundle
  }

  getCurrentLocale(): string {
    return this.currentLocale
  }

  getAvailableLocales(): string[] {
    return ['zh-TW', 'en']
  }

  getBundle(localeId: string): LocaleBundle | undefined {
    return this.bundles.get(localeId)
  }

  /** Apply tooltip overrides from a language module */
  applyTooltipOverrides(overrides: Record<string, string>): void {
    if (!this.blocklyMsg) return
    for (const [key, value] of Object.entries(overrides)) {
      this.blocklyMsg[key] = value
    }
  }

  /** Inject type labels from a language module's TypeEntry[] */
  injectTypeLabels(types: Array<{ labelKey: string }>, msg: Record<string, string>): void {
    const target = this.blocklyMsg
    if (!target) return
    for (const t of types) {
      if (msg[t.labelKey]) {
        target[t.labelKey] = msg[t.labelKey]
      }
    }
  }

  /** Inject all keys from bundle into Blockly.Msg */
  private injectToBlocklyMsg(bundle: LocaleBundle): void {
    if (!this.blocklyMsg) return
    for (const [key, value] of Object.entries(bundle.blocks)) {
      this.blocklyMsg[key] = value
    }
    for (const [key, value] of Object.entries(bundle.types)) {
      this.blocklyMsg[key] = value
    }
  }
}
