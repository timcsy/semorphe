# Quickstart: Topic System

## 快速開始

### 1. 定義 Topic JSON

在 `src/languages/cpp/topics/` 新增 JSON 檔案：

```json
{
  "id": "cpp-beginner",
  "language": "cpp",
  "name": "初學 C++",
  "default": true,
  "levelTree": {
    "id": "L0",
    "level": 0,
    "label": "基礎",
    "concepts": ["print", "var_declare", "if", "while"],
    "children": [
      {
        "id": "L1a",
        "level": 1,
        "label": "函式",
        "concepts": ["func_def", "func_call", "for_loop"],
        "children": []
      }
    ]
  }
}
```

### 2. 註冊 Topic

Topic JSON 在語言模組初始化時自動載入並註冊到 TopicRegistry。

### 3. 使用 Topic

系統自動讀取語言的預設 Topic，根據使用者啟用的分支過濾 toolbox。

### 4. 新增 BlockOverride

在 Topic JSON 中加入 `blockOverrides`：

```json
{
  "blockOverrides": {
    "print": {
      "message": "Serial.print %1",
      "args": [
        { "name": "SERIAL_PORT", "type": "field_dropdown", "options": [["Serial", "Serial"]] }
      ]
    }
  }
}
```

## 開發流程

```bash
# 執行測試
npm test

# TypeScript 型別檢查
npx tsc --noEmit

# 啟動開發伺服器驗證 UI
npm run dev
```

## 關鍵檔案

| 用途 | 路徑 |
|------|------|
| Topic 型別定義 | `src/core/types.ts` |
| Topic 註冊表 | `src/core/topic-registry.ts` |
| 層級樹引擎 | `src/core/level-tree.ts` |
| BlockOverride 合併 | `src/core/block-override.ts` |
| Topic 選擇器 UI | `src/ui/toolbar/topic-selector.ts` |
| 層級樹 UI | `src/ui/toolbar/level-tree-selector.ts` |
| C++ Topic 定義 | `src/languages/cpp/topics/*.json` |
