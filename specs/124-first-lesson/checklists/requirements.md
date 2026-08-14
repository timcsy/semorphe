# Specification Quality Checklist: 第一課

**Created**: 2026-08-14 | **Feature**: [spec.md](../spec.md)

## Content Quality
- [X] No implementation details
- [X] Focused on user value
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness
- [X] No [NEEDS CLARIFICATION] markers
- [X] Requirements testable and unambiguous
- [X] Success criteria measurable
- [X] Success criteria technology-agnostic
- [X] All acceptance scenarios defined
- [X] Edge cases identified
- [X] Scope clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness
- [X] All FRs have acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes
- [X] No implementation details leak

## 驗證過程（三輪，每輪有實質修正）

### 第一輪：🔴 這個 spec 差點把真正的產出寫成附註

輸入把「撞到的坑逐條記下」寫在範圍的第④點。而**那才是本功能的產出**
——那一課本身只是**取得那份清單的手段**。

- **改法**：升格成 **US2（P1）**，並在「為什麼是這個」上面加一整節
  「⚠️ 而本功能真正的產出不是那一課」。
- **理由**：若它留在第④點，實作時會被讀成「順便記一下」，
  而**下一步（面板／圖鑑／目標檢查）就繼續是猜的**。

### 第二輪：⚠️ 「沒有卡」與「沒寫」分不出來

SC-003 原本只要求「清單存在」。而**一份空的清單與一份沒寫的清單長得一樣**
——這正是這個專案反覆撞到的形狀（`it.todo` 沒有本體、
一個查不到與一個沒有長得一樣）。

- **改法**：US2 場景 2 ＋ Edge Case：**「沒有卡」必須被明確寫出來**。

### 第三輪：🔴 走的人是作者——而那會讓驗收自我實現

作者知道答案，所以他不會卡。**那讓 SC-001／SC-002 幾乎必然通過，
而 SC-003 幾乎必然是空的。**

- **改法**：Assumptions ＋ Edge Cases 寫明，並要求清單記
  **「我因為知道答案而跳過的地方」**。
- ⚠️ 這不能完全解決（唯一的解是找一個真的新手），
  **而把限制寫下來，比假裝它不存在好**。

## Notes

- ⚠️ **留給 plan 的兩個問題**：
  1. **選哪三個概念？** 判準在 `draft/Ln` §五之五（下界＝必需集合的傳遞閉包／
     上界＝前置已滿足的那一圈），⚠️ 而那要真的算一次，不是憑感覺挑。
  2. **起始狀態放什麼格式？** 「就是一份存檔」是設計脈絡的說法，
     ⚠️ 而**第一課若從空白開始，這個檔可能根本不需要**
     ——那時不要為了對稱而造一個空檔。
