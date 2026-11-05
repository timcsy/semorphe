# 只拿面板：積木 ⇄ 程式碼

**這個例子證明一件事**：不經 `app.ts`，只靠出貨的兩支套件，就組得出「積木 ⇄ 程式碼」的即時互轉
——積木那一格是**我們的面板**（`panelById('blocks').mount(...)`），程式碼那一格是一個 `<textarea>`。

```bash
npm run build:sdk                          # dist-sdk/semorphe.mjs（核心）＋ panels.mjs（面板，Blockly 是 peer）
node examples/panels-only/build.mjs        # 用 esbuild 建（不經 Vite）
```

`src/assemble.ts` 匯出 `assemble({ blocksEl, codeEl, wasmDir })`，回傳 `codeToBlocks(code)`／`blocksToCode()`。
護欄 `tests/integration/audit-panels-only.test.ts` 在一個 DOM 裡跑它：貼一段 C++ → 工作區有積木（含 if）→ 改一顆數字欄位 → textarea 跟著變。

## 量到的事（第 286 刀）

- **積木定義的註冊原本住在 `src/ui/`**（`BlockRegistrar` 與五個輔助檔）——面板自己 mount 了，而「畫得出一顆真的積木」的前提還在殼層。
  這一刀把它們搬進 `src/panels/blocks/`。
- **組裝仍有約 50 行**（語言套件、積木登錄表、翻譯表、lift ＋ 渲染策略、渲染器設定點、匯流排）——與 `bring-your-own-view` 的那 30 行是同一個發現：
  還沒有一個「給我一具引擎」的入口。記在 `knowledge/draft/2026-08-24-可嵌入與可插拔的四個軸.md`。
- 程式碼那一格**沒有用 `panelById('code')`**：它只是 `profile.createCodeView(container)`，而 `CodeView` 介面有十二個必要方法（為 Monaco／VSCode 設計）；
  一個只要互轉的頁面，用 `ViewHost`（五個成員）就夠了。
