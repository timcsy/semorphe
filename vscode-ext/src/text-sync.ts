import * as vscode from 'vscode'

export class TextSync {
  private disposable: vscode.Disposable | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private _isApplyingEdit = false
  private onCodeChangeCallback: ((code: string) => void) | null = null

  startWatching(document: vscode.TextDocument, onCodeChange: (code: string) => void): void {
    this.stopWatching()
    this.onCodeChangeCallback = onCodeChange

    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document !== document) return
      if (this._isApplyingEdit) return

      // Debounce: wait 300ms after last change
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        const code = document.getText()
        this.onCodeChangeCallback?.(code)
      }, 300)
    })
  }

  async applyCodeEdit(document: vscode.TextDocument, code: string): Promise<void> {
    this._isApplyingEdit = true
    try {
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      )
      const edit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, fullRange, code)
      await vscode.workspace.applyEdit(edit)
    } finally {
      // Delay clearing flag to let the change event pass
      setTimeout(() => { this._isApplyingEdit = false }, 50)
    }
  }

  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.disposable?.dispose()
    this.disposable = null
    this.onCodeChangeCallback = null
  }
}
