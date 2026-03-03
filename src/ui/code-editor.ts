import { EditorView, basicSetup, type ViewUpdate } from 'codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { EditorState, type Extension, StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'

// Effect to set or clear highlight
const setHighlight = StateEffect.define<{ from: number; to: number } | null>()

// Decoration style for highlighted lines
const highlightMark = Decoration.line({ class: 'cm-highlighted-line' })

// StateField to manage highlight decorations
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(highlights, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        if (e.value === null) return Decoration.none
        const { from, to } = e.value
        const doc = tr.state.doc
        const decorations: ReturnType<typeof Decoration.line>[] = []
        for (let pos = from; pos <= to && pos <= doc.lines; pos++) {
          const line = doc.line(pos)
          decorations.push(highlightMark.range(line.from))
        }
        return Decoration.set(decorations)
      }
    }
    return highlights.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})

export class CodeEditor {
  private view: EditorView | null = null
  private container: HTMLElement
  private onChangeCallback: ((code: string) => void) | null = null
  private onCursorChangeCallback: ((line: number) => void) | null = null
  private suppressChange = false
  private extensions: Extension[] = []

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(): void {
    this.extensions = [
      basicSetup,
      cpp(),
      highlightField,
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged && !this.suppressChange && this.onChangeCallback) {
          this.onChangeCallback(update.state.doc.toString())
        }
        if (update.selectionSet && this.onCursorChangeCallback) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos).number - 1 // 0-based
          this.onCursorChangeCallback(line)
        }
      }),
    ]

    const state = EditorState.create({
      doc: '',
      extensions: this.extensions,
    })

    this.view = new EditorView({
      state,
      parent: this.container,
    })
  }

  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback
  }

  onCursorChange(callback: (line: number) => void): void {
    this.onCursorChangeCallback = callback
  }

  getCode(): string {
    return this.view?.state.doc.toString() ?? ''
  }

  setCode(code: string): void {
    if (!this.view) return
    this.suppressChange = true
    this.view.setState(EditorState.create({
      doc: code,
      extensions: this.extensions,
    }))
    this.suppressChange = false
  }

  /** Highlight lines (0-based startLine to endLine) */
  addHighlight(startLine: number, endLine: number): void {
    if (!this.view) return
    // Convert 0-based to 1-based for CodeMirror
    this.view.dispatch({
      effects: setHighlight.of({ from: startLine + 1, to: endLine + 1 }),
    })
  }

  /** Clear all highlights */
  clearHighlight(): void {
    if (!this.view) return
    this.view.dispatch({
      effects: setHighlight.of(null),
    })
  }

  dispose(): void {
    if (this.view) {
      this.view.destroy()
      this.view = null
    }
  }
}
