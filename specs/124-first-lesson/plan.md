# Implementation Plan: 第一課

**Branch**: `124-first-lesson` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

寫出這個專案的第一課，而**真正的產出是走的過程中撞到的坑**。

🔴 **而 plan 階段就撞到第一條**——見下。

## Q1：選哪三個概念（要真的算，不憑感覺）

`draft/Ln` §五之五 的判準：下界＝目標的傳遞閉包，上界＝前置已滿足的那一圈。

**目標**：印出一句話。

```
下界   print ＋ literal_string
結構   🔴 而程式需要 main——而 `func_def` 【不在 L0 的 19 顆裡】，它在 L1a
```

### 🔴 而這是第一條卡點，在寫課之前就浮出來了

```
L0 的 19 顆   print endl input var_declare var_assign var_ref
              literal_number literal_string arithmetic compare logic
              logic_not negate if if_else loop_while builtin_constant
              include using_namespace
              🔴 沒有 func_def
工作區        全新狀態【是空的】（e2e/diagnostics.spec.ts 檔頭逐字）
```

**學生打開看到空白，而他需要 `main` 才能跑任何東西——而 `main` 不在第一關。**

⚠️ 這正是 `draft/Ln` §五之五 抓到的那個病的**第二個實例**：
那次是「`array_assign` 在 L1a 而它需要 L2a 的 `array_declare`」——
**一個關卡的學生拿得到某顆積木，卻拿不到它的前置**。

### 決策 1：三個概念 ＝ `func_def`（main）／`print`／`literal_string`

- **Rationale**：那是「印出一句話」的**完整**必需集合，而它**跨了關卡**
  ——⚠️ 而那個跨越本身就是本功能要暴露的東西。
- ⚠️ **不修 `levelTree`**（Out of Scope）——**記下來**。

## Q2：起始狀態放什麼

### 決策 2：**從空白開始，不做起始狀態檔**

- spec 的 Assumptions 逐字：「⚠️ 若空白太難起步，**那本身就是第一條卡點**」。
- ⚠️ 而**不要為了對稱造一個空檔**——`lesson.md` ＋ `goal.txt` 就夠了。
  第二課若真的需要起始狀態，那時再加。

> **一個目錄結構不需要在第一個實例就長全。**

## Technical Context

**Language/Version**: N/A（本功能不寫程式碼）

**Testing**: ⚠️ 期望輸出要用**直譯器**驗過（FR-003）

**Constraints**: 🔴 **只新增檔案，不修改任何既有檔案**（FR-002／SC-004）

**Scale/Scope**: 一個資料夾、兩個檔案、一份卡點清單

## Constitution Check

| 原則 | 判定 |
|---|---|
| **I. 簡約優先** | ✅ 兩個檔案。⚠️ 而決策 2 刻意**不造**第三個 |
| **II. TDD** | 🟡 **不適用**——本功能不寫程式碼。而 FR-003（期望輸出跑得出來）是它的等價物 |
| **III. Git 紀律** | ✅ 課與卡點清單分開 commit——⚠️ 後者是產出，不是附註 |
| **IV. 規格保護** | ✅ |
| **V. 繁體中文優先** | ✅ 而**課本身也是中文**——它的讀者是學生 |

⚠️ **正面說**：本功能**沒有測試**，而那不是偷懶——
**它的驗收是「一個人走得完」，那是人做的事**。
而 SC-006（既有測試不動）是它唯一的機械檢查。

## Structure

```text
lessons/01-印出一句話/
  lesson.md    說明（人寫，中文）
  goal.txt     期望輸出（⚠️ 用直譯器驗過）

specs/124-first-lesson/findings.md   🔴 卡點清單——本功能真正的產出
```

⚠️ **卡點清單放在 spec 目錄**而不是 `lessons/`——它是**這一輪的觀察**，
不是課的一部分。
