/**
 * Contract: CodingStyle — 編碼風格介面定義
 *
 * 編碼風格是程式碼投影的參數之一（P2）。
 * 影響程式碼的格式，不影響語義。
 *
 * @see ../spec.md US3
 * @see ../data-model.md CodingStyle
 */

// ============================================================
// CodingStyle — 編碼風格配置
// ============================================================

/** I/O 偏好 */
export type IoPreference = 'iostream' | 'cstdio'

/** 命名慣例 */
export type NamingConvention = 'camelCase' | 'snake_case' | 'PascalCase'

/** 大括號風格 */
export type BraceStyle = 'K&R' | 'Allman'

/** 標頭檔風格 */
export type HeaderStyle = 'iostream' | 'bits'

/**
 * CodingStyle — 編碼風格的完整配置
 *
 * 所有屬性都是呈現資訊（P4），不影響程式語義。
 * Generator 讀取此配置來決定程式碼的格式。
 */
export interface CodingStyle {
  /** 風格唯一識別碼 */
  readonly id: string
  /** 風格名稱的 i18n key */
  readonly nameKey: string
  /** I/O 偏好：iostream (cout/cin) 或 cstdio (printf/scanf) */
  ioPreference: IoPreference
  /** 命名慣例 */
  namingConvention: NamingConvention
  /** 大括號風格 */
  braceStyle: BraceStyle
  /** 縮排空格數 */
  indent: number
  /** 是否使用 using namespace std */
  useNamespaceStd: boolean
  /** 標頭檔風格 */
  headerStyle: HeaderStyle
}

// ============================================================
// Style Presets — 預設風格
// ============================================================

/**
 * 預設風格 preset ID
 *
 * - apcs: APCS 考試風格（cout/cin, camelCase, 4-space）
 * - competitive: 競賽風格（printf/scanf, snake_case, bits/stdc++.h）
 * - google: Google Style（cout/cin, snake_case, 2-space, no using namespace）
 */
export type StylePresetId = 'apcs' | 'competitive' | 'google'

// 預設值定義在 data-model.md 和 research.md R5 中

// ============================================================
// StyleDetectionResult — 風格偵測結果
// ============================================================

/**
 * 風格偵測結果。
 * Parser 分析程式碼後回傳偵測到的風格屬性。
 * 使用 Partial<CodingStyle> 因為不一定能偵測到所有屬性。
 */
export interface StyleDetectionResult {
  /** 偵測到的風格屬性（部分） */
  detected: Partial<CodingStyle>
  /** 最接近的預設 preset（如果有匹配的話） */
  closestPreset?: StylePresetId
  /** 偵測信心度（0-1） */
  confidence: number
}

// ============================================================
// StyleManager — 風格管理器介面
// ============================================================

/**
 * 風格管理器介面。
 * 管理風格 preset、切換、偵測。
 */
export interface StyleManager {
  /** 取得所有可用的 preset */
  getPresets(): CodingStyle[]
  /** 取得指定 preset */
  getPreset(id: StylePresetId): CodingStyle
  /** 取得當前啟用的風格 */
  getActive(): CodingStyle
  /** 設定當前風格 */
  setActive(style: CodingStyle): void
  /** 從程式碼偵測風格 */
  detectFromCode(code: string): StyleDetectionResult
}
