import * as Blockly from 'blockly'
import type { BlockStylePreset, BlockStylePresetId } from '../../languages/style'
import { BLOCK_STYLE_PRESETS } from '../../languages/style'

export class BlockStyleSelector {
  /**
   * 有哪些積木風格可以選 —— 🔴 **投影到宿主時也要這一份**。
   *
   * ⚠️ 而組裝點（`ui/app.ts`）**不該為了拿它而多 import 一次語言套件**：
   * 那條相依已經有十筆具名豁免，第十一筆會被第六十條的棘輪擋下來
   * ——**而它擋得對**。
   *
   * > **需要一份清單的時候，先問「誰已經有了」，
   * > 而不是「我從哪裡 import」。**
   */
  static options(): { value: string; label: string }[] {
    const msg = Blockly.Msg as Record<string, string>
    return Object.values(BLOCK_STYLE_PRESETS).map((p) => ({
      value: p.id, label: msg[p.nameKey] || p.id,
    }))
  }

  /** 依 id 取得那一組設定。⚠️ 認不得就回 `null`——**不猜一個**。 */
  static byId(id: string): BlockStylePreset | null {
    return (BLOCK_STYLE_PRESETS as Record<string, BlockStylePreset>)[id] ?? null
  }

  /** 這一顆在狀態列上顯示的字。 */
  static labelOf(id: string): string {
    return (Blockly.Msg as Record<string, string>)[`BLOCK_STYLE_${id.toUpperCase()}`] || id
  }

  private select: HTMLSelectElement
  private onChangeCallback: ((preset: BlockStylePreset) => void) | null = null

  constructor(parent: HTMLElement) {
    this.select = document.createElement('select')
    this.select.className = 'toolbar-select'
    this.select.title = '積木風格'

    for (const preset of Object.values(BLOCK_STYLE_PRESETS)) {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = (Blockly.Msg as Record<string, string>)[preset.nameKey] || preset.id
      this.select.appendChild(option)
    }

    this.select.addEventListener('change', () => {
      const id = this.select.value as BlockStylePresetId
      const preset = BLOCK_STYLE_PRESETS[id]
      if (preset) this.onChangeCallback?.(preset)
    })

    parent.appendChild(this.select)
  }

  onChange(callback: (preset: BlockStylePreset) => void): void {
    this.onChangeCallback = callback
  }

  getCurrentPreset(): BlockStylePreset {
    const id = this.select.value as BlockStylePresetId
    return BLOCK_STYLE_PRESETS[id] ?? BLOCK_STYLE_PRESETS.scratch
  }
}
