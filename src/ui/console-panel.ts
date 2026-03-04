import type { ExecutionStatus } from '../interpreter/types'

export class ConsolePanel {
  private element: HTMLElement
  private outputEl: HTMLElement
  private statusEl: HTMLElement
  private clearBtn: HTMLElement
  private inputEl: HTMLInputElement
  private inputContainer: HTMLElement
  private onInputResolve: ((value: string) => void) | null = null

  constructor(container: HTMLElement) {
    this.element = container

    // Header with title, status, and clear button
    const header = document.createElement('div')
    header.className = 'console-header'

    const leftGroup = document.createElement('div')
    leftGroup.className = 'console-header-left'
    const title = document.createElement('span')
    title.className = 'console-title'
    title.textContent = '終端機'
    leftGroup.appendChild(title)
    this.statusEl = document.createElement('span')
    this.statusEl.className = 'console-status'
    leftGroup.appendChild(this.statusEl)

    this.clearBtn = document.createElement('button')
    this.clearBtn.className = 'console-clear-btn'
    this.clearBtn.textContent = '清除'
    this.clearBtn.title = '清除輸出'
    this.clearBtn.addEventListener('click', () => this.clear())

    header.appendChild(leftGroup)
    header.appendChild(this.clearBtn)
    this.element.appendChild(header)

    // Output area
    this.outputEl = document.createElement('pre')
    this.outputEl.className = 'console-output'
    this.element.appendChild(this.outputEl)

    // Inline input (appears at bottom of console when input is needed)
    this.inputContainer = document.createElement('div')
    this.inputContainer.className = 'console-input-container'
    this.inputContainer.style.display = 'none'
    const inputLabel = document.createElement('span')
    inputLabel.className = 'console-input-label'
    inputLabel.textContent = '❯ '
    this.inputEl = document.createElement('input')
    this.inputEl.className = 'console-input'
    this.inputEl.type = 'text'
    this.inputEl.placeholder = '輸入值後按 Enter...'
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.onInputResolve) {
        const val = this.inputEl.value
        this.inputEl.value = ''
        this.inputContainer.style.display = 'none'
        this.appendOutput(val + '\n')
        const resolve = this.onInputResolve
        this.onInputResolve = null
        resolve(val)
      }
    })
    this.inputContainer.appendChild(inputLabel)
    this.inputContainer.appendChild(this.inputEl)
    this.element.appendChild(this.inputContainer)
  }

  appendOutput(text: string): void {
    this.outputEl.textContent += text
    this.outputEl.scrollTop = this.outputEl.scrollHeight
  }

  clear(): void {
    this.outputEl.textContent = ''
    this.hideInput()
  }

  setStatus(status: ExecutionStatus, errorMsg?: string): void {
    this.statusEl.className = 'console-status'
    switch (status) {
      case 'running':
        this.statusEl.textContent = '執行中'
        this.statusEl.classList.add('status-running')
        break
      case 'paused':
        this.statusEl.textContent = '等待輸入'
        this.statusEl.classList.add('status-paused')
        break
      case 'completed':
        this.statusEl.textContent = '已完成'
        this.statusEl.classList.add('status-completed')
        break
      case 'error':
        this.statusEl.textContent = errorMsg || '錯誤'
        this.statusEl.classList.add('status-error')
        break
      default:
        this.statusEl.textContent = ''
        break
    }
  }

  promptInput(): Promise<string> {
    return new Promise((resolve) => {
      this.onInputResolve = resolve
      this.inputContainer.style.display = 'flex'
      this.inputEl.focus()
    })
  }

  hideInput(): void {
    this.inputContainer.style.display = 'none'
    this.onInputResolve = null
    this.inputEl.value = ''
  }

  getElement(): HTMLElement {
    return this.element
  }
}
