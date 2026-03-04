/** I/O 偏好 */
export type IoPreference = 'iostream' | 'cstdio'

/** 命名慣例 */
export type NamingConvention = 'camelCase' | 'snake_case' | 'PascalCase'

/** 大括號風格 */
export type BraceStyle = 'K&R' | 'Allman'

/** 標頭檔風格 */
export type HeaderStyle = 'iostream' | 'bits'

/** CodingStyle — 編碼風格的完整配置（呈現資訊，不影響語義） */
export interface CodingStyle {
  readonly id: string
  readonly nameKey: string
  ioPreference: IoPreference
  namingConvention: NamingConvention
  braceStyle: BraceStyle
  indent: number
  useNamespaceStd: boolean
  headerStyle: HeaderStyle
}

/** 預設風格 preset ID */
export type StylePresetId = 'apcs' | 'competitive' | 'google'

/** 風格偵測結果 */
export interface StyleDetectionResult {
  detected: Partial<CodingStyle>
  closestPreset?: StylePresetId
  confidence: number
}

/** 預設風格定義 */
export const STYLE_PRESETS: Record<StylePresetId, CodingStyle> = {
  apcs: {
    id: 'apcs',
    nameKey: 'style.apcs',
    ioPreference: 'iostream',
    namingConvention: 'camelCase',
    braceStyle: 'K&R',
    indent: 4,
    useNamespaceStd: true,
    headerStyle: 'iostream',
  },
  competitive: {
    id: 'competitive',
    nameKey: 'style.competitive',
    ioPreference: 'cstdio',
    namingConvention: 'snake_case',
    braceStyle: 'K&R',
    indent: 4,
    useNamespaceStd: true,
    headerStyle: 'bits',
  },
  google: {
    id: 'google',
    nameKey: 'style.google',
    ioPreference: 'iostream',
    namingConvention: 'snake_case',
    braceStyle: 'K&R',
    indent: 2,
    useNamespaceStd: false,
    headerStyle: 'iostream',
  },
}

/** 風格管理器介面 */
export interface StyleManager {
  getPresets(): CodingStyle[]
  getPreset(id: StylePresetId): CodingStyle
  getActive(): CodingStyle
  setActive(style: CodingStyle): void
  detectFromCode(code: string): StyleDetectionResult
}

/** StyleManager 實作 */
export class StyleManagerImpl implements StyleManager {
  private activeStyle: CodingStyle = STYLE_PRESETS.apcs
  private detectFn: ((code: string) => Partial<CodingStyle>) | null = null

  /** Set the style detection function (from parser) */
  setDetectFunction(fn: (code: string) => Partial<CodingStyle>): void {
    this.detectFn = fn
  }

  getPresets(): CodingStyle[] {
    return Object.values(STYLE_PRESETS)
  }

  getPreset(id: StylePresetId): CodingStyle {
    return STYLE_PRESETS[id]
  }

  getActive(): CodingStyle {
    return this.activeStyle
  }

  setActive(style: CodingStyle): void {
    this.activeStyle = style
  }

  setActiveById(id: StylePresetId): void {
    this.activeStyle = STYLE_PRESETS[id]
  }

  detectFromCode(code: string): StyleDetectionResult {
    if (!this.detectFn) {
      return { detected: {}, confidence: 0 }
    }
    const detected = this.detectFn(code)
    const closestPreset = this.findClosestPreset(detected)
    return { detected, closestPreset, confidence: closestPreset ? 0.8 : 0.3 }
  }

  private findClosestPreset(detected: Partial<CodingStyle>): StylePresetId | undefined {
    let bestId: StylePresetId | undefined
    let bestScore = 0
    for (const [id, preset] of Object.entries(STYLE_PRESETS)) {
      let score = 0
      if (detected.ioPreference === preset.ioPreference) score++
      if (detected.indent === preset.indent) score++
      if (detected.useNamespaceStd === preset.useNamespaceStd) score++
      if (detected.headerStyle === preset.headerStyle) score++
      if (score > bestScore) {
        bestScore = score
        bestId = id as StylePresetId
      }
    }
    return bestId
  }
}
