/**
 * **積木的外觀預設**（Scratch／經典／教學）——渲染器、密度、配色、行內接點。
 * 與語言無關：原本住在 `languages/style.ts`，spec 217 第三刀搬到核心，讓積木面板（`src/panels/blocks/`）只依賴核心。
 */
export type BlockStylePresetId = 'scratch' | 'classic' | 'teaching'

export interface BlockStylePreset {
  id: BlockStylePresetId
  nameKey: string
  renderer: 'zelos' | 'geras'
  density: 'compact' | 'normal' | 'spacious'
  colourScheme: 'scratch' | 'classic' | 'high_contrast'
  inputsInline: boolean
}

export const BLOCK_STYLE_PRESETS: Record<BlockStylePresetId, BlockStylePreset> = {
  scratch: {
    id: 'scratch',
    nameKey: 'BLOCK_STYLE_SCRATCH',
    renderer: 'zelos',
    density: 'compact',
    colourScheme: 'scratch',
    inputsInline: true,
  },
  classic: {
    id: 'classic',
    nameKey: 'BLOCK_STYLE_CLASSIC',
    renderer: 'geras',
    density: 'normal',
    colourScheme: 'classic',
    inputsInline: false,
  },
  teaching: {
    id: 'teaching',
    nameKey: 'BLOCK_STYLE_TEACHING',
    renderer: 'zelos',
    density: 'spacious',
    colourScheme: 'high_contrast',
    inputsInline: true,
  },
}
