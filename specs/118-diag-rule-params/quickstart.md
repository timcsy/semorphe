# Quickstart：怎麼驗證這件事真的做到了

**Date**: 2026-08-14

⚠️ 本檔的每一步都是**可跑的**。前兩步**刻意先紅**（constitution II）。

---

## 前置：記下基線

```bash
npm test 2>&1 | tail -5          # 現況 4109 支
npx tsc --noEmit                  # 必須先是綠的
```

⚠️ **先跑一次再動任何東西**——`experience`「改動前後症狀相同」那條的前提是
「你確定哪一刻是『前』」。

---

## 步驟一：🔴 先讓 e2e 抓到「兩邊說同一句話」（必須紅）

在 `e2e/diagnostics.spec.ts` 補一支斷言：同一則診斷在兩個面板的文字**不同**。

```
入口條件   兩個面板都各有 ≥1 則診斷      ← 錨在合成量，不錨在「不同」
斷言       兩個字串不相等
```

**現在跑 → 必須紅**（今天兩邊查同一張表，字串一定相同）。

⚠️ **如果它是綠的，先停下來**——代表入口條件沒成立（可能診斷根本沒出現），
而一支空過的測試與健康的長得一模一樣。

---

## 步驟二：🔴 先建第四十二條護欄（拿掉一份文案 → 必須紅）

`tests/integration/audit-diagnostic-labels.test.ts`

```
入口條件   從規則定義掃到的【規則身分數】> 0
硬性零     規則身分 × 面板 × 語言 = 12 份，缺漏數必須是 0
注入       餵一組少一份的合成資料 → 必須報出來，而且【指名】缺的是哪一份
反向注入   餵一組完整的 → 不得亂報
```

**現在跑 → 必須紅**（今天只有 4 份，而且 key 裡沒有面板）。

---

## 步驟三：改核心的資料形狀

```
src/core/diagnostics.ts        Diagnostic：刪 message，加 rule + params
                               DiagnosticRule：message → rule
                               runDiagnostics：三處 push 帶上 params
src/core/view-host.ts          DiagnosticsEvent 的內嵌型別跟著改
src/languages/cpp/diagnostics.ts   4 條規則改欄位名；MISSING_VALUE 拆成兩個身分
```

```bash
npx tsc --noEmit    # ⚠️ 預期【整片紅】——那是設計：它列出所有要改的地方
```

> **刪掉 `message` 而不是留相容欄位，就是為了讓這一刻發生。**

---

## 步驟四：兩個面板各自組裝

```
src/ui/panels/blockly-panel.ts   組積木側文案；🔴 同一顆積木的多則要【合併】
src/ui/panels/monaco-panel.ts    組程式碼側文案；FR-007 更正 :222 的過期註解
src/i18n/{zh-TW,en}/blocks.json  4 key → 12 份
```

⚠️ **移除靜默降級**：今天 `?? key` ／ `|| d.message` 會把原始代號當訊息顯示。
文案的完備性由步驟二的護欄保證，執行期不需要那個 fallback 假裝正常。

```bash
npx tsc --noEmit    # 綠
npm test            # 步驟二的護欄應該轉綠
npm run test:e2e    # 步驟一的斷言應該轉綠
```

---

## 步驟五：反向驗證（證明測試量的是對的東西）

```
把兩個面板的組裝改成同一個   →  步驟一的 e2e 必須【紅】
拿掉任一份文案               →  步驟二的護欄必須【紅】而且指名
```

⚠️ **兩個都要真的做一次再改回來**——`experience.md:1155`
「一支斷言『檔案裡有這個字串』的測試，全綠不代表行為是對的」。

---

## 步驟六：瀏覽器實測（測試綠 ≠ 使用者看到的是對的）

用 `knowledge/skills/diagnose-in-browser`。

| 情境 | 積木側該看到 | 程式碼側該看到 |
|---|---|---|
| `if` 條件空著 | 「缺少條件」 | 像編譯器的說法，**與左邊不同** |
| 🔴 `int , , ;`（三個名字都空） | **三個問題都被提到**（今天只顯示一個） | 三條波浪 |
| 切成英文 | 英文 | 英文，**而且兩邊仍然不同** |

⚠️ 第二列是 research §二 發現的既有缺陷 —— **它是本功能唯一一個
使用者看得出差別的修正**，一定要親眼確認。

---

## 步驟七：確認沒有踩到別的東西

```bash
npm test                     # 4109 → 4109 + 新增的支數，一支不減
npx vitest run tests/integration/audit-*.test.ts    # 41 條護欄
npm run test:e2e             # 8 支
```

⚠️ **41 條護欄的基線數字一個都不該動**（SC-005）。
若有任何一條的數字變了 → **先停下來查為什麼**，不要順手改基線。
