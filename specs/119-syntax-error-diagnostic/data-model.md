# Data Model：四個實體

**Date**: 2026-08-14

---

## 實體一：Diagnostic

| 欄位 | 變動 |
|---|---|
| `nodeId` / `severity` / `rule` / `params` | ⚪ 不變（驗收④ 剛定的） |
| `source: 'component' \| 'parser'` | 🆕 **必要欄位**，不是選用 |

> 🔴 **選用欄位等於允許「不說是誰的問題」**，而那正是本功能要治的病。

---

## 實體二：DiagnosticRule

⚪ **一行不改。** 規則產出的診斷一律 `source: 'component'`，
在**產出端統一填**——不必每條規則各寫一次。

> **一個對所有成員都相同的欄位，不該長在成員上。**

---

## 實體三：DegradationCause（樹上的）

⚪ **判定一行不改**（Out of Scope 第一條）。改的是**去哪裡**：

| cause | 是誰的問題 | 今天 | 之後 |
|---|---|---|---|
| `syntax_error` | 🔴 使用者 | 殘差 Info | **診斷 Error** |
| `unsupported` | 我們 | 殘差 Info | ⚪ **不動** |
| `nonstandard_but_valid` | 我們 | 殘差 Info | ⚪ **不動** |

⚠️ `DEGRADATION_VISUALS` 只有兩個鍵（`syntax_error` 紅、`unsupported` 灰）
——**`nonstandard_but_valid` 沒有視覺**。本輪不補，記在這裡。

---

## 實體四：面板文案

```
規則身分   3 → 4（加 SYNTAX_ERROR）
文案份數   12 → 16（4 × 2 面板 × 2 語言）
```

🔴 **而 `SYNTAX_ERROR` 不在 `cppDiagnosticRules` 裡**——它不是一條規則。
所以第四十二條護欄的**身分來源要擴**：規則表的身分 ＋ 樹產出端的身分。

> **一條護欄如果只看得到一個產出端，第二個產出端的文案缺漏它就看不到。**

### 措辭方向

| | 積木側 | 程式碼側 |
|---|---|---|
| `SYNTAX_ERROR` | 「這一段我看不懂，積木上這塊是照抄的：{snippet}」 | 「這一行的語法不完整」 |

⚠️ **積木側用 `snippet`、程式碼側不用**（波浪已經指在那一行）
——不對稱是刻意的。
