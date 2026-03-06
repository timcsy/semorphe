import * as monaco from 'monaco-editor'

export class MonacoPanel {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null
  private container: HTMLElement
  private onChangeCallback: ((code: string) => void) | null = null
  private suppressChange = false

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(readOnly = true): void {
    this.editor = monaco.editor.create(this.container, {
      value: '',
      language: 'cpp',
      theme: 'vs-dark',
      readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4,
      renderWhitespace: 'none',
      folding: true,
      glyphMargin: false,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
    })

    this.editor.onDidChangeModelContent(() => {
      if (!this.suppressChange && this.onChangeCallback) {
        this.onChangeCallback(this.getCode())
      }
    })
  }

  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback
  }

  getCode(): string {
    return this.editor?.getValue() ?? ''
  }

  setCode(code: string): void {
    if (!this.editor) return
    this.suppressChange = true
    this.editor.setValue(code)
    this.suppressChange = false
  }

  setReadOnly(readOnly: boolean): void {
    this.editor?.updateOptions({ readOnly })
  }

  dispose(): void {
    this.editor?.dispose()
    this.editor = null
  }
}
