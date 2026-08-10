# Implementation Plan：執行那一路的誠實降級

**Branch**: `109-execution-honest-degradation` ｜ **Spec**: [spec.md](spec.md)

## Summary

修五個根因，全部已定位到單行或單一缺口：

| # | 根因 | 位置 | 涵蓋 |
|---|---|---|---|
| 1 | `char` 轉型取字串首字元 | `interpreter.ts:389` | ~2 筆 |
| 2 | 浮點沒有 C++ 的預設六位有效數字 | `types.ts:144` | ~4 筆 |
| 3 | `catch` 把 RuntimeValue 字串化 | `control-flow.ts:143` | 2 筆 |
| 4 | `cpp:range_sum` 是回傳 0 的空實作 | `numeric/executors.ts:54` | 1 筆 |
| 5 | **`constructorOf` 零呼叫者** | `struct-types.ts:96` | ~7 筆 |

## Technical Context

| | |
|---|---|
| 語言／測試 | TypeScript 5.x ／ Vitest |
| 新增依賴 | **無** |
| 量測 | 第三十二條護欄（`specs/108`），基線 31 |

無 NEEDS CLARIFICATION——五個根因全部實測定位。

## Constitution Check

| 原則 | 判定 |
|---|---|
| **I. 簡約優先** | ✅ 五個修法全是**改既有的錯**，不新增抽象。FR-011 明文禁止新增宣告值 |
| **II. TDD** | ✅ 每個根因**先寫會紅的回歸測試**，再修。這一輪的紅是真的紅（缺陷存在） |
| **III. Git 紀律** | ✅ **一個根因一個 commit**——根因 5 接的是零覆蓋的路徑 |
| **IV. 規格保護** | ✅ |
| **V. 繁中優先** | ✅ |

## Phase 0：Research ✅（已在規劃時完成，見 spec）

五個根因全部有實測與行號。最關鍵的一條是**第一版 spec 的前提被推翻**：
`執行機構.md:168` 說「不支援 OOP」，而 071/072/073 已經實作，
`OOP_NOT_IMPLEMENTED` 現在是空陣列——真正的缺口是 `constructorOf` 沒人呼叫。

## Phase 1：Design ✅

### 修法（各一句話）

1. **char**：數值來源用碼位還原成字元，字串來源取首字元（與 `cctype/charOf` 同形狀）
2. **浮點**：預設六位有效數字並去尾零（`cout << 1.0` → `1`，`1.0/3` → `0.333333`）
3. **catch**：把 `ThrownSignal` 的原值直接宣告進 scope，不經字串化
4. **range_sum**：真的把範圍加總，解析不了時**擲錯**（與同檔 `resolveRange` 一致）
5. **建構子**：變數宣告為類別型別時，查 `constructorOf` 並執行；帶引數的宣告走同一條路

### 順序

```
1 → 2 → 3 → 4   彼此獨立，可任意順序（都是單行）
5               最後做，因為它接的是**零覆蓋**的路徑
```

## Complexity Tracking

無需要辯護的違規。
