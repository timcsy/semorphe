# Quickstart: Phase 0 — 解耦基礎設施

## 開發環境

```bash
git checkout 014-decoupling-infra
npm install   # 無新依賴，但確保 node_modules 完整
```

## 快速驗證

```bash
npm run build   # tsc 編譯 — 確認零錯誤
npm test        # Vitest — 確認零 regression + 新測試通過
```

## 新增檔案一覽

| 檔案 | 用途 |
|------|------|
| `src/core/view-host.ts` | ViewHost + ViewCapabilities 介面定義 |
| `src/core/semantic-bus.ts` | SemanticBus class + 事件型別定義 |
| `tests/unit/core/view-host.test.ts` | ViewHost mock 實作驗證 |
| `tests/unit/core/semantic-bus.test.ts` | SemanticBus 功能測試 |

## 修改檔案一覽

| 檔案 | 變更 |
|------|------|
| `src/core/types.ts` | ConceptDef 新增 `annotations?` 欄位 |
| `src/core/concept-registry.ts` | 新增 `getAnnotation()` 方法 |
| `src/languages/cpp/blocks/basic.json` | for_loop, if 概念加 annotations 示範 |
| `src/languages/cpp/blocks/advanced.json` | func_def 概念加 annotations 示範 |
| `tests/unit/core/concept-registry.test.ts` | 新增 annotations 查詢測試 |

## 驗證 Checklist（對應 architecture-evolution.md §9）

```bash
# 1. 零 DOM import
grep -r "document\|window\|Blockly\|Monaco" src/core/view-host.ts src/core/semantic-bus.ts
# 預期：無輸出

# 2. 所有測試通過
npm test

# 3. Build 成功
npm run build
```

## 下一步

本 Phase 完成後，進入 Phase 1（SyncController 解耦）：
- SyncController 改為依賴 SemanticBus
- 面板 implements ViewHost
