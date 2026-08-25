import { LOCALES, FOLLOW_HOST_LOCALE } from '../../core/host/controls'
export class LocaleSelector {
  private select: HTMLSelectElement
  private onChangeCallback: ((locale: string) => void) | null = null

  constructor(parent: HTMLElement) {
    this.select = document.createElement('select')
    this.select.className = 'toolbar-select'
    this.select.title = '語言'

    // 🔴 **清單來自登錄表**（`core/host/controls.ts`）——宿主那側要同一份，
    //    而抄第二次就是讓「有哪些語系」有兩個真相。
    //
    // ⚠️ **而 `follow-host` 不在這一顆裡**：面板自己畫這顆下拉的宿主，
    //    正是那個「沒有宿主可跟」的（網頁版）。
    //
    // > **一個選了也沒有意義的選項，比少一個選項更糟
    // > ——使用者會以為自己選錯了。**
    for (const loc of LOCALES.filter((l) => l.id !== FOLLOW_HOST_LOCALE)) {
      const option = document.createElement('option')
      option.value = loc.id
      option.textContent = loc.label
      this.select.appendChild(option)
    }

    this.select.addEventListener('change', () => {
      this.onChangeCallback?.(this.select.value)
    })

    parent.appendChild(this.select)
  }

  onChange(callback: (locale: string) => void): void {
    this.onChangeCallback = callback
  }

  getLocale(): string {
    return this.select.value
  }
}
