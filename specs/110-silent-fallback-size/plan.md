# Implementation Plan：靜默回退掩蓋辨識歧義

**Spec**: [spec.md](spec.md)

## Summary

```
① 護欄  掃「檢查失敗 → 回傳預設值」，排順序不下結論      7 處（2 合法）
② 修    cpp:vector_size 對非容器出聲                    ← 讓 ① 的病灶現形
③ 修    .size() 依目標型別分派（字串 → cpp:string_size）  誤差 19 → 14
```

## Technical Context

| | |
|---|---|
| 語言／測試 | TypeScript 5.x ／ Vitest |
| 新增依賴 | 無 |
| 既有可複用 | `tests/helpers/guardrail.ts`、`listSourceFiles` |

## Constitution Check

| 原則 | 判定 |
|---|---|
| I. 簡約 | ✅ 三步都是改既有的錯，不新增抽象 |
| II. TDD | ✅ 先寫紅測試（`s.size()`→3、非容器要出聲），再修 |
| III. Git | ✅ 護欄／②／③ 各一個 commit |
| IV. 規格保護 | ✅ |
| V. 繁中 | ✅ |

## Phase 0：Research ✅

掃描已跑（`specs/110` 規劃時）：**7 處**「檢查失敗 → 預設值」，其中
`cstring:77`／`:112`（`strcmp` 相等回 0）**合法**。

**Decision**：護欄用**排順序不下結論**的形狀 ＋ `decisions.json` 落點。
**Rationale**：合法與回退在語法上一模一樣（都是 `return { value: 0 }`）
——`build-guardrail` 第 6 步「靜態判斷不能下結論」。
**Alternatives**：寫一個「只有型別檢查後的回退才算」的判準（❌ 實測
`cstdlib:21` 的 `if (!v)` 是存在性檢查不是型別檢查，而它同樣是回退）。

## Phase 1：Design ✅

### 護欄的形狀

```
掃 src/languages/cpp/**/executors.ts
找  if (<檢查>) return { …, value: <預設值> }
報  檔:行 ＋ 檢查條件 ＋ 回傳值
判定落點  tests/assets/silent-fallback-decisions.json
          { 位置, 訊號, 判定: 合法|靜默回退, 理由 }
```

⚠️ **自我否證聲明錨在「掃到幾個檔／幾個 return」**（合成量），
不錨在「回退筆數 > 0」（那是要推向零的東西）。

### 修法

1. `cpp:vector_size` 非容器 → 丟 `RuntimeError`，**空容器仍回 0**
2. `.size()` 的辨識**照抄 `.length()` 的規則形狀**，依目標型別分派

### 順序

```
護欄 → 產基線 → 修 ② → 修 ③ → 下調基線
```

②③ 會讓護欄的數字下降一筆（`vector:25` 消失）——**那是「因為實作了」**。

## Complexity Tracking

無違規。
