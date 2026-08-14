# Quickstart：怎麼驗證

**Date**: 2026-08-14

⚠️ 前三步**先紅**，每支都要**人工確認紅的理由**。

---

## 前置

```bash
npx tsc --noEmit                  # 綠
npm test 2>&1 | tail -3           # 現況 4138
md5 -q tests/baselines/*.json     # 記下——只有 behavior-error.json 允許變
```

⚠️ 已知 flaky：`scenario-coverage` 的「競賽」在全套平行跑時會逾時。

---

## 步驟一：🔴 US1 先紅——分類判準要先在合成樣本上驗過

```
★ 合成樣本 A（缺標頭）    → 必須分成【工具跑不動】
★ 合成樣本 B（真的不合法）→ 必須分成【程式不合法】
★ 判不出來的訊息          → 必須分成【無法確定】，不得樂觀歸類
```

**現在跑 → 必須紅**（分類函式不存在）。
⚠️ `build-guardrail` 第 6 步：靜態判準要**先在已知答案的樣本上驗過**，
再拿去跑那 27 段。

---

## 步驟二：🔴 跑真實的 27 段，看那個數字

```bash
GENERATE_BASELINE=1 npx vitest run tests/integration/audit-behavior-error.test.ts
```

🔴 **這是本功能的檢查點，不是一個步驟。**

```
programIsIllegal > 0   →  ②的前提成立，照計畫走
programIsIllegal = 0   →  ⚠️ 【停下來】。②仍該做（使用者直接點名），
                          而必須在 spec 記下「這個病比想像小」——
                          那句話會改變後面所有的優先序
```

---

## 步驟三：🔴 US2／US3 先紅

```
★ 少分號的程式 → 按執行 → 【不執行】          今天會執行 → 紅
★ 同一段 → 編輯但不按執行 → 【不拒絕】        ⚠️ 今天綠（今天什麼都不擋）→ 靠注入
★ 含「我還不認得的寫法」→ 按執行 → 【照樣跑】  ⚠️ 今天綠 → 靠注入
```

⚠️ 後兩支今天綠是 `build-guardrail` 6.5 的警訊——**它們必須靠注入證明會紅**。

---

## 步驟四：實作

```
src/core/diagnostics.ts          canExecute(tree)——沿用 DIAGNOSTIC_CAUSES
src/ui/execution-controller.ts   兩個 execute 呼叫點之前加閘門
src/ui/refusal-message.ts        執行拒絕的訊息（為什麼 ＋ 你的程式還在）
```

---

## 步驟五：反向驗證（真的跑，不可推理）

```
把閘門移進 interpreter          → 一大片既有測試紅（證明契約二的理由）
讓閘門也擋 unsupported          → 步驟三第三支紅
把閘門移到編輯的事件上           → 步驟三第二支紅
```

---

## 步驟六：瀏覽器實測（⚠️ 重 build 之後）

| 情境 | 該看到 |
|---|---|
| 少分號 → 按執行 | 🔴 不執行，訊息說「為什麼」＋「你的程式還在」 |
| 少分號 → 只是打字 | ✅ **什麼都不擋**（波浪可以有） |
| 正常程式 → 按執行 | ✅ 正常跑 |
| 積木側 → 按執行 | ✅ 不受影響 |

---

## 步驟七

```bash
npm test；npx vitest run tests/integration/audit-*.test.ts；npm run test:e2e
git diff --stat tests/baselines/
```

🔴 **只有 `behavior-error.json` 允許出現在那個 diff 裡**，而它的 `_meta.note`
必須寫明為什麼變。其餘 42 條**一個字元都不准動**。
