# Implementation Plan: Python → C++（第一版）

**Branch**: `374-python-to-cpp` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

Python 語言套件的 `convertToLanguage(tree, 'cpp', types, …)`：拿 Cella 的 Python 型別表（`observedTypes`，在給定輸入上觀察到的型別）決定每個宣告的型別，Python 元件各自的 `to-cpp.ts` 寫出 C++；整支換或不換。產品流程多一步：換完把 C++ 交給 Cella 再判一次，與 Python 那次相同才放進編輯器（research R3）。

## Technical Context

TypeScript 5.x；依賴 Cella 下一版（`@cella-lang/python` 的 `python.observedTypes`，預估 11-09 晚上）。測試：Vitest（每顆的最小例、課文護欄 `python-to-cpp-verdict`）、Playwright（換目標的那一條路）。

## Constitution Check

I 簡約：第一版只做量到的子集（27／36），其餘保留 ✅ · II TDD：反例清單與課文護欄先寫 ✅ · P6：型別說不準、意思會變、換完判決不同 → 整支保留並說原因 ✅ · 意思歸 Cella：型別與等價都由 Cella 判 ✅

## Project Structure

```text
src/languages/python/python-to-cpp.ts          # 引擎（整支換或不換、宣告提前、補小函式）
src/languages/python/to-cpp/{contract,registry}.ts
src/components/python/<x>/to-cpp.ts             # 每顆的 C++ 寫法（約 20 顆）
src/providers/cella/…                            # observedTypes 的呼叫（等發布）
src/ui/app.ts                                    # 換目標：Python → C++ 時多一次 C++ 判決
tests/integration/python-to-cpp-verdict.test.ts # 課文護欄＋反例
tests/unit/languages/python/python-to-cpp.test.ts
e2e/python-to-cpp.spec.ts
```

## 分段

1. **不需要型別表的部分（今天）**：契約、登錄、引擎骨架（整支換或不換、原因清單、宣告提前、小函式）、每顆的 `to-cpp.ts`；單元測試用**手寫的型別表**（形狀照談定的）餵。
2. **接上 Cella（發布後）**：provider 呼叫 `observedTypes`、課文護欄（兩邊判決相同）、產品的二次判決、e2e。
