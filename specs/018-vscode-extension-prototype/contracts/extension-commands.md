# Extension 命令與設定契約

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10

## 命令

### `codeBlockly.toggleBlocksPanel`

切換積木面板的顯示/隱藏。

- **觸發方式**: 命令面板、快捷鍵、編輯器標題欄按鈕
- **前置條件**: Extension 已啟動
- **行為**:
  - 如果面板不存在 → 建立 WebView 面板並顯示
  - 如果面板已存在且可見 → 隱藏面板
  - 如果面板已存在但被隱藏 → 顯示面板

## 設定

### `codeBlockly.cognitiveLevel`

控制積木工具箱顯示的認知層級。

- **型別**: `number`
- **預設值**: `1`
- **可選值**: `0`（初學）、`1`（進階）、`2`（完整）
- **範圍**: `window`（每個 VSCode 視窗獨立）
- **變更行為**: 發送 `config:level` 到 WebView，工具箱立即更新

## 啟動事件

```jsonc
"activationEvents": [
  "onLanguage:cpp",
  "onLanguage:c"
]
```

Extension 在使用者首次開啟 C/C++ 檔案時啟動。

## 編輯器標題欄按鈕

```jsonc
"menus": {
  "editor/title": [{
    "command": "codeBlockly.toggleBlocksPanel",
    "when": "resourceLangId =~ /^(cpp|c)$/",
    "group": "navigation"
  }]
}
```

僅在 C/C++ 檔案的編輯器標題欄顯示「積木面板」按鈕。
