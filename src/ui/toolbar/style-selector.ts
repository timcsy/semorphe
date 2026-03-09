import type { StylePreset } from '../../core/types'

export class StyleSelector {
  private select: HTMLSelectElement
  private styles: StylePreset[]
  private onChangeCallback: ((style: StylePreset) => void) | null = null

  constructor(parent: HTMLElement, styles: StylePreset[]) {
    this.styles = styles
    this.select = document.createElement('select')
    this.select.className = 'toolbar-select'
    this.select.title = '程式碼風格'

    for (const style of styles) {
      const option = document.createElement('option')
      option.value = style.id
      option.textContent = style.name['zh-TW'] || style.name['en'] || style.id
      this.select.appendChild(option)
    }

    this.select.addEventListener('change', () => {
      const selected = this.styles.find(s => s.id === this.select.value)
      if (selected) this.onChangeCallback?.(selected)
    })

    parent.appendChild(this.select)
  }

  onChange(callback: (style: StylePreset) => void): void {
    this.onChangeCallback = callback
  }

  getCurrentStyle(): StylePreset {
    return this.styles.find(s => s.id === this.select.value) ?? this.styles[0]
  }

  setValue(styleId: string): void {
    this.select.value = styleId
  }
}
