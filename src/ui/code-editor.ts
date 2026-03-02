import { EditorView, basicSetup } from 'codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { EditorState } from '@codemirror/state'

export class CodeEditor {
  private view: EditorView | null = null
  private container: HTMLElement
  private onChangeCallback: ((code: string) => void) | null = null
  private suppressChange = false

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(): void {
    const state = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        cpp(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.suppressChange && this.onChangeCallback) {
            this.onChangeCallback(update.state.doc.toString())
          }
        }),
      ],
    })

    this.view = new EditorView({
      state,
      parent: this.container,
    })
  }

  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback
  }

  getCode(): string {
    return this.view?.state.doc.toString() ?? ''
  }

  setCode(code: string): void {
    if (!this.view) return
    this.suppressChange = true
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: code,
      },
    })
    this.suppressChange = false
  }

  dispose(): void {
    if (this.view) {
      this.view.destroy()
      this.view = null
    }
  }
}
