# postMessage 通訊協議

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10

## 概述

Extension Host（Node.js）與 Blocks WebView（瀏覽器）之間透過 VSCode 的 `postMessage` API 通訊。所有訊息遵循統一的信封格式。

## 信封格式

```typescript
interface BridgeMessage {
  command: string
  data: unknown
}
```

## Extension Host → WebView

### `semantic:update`

語義樹更新時推送，WebView 據此重新渲染積木。

```typescript
{
  command: 'semantic:update',
  data: {
    tree: SemanticNode       // 完整語義樹
    blockState?: object      // 可選的 Blockly 序列化狀態（優先使用）
    source: 'code'           // 變更來源
  }
}
```

### `config:level`

認知層級變更時推送。

```typescript
{
  command: 'config:level',
  data: {
    level: 0 | 1 | 2
  }
}
```

### `document:switch`

作用中文件切換時推送。

```typescript
{
  command: 'document:switch',
  data: {
    uri: string
    tree?: SemanticNode
    blockState?: object
  }
}
```

### `document:empty`

無作用中的 C++ 文件時推送（切換到非 C++ 檔案）。

```typescript
{
  command: 'document:empty',
  data: {}
}
```

## WebView → Extension Host

### `edit:blocks`

使用者在 WebView 中修改積木後發送。

```typescript
{
  command: 'edit:blocks',
  data: {
    blocklyState: object       // Blockly 序列化狀態
    semanticTree: SemanticNode  // 從積木提取的語義樹
  }
}
```

### `webview:ready`

WebView 初始化完成，通知 Extension Host 可開始推送資料。

```typescript
{
  command: 'webview:ready',
  data: {}
}
```

## 同步時序

```
1. WebView 載入完成 → 發送 webview:ready
2. Extension Host 收到 → lift 當前文件 → 發送 semantic:update
3. WebView 收到 → 渲染積木

--- 使用者編輯程式碼 ---
4. onDidChangeTextDocument 觸發
5. Extension Host lift → 發送 semantic:update
6. WebView 更新積木

--- 使用者修改積木 ---
7. WebView 偵測 Blockly workspace 變更
8. 提取語義樹 → 發送 edit:blocks
9. Extension Host generate 程式碼 → WorkspaceEdit.applyEdit()
10. onDidChangeTextDocument 觸發（但被 _isApplyingEdit flag 跳過）
```

## 錯誤處理

- 如果 lift 失敗（語法錯誤），Extension Host 仍發送 `semantic:update` 但 tree 可能不完整
- 如果 WebView 尚未 ready 就收到 `semantic:update`，忽略（不會發生，因為 Extension Host 等待 `webview:ready`）
- 如果 `edit:blocks` 的 generate 失敗，Extension Host 不修改文件，不回覆錯誤（積木狀態仍保留）
