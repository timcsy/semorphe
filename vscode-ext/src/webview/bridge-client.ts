interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

export interface BridgeMessage {
  command: string
  data: unknown
}

let vscodeApi: VsCodeApi | null = null

function getApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi()
  }
  return vscodeApi
}

export function send(command: string, data: unknown): void {
  getApi().postMessage({ command, data })
}

export function onMessage(handler: (message: BridgeMessage) => void): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as BridgeMessage
    if (message && message.command) {
      handler(message)
    }
  })
}
