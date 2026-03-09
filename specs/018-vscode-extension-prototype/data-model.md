# 資料模型：VSCode Extension 原型

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10

## 實體

### ExtensionState

Extension 層級的狀態，跨 WebView 生命週期維持。

| 欄位 | 型別 | 說明 |
|------|------|------|
| activeDocumentUri | string \| null | 當前作用中 C++ 文件的 URI |
| cognitiveLevel | 0 \| 1 \| 2 | 認知層級設定 |
| panelVisible | boolean | 積木面板是否可見 |

儲存位置：`context.workspaceState`（VSCode 提供）

### DocumentSession

每個 C++ 文件對應一個 session，管理該文件的語義狀態。

| 欄位 | 型別 | 說明 |
|------|------|------|
| uri | string | 文件 URI（唯一鍵） |
| semanticTree | SemanticNode \| null | 當前語義樹 |
| blocklyState | object \| null | Blockly 序列化狀態（供 WebView 恢復） |
| lastSyncSource | 'code' \| 'blocks' | 最後一次同步的來源 |

儲存位置：記憶體中（Extension Host）

### BridgeMessage

Extension Host ↔ WebView 之間的訊息格式。

| 欄位 | 型別 | 說明 |
|------|------|------|
| command | string | 訊息命令名稱 |
| data | unknown | 訊息負載 |

## 訊息命令清單

### Extension Host → WebView

| command | data 型別 | 說明 |
|---------|----------|------|
| `semantic:update` | `{ tree, blockState, source }` | 語義樹更新，WebView 據此更新積木 |
| `config:level` | `{ level: CognitiveLevel }` | 認知層級變更 |
| `document:switch` | `{ uri, tree?, blockState? }` | 切換到新文件 |
| `document:empty` | `{}` | 無作用中的 C++ 文件 |

### WebView → Extension Host

| command | data 型別 | 說明 |
|---------|----------|------|
| `edit:blocks` | `{ blocklyState, semanticTree }` | 積木被修改，發送新狀態 |
| `webview:ready` | `{}` | WebView 初始化完成，可接收資料 |

## 狀態轉換

```
使用者開啟 .cpp → Extension 啟動 → DocumentSession 建立
  → 使用者開啟積木面板 → WebView 建立 → webview:ready
  → Extension Host lift 程式碼 → semantic:update → WebView 顯示積木

使用者編輯程式碼 → onDidChangeTextDocument → lift → semantic:update → WebView 更新積木

使用者修改積木 → edit:blocks → Extension Host generate 程式碼 → WorkspaceEdit → 程式碼更新

使用者切換文件 → document:switch（帶語義樹）或 document:empty

使用者關閉面板 → WebView dispose → 清理資源
```
