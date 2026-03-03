# Quickstart: 概念式積木系統重新設計

**Feature**: 002-concept-blocks-redesign
**Date**: 2026-03-03

## 開發環境

```bash
# 安裝依賴
npm install

# 執行測試
npm test

# 啟動開發伺服器
npm run dev
```

## 專案結構（目標）

```
src/
├── core/                          # 語言無關的核心邏輯
│   ├── types.ts                   # 核心型別定義（BlockSpec, LanguageModule 等）
│   ├── block-registry.ts          # 積木註冊表（修改：加入 language 過濾）
│   ├── code-to-blocks.ts          # AST → 積木轉換骨架（修改：使用 LanguageAdapter）
│   └── converter.ts               # 轉換協調器（修改：注入 LanguageModule）
│
├── blocks/                        # 共用積木定義（新增）
│   └── universal.json             # 21 塊共用積木 JSON
│
├── languages/
│   └── cpp/                       # C/C++ 語言模組
│       ├── module.ts              # 新增：CppLanguageModule 實作
│       ├── adapter.ts             # 新增：CppLanguageAdapter 實作
│       ├── generator.ts           # 修改：支援共用積木生成
│       ├── parser.ts              # 不變
│       └── blocks/
│           ├── special.json       # C++ 特殊積木（三段式 for、指標、printf 等）
│           ├── advanced.json      # 進階 C++ 積木（STL 等）
│           └── io.json            # C++ I/O 積木（cout/cin/printf/scanf）
│
├── ui/
│   ├── App.ts                     # 修改：語言模組注入、語言切換
│   ├── blockly-editor.ts          # 修改：按語言過濾工具箱
│   ├── code-editor.ts             # 修改：支援高亮行
│   ├── sync-controller.ts         # 修改：攜帶 SourceMapping
│   └── storage.ts                 # 不變
│
└── main.ts                        # 不變
```

## 實作順序

1. **核心型別更新** — 修改 `BlockSpec`、新增 `LanguageModule`/`LanguageAdapter` 介面
2. **共用積木 JSON** — 建立 `src/blocks/universal.json`（21 塊）
3. **BlockRegistry 修改** — 加入 `language` 欄位過濾
4. **CppLanguageAdapter** — 將 C++ AST 欄位萃取邏輯從 `code-to-blocks.ts` 搬移過來
5. **CodeToBlocksConverter 重構** — 使用 LanguageAdapter 做映射
6. **CppGenerator 修改** — 支援共用積木的程式碼生成
7. **C++ 特殊積木** — 重新組織現有積木為 special + advanced + io
8. **UI 更新** — 語言選擇器、工具箱過濾
9. **雙向對照高亮** — SourceMapping + Blockly/CodeMirror 事件綁定
10. **測試與驗證** — 更新所有測試

## 關鍵檔案一覽

| 操作 | 檔案 | 說明 |
|------|------|------|
| 修改 | `src/core/types.ts` | 加入 `language` 欄位、新增介面 |
| 新增 | `src/blocks/universal.json` | 21 塊共用積木 |
| 修改 | `src/core/block-registry.ts` | 按 language 過濾 |
| 新增 | `src/languages/cpp/adapter.ts` | C++ AST 映射邏輯 |
| 新增 | `src/languages/cpp/module.ts` | C++ 語言模組 |
| 修改 | `src/core/code-to-blocks.ts` | 使用 LanguageAdapter |
| 修改 | `src/languages/cpp/generator.ts` | 支援共用積木生成 |
| 重組 | `src/languages/cpp/blocks/*.json` | 重新組織為特殊積木 |
| 修改 | `src/ui/App.ts` | 語言切換、模組注入 |
| 修改 | `src/ui/blockly-editor.ts` | 工具箱過濾 |
| 修改 | `src/ui/code-editor.ts` | 行高亮 |
| 修改 | `src/ui/sync-controller.ts` | SourceMapping |
