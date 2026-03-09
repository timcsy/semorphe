import * as vscode from 'vscode'

export interface BridgeMessage {
  command: string
  data: unknown
}

export type MessageHandler = (message: BridgeMessage) => void

export class PostMessageBridge {
  private panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []

  constructor(panel: vscode.WebviewPanel) {
    this.panel = panel
  }

  send(command: string, data: unknown): void {
    this.panel.webview.postMessage({ command, data })
  }

  onMessage(handler: MessageHandler): void {
    const disposable = this.panel.webview.onDidReceiveMessage(
      (message: BridgeMessage) => handler(message)
    )
    this.disposables.push(disposable)
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose()
    }
    this.disposables = []
  }
}
