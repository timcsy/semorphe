# Semorphe VSCode Extension

在 VSCode 中使用積木編輯 C++ 程式碼。

## 安裝

```bash
cd vscode-ext
npm install
node esbuild.mjs
```

### 安裝為 VSIX（需要 vsce）

```bash
npx vsce package
code --install-extension semorphe-vscode-0.1.0.vsix
```

### 開發模式

1. 在 VSCode 中開啟 `vscode-ext/` 資料夾
2. 按 F5 啟動 Extension Development Host
3. 在新視窗中開啟 `.cpp` 檔案
4. 執行命令 `Semorphe: Toggle Blocks Panel`

## 使用方式

1. 開啟任意 C++ 檔案
2. 點擊編輯器標題欄的積木按鈕，或執行命令 `Semorphe: Toggle Blocks Panel`
3. 積木面板會顯示程式碼對應的積木
4. 修改程式碼 → 積木自動更新
5. 修改積木 → 程式碼自動更新

## 設定

- `semorphe.cognitiveLevel`：控制工具箱顯示的積木層級
  - `0`：初學（基本 I/O、變數、簡單控制流）
  - `1`：進階（邏輯運算、函式、迴圈）
  - `2`：完整（陣列、指標、語言特定）

## 已知限制

- 僅支援 C/C++ 檔案
- 語法錯誤的程式碼可能無法完全轉換為積木
- 複雜的 C++ 特性（模板、巨集、指標運算）可能降級為原始碼積木
- Extension Host 需要載入 WASM，首次啟動可能需要數秒
