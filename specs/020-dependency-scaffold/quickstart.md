# Quickstart: DependencyResolver + Program Scaffold 驗證指南

**Date**: 2026-03-10 | **Feature**: 020-dependency-scaffold

## 快速驗證步驟

### 1. 單元測試

```bash
npx vitest run tests/unit/core/dependency-resolver.test.ts
npx vitest run tests/unit/core/program-scaffold.test.ts
npx vitest run tests/unit/languages/cpp/module-registry.test.ts
npx vitest run tests/unit/languages/cpp/cpp-scaffold.test.ts
```

### 2. 整合測試

```bash
npx vitest run tests/integration/scaffold-codegen.test.ts
```

### 3. Regression 測試

```bash
npm test
```

### 4. 瀏覽器手動驗證

1. `npm run dev` 啟動開發伺服器
2. 拖入一個 `cout` 積木
3. 驗證程式碼面板顯示完整程式（含 `#include <iostream>`, `using namespace std;`, `int main() {`, `return 0;`）
4. 切換認知等級至 L1 → 驗證 boilerplate 行以淡灰色顯示
5. Hover 在 `#include <iostream>` 上 → 驗證顯示 tooltip「因為你用了 cout」
6. 切換至 L0 → 驗證 boilerplate 行被隱藏
7. 切換至 L2 → 驗證 boilerplate 以正常顏色顯示

### 5. 靜態驗證

```bash
# 核心介面不 import 語言專用模組
grep -r "languages/" src/core/dependency-resolver.ts src/core/program-scaffold.ts
# 預期：無輸出
```

## 關鍵測試案例

| 場景 | 輸入 | 預期輸出 |
|------|------|---------|
| 空概念 | `resolve([])` | `[]` |
| cout 依賴 | `resolve(['print'])` | `[{header: '<iostream>', sourceType: 'stdlib'}]` |
| 多依賴 | `resolve(['print', 'vector_declare'])` | iostream + vector 兩條邊 |
| L0 scaffold | `resolve(coutTree, {cognitiveLevel: 'L0'})` | 所有項目 hidden |
| L1 scaffold | `resolve(coutTree, {cognitiveLevel: 'L1'})` | 所有項目 ghost + reason |
| 手動 import 去重 | `resolve(tree, {manualImports: ['<iostream>']})` | imports 不含 iostream |
