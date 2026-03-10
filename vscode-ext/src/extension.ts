import * as vscode from 'vscode'
import { SemanticCore } from './semantic-core'
import { DocumentSessionManager } from './document-session'
import { PostMessageBridge } from './postmessage-bridge'
import { TextSync } from './text-sync'
import { createOrShow, getPanel } from './blocks-panel'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import * as path from 'path'

// Style presets
import apcsPreset from '../../src/languages/cpp/styles/apcs.json'
import competitivePreset from '../../src/languages/cpp/styles/competitive.json'
import googlePreset from '../../src/languages/cpp/styles/google.json'

const STYLE_PRESETS: Record<string, StylePreset> = {
  apcs: apcsPreset as StylePreset,
  competitive: competitivePreset as StylePreset,
  google: googlePreset as StylePreset,
}

let semanticCore: SemanticCore | null = null
let sessionManager: DocumentSessionManager | null = null
let bridge: PostMessageBridge | null = null
let textSync: TextSync | null = null
let webviewReady = false
let extensionContext: vscode.ExtensionContext | null = null

// Track the last known C++ document (WebView focus steals activeTextEditor)
let trackedDocument: vscode.TextDocument | null = null

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Semorphe extension activating...')
  extensionContext = context

  semanticCore = new SemanticCore()
  sessionManager = new DocumentSessionManager()
  textSync = new TextSync()

  const wasmDir = path.join(context.extensionPath, 'dist')
  try {
    await semanticCore.init(wasmDir)
    console.log('Semorphe: SemanticCore initialized')
  } catch (err) {
    console.error('Semorphe: Failed to init SemanticCore:', err)
    vscode.window.showErrorMessage('Semorphe: 初始化失敗')
    return
  }

  // Register WebviewPanelSerializer for panel state restoration
  vscode.window.registerWebviewPanelSerializer('semorpheBlocks', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown) {
      setupPanelBridge(panel, context)
    },
  })

  // Register toggle command
  const toggleCmd = vscode.commands.registerCommand('semorphe.toggleBlocksPanel', () => {
    // Capture the active editor BEFORE creating the panel (panel steals focus)
    const editor = vscode.window.activeTextEditor
    if (editor && isCppDocument(editor.document)) {
      trackedDocument = editor.document
    }
    const panel = createOrShow(context.extensionUri)
    setupPanelBridge(panel, context)
    context.workspaceState.update('panelVisible', true)
  })
  context.subscriptions.push(toggleCmd)

  // Watch active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      handleEditorSwitch(editor)
    })
  )

  // Watch configuration changes for cognitive level and coding style
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('semorphe.cognitiveLevel')) {
        const level = getCognitiveLevel()
        if (bridge && webviewReady) {
          bridge.send('config:level', { level })
        }
      }
      if (event.affectsConfiguration('semorphe.codingStyle')) {
        const style = getCodingStyle()
        semanticCore?.setStyle(style)
        if (bridge && webviewReady) {
          bridge.send('config:style', { style })
        }
      }
    })
  )

  // Track initial editor
  const initialEditor = vscode.window.activeTextEditor
  if (initialEditor && isCppDocument(initialEditor.document)) {
    trackedDocument = initialEditor.document
  }

  // Auto-restore panel if it was visible
  const wasVisible = context.workspaceState.get<boolean>('panelVisible', false)
  if (wasVisible) {
    const panel = createOrShow(context.extensionUri)
    setupPanelBridge(panel, context)
  }

  console.log('Semorphe extension activated')
}

function getCognitiveLevel(): number {
  return vscode.workspace.getConfiguration('semorphe').get<number>('cognitiveLevel', 1)
}

function getCodingStyle(): StylePreset {
  const styleId = vscode.workspace.getConfiguration('semorphe').get<string>('codingStyle', 'apcs')
  return STYLE_PRESETS[styleId] ?? STYLE_PRESETS.apcs
}

function setupPanelBridge(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): void {
  bridge?.dispose()
  bridge = new PostMessageBridge(panel)
  webviewReady = false

  bridge.onMessage(async (message) => {
    switch (message.command) {
      case 'webview:ready':
        webviewReady = true
        bridge?.send('config:level', { level: getCognitiveLevel() })
        bridge?.send('config:style', { style: getCodingStyle() })
        await pushTrackedDocument()
        break

      case 'edit:blocks':
        await handleBlocksEdit(message.data as { semanticTree: SemanticNode; blocklyState: object })
        break

      case 'config:level:change': {
        const levelData = message.data as { level: number }
        await vscode.workspace.getConfiguration('semorphe').update('cognitiveLevel', levelData.level, vscode.ConfigurationTarget.Global)
        break
      }

      case 'config:style:change': {
        const styleData = message.data as { styleId: string }
        await vscode.workspace.getConfiguration('semorphe').update('codingStyle', styleData.styleId, vscode.ConfigurationTarget.Global)
        const style = STYLE_PRESETS[styleData.styleId]
        if (style) semanticCore?.setStyle(style)
        break
      }

      case 'request:code-to-blocks':
        await pushTrackedDocument()
        break
    }
  })

  // Start watching tracked document
  if (trackedDocument) {
    startDocumentSync(trackedDocument)
  }

  panel.onDidDispose(() => {
    bridge?.dispose()
    bridge = null
    textSync?.stopWatching()
    webviewReady = false
    extensionContext?.workspaceState.update('panelVisible', false)
  })
}

async function pushTrackedDocument(): Promise<void> {
  // Use tracked document (not activeTextEditor, which may be the webview)
  const doc = trackedDocument
  if (!doc) {
    bridge?.send('document:empty', {})
    return
  }

  const code = doc.getText()
  const tree = await liftCode(code, doc.uri.toString())
  if (tree && bridge) {
    bridge.send('semantic:update', { tree, source: 'code' })
  }
}

async function liftCode(code: string, uri: string): Promise<SemanticNode | null> {
  if (!semanticCore || !sessionManager) return null

  try {
    const tree = await semanticCore.lift(code)
    if (tree) {
      const session = sessionManager.getOrCreate(uri)
      session.semanticTree = tree
      session.lastSyncSource = 'code'
    }
    return tree
  } catch (err) {
    console.error('Semorphe: lift failed:', err)
    return null
  }
}

async function handleBlocksEdit(data: { semanticTree: SemanticNode; blocklyState: object }): Promise<void> {
  if (!semanticCore || !sessionManager || !trackedDocument) return

  const uri = trackedDocument.uri.toString()
  const session = sessionManager.getOrCreate(uri)
  session.semanticTree = data.semanticTree
  session.blocklyState = data.blocklyState
  session.lastSyncSource = 'blocks'

  const code = semanticCore.generate(data.semanticTree)
  await textSync?.applyCodeEdit(trackedDocument, code)
}

function startDocumentSync(document: vscode.TextDocument): void {
  textSync?.startWatching(document, async (code) => {
    if (!webviewReady || !bridge) return

    const tree = await liftCode(code, document.uri.toString())
    if (tree) {
      bridge.send('semantic:update', { tree, source: 'code' })
    }
  })
}

function handleEditorSwitch(editor: vscode.TextEditor | undefined): void {
  // Ignore when editor becomes undefined (e.g. webview takes focus)
  if (!editor) return

  if (!isCppDocument(editor.document)) {
    // Non-C++ file — only send empty if we had a tracked document
    if (trackedDocument) {
      textSync?.stopWatching()
      trackedDocument = null
      bridge?.send('document:empty', {})
    }
    return
  }

  // C++ file — update tracked document
  const prevUri = trackedDocument?.uri.toString()
  trackedDocument = editor.document
  textSync?.stopWatching()
  startDocumentSync(editor.document)

  // Push new document if it changed
  const newUri = editor.document.uri.toString()
  if (webviewReady && bridge && newUri !== prevUri) {
    const session = sessionManager?.get(newUri)
    if (session?.semanticTree) {
      bridge.send('document:switch', { uri: newUri, tree: session.semanticTree })
    } else {
      const code = editor.document.getText()
      liftCode(code, newUri).then((tree) => {
        if (tree && bridge) {
          bridge.send('document:switch', { uri: newUri, tree })
        }
      })
    }
  }
}

function isCppDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'cpp' || document.languageId === 'c'
}

export function deactivate(): void {
  bridge?.dispose()
  textSync?.stopWatching()
  semanticCore = null
  sessionManager = null
  bridge = null
  textSync = null
  trackedDocument = null
}
