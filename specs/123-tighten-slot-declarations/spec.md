
---

# 🔴 本 spec 的路線【被否決】（2026-08-14 同日）

**判定錯了，已回退。** 完整理由見
`knowledge/history/065-兩條護欄從相反方向量同一件事.md`。

```
我的證據   generate.ts:6 讀 properties／strategies.ts:365-372 lift 成 _multi_field
反證       audit-declared-slots：「cpp:var_declare — 產出 [declarators] 而宣告裡沒有」
           → 🔴 lift 【真的會】產生它們，我查到的路徑不是唯一的
```

⚠️ **而本 spec 的 Assumptions 自己寫了那個判準**：
「『沒有人走』＝ 沒有產生端**或**沒有消費端。**兩者都要查——只查一邊會漏。**」

**我寫了它，然後只查了消費端。**

## 保留這份 spec 的理由

`knowie` 的規矩：**被否決的選項是最豐富的 why**。
下一個想清這幾筆的人會走到同一條路上——而這份 spec ＋ `history/065`
讓他**知道那條路已經走過而且是死的**，以及**要拿什麼證據才走得通**。

> **再判「假違規」之前，`audit-conformance` 與 `audit-declared-slots`
> 兩條都要跑，而且兩條都要綠。**
