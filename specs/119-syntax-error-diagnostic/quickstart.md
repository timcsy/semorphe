# Quickstart：怎麼驗證這件事真的做到了

**Date**: 2026-08-14

⚠️ 前三步**刻意先紅**（constitution II），而**每一支都要人工確認紅的理由**。

---

## 前置：記下基線

```bash
npx tsc --noEmit                 # 必須先綠
npm test 2>&1 | tail -3          # 現況 4123
```

⚠️ 已知 flaky：`tests/probes/scenario-coverage.test.ts` 的「競賽」
在全套平行跑時會逾時（單獨跑綠）。**與本功能無關**，但要先知道。

---

## 步驟一：🔴 先讓「少分號 → Error 級」紅

新建 `tests/unit/core/diagnostics-from-tree.test.ts`：

```
正向錨點   一棵沒有 syntax_error 的樹 → 產出 0 則        （先證明量得到「乾淨」）
斷言       一棵有 syntax_error 的樹 → 1 則，severity 'error'、source 'parser'
🔴 反向    同一棵樹上的 unsupported 節點 → 【不得】被產出
```

**現在跑 → 必須紅**（那個函式還不存在）。

---

## 步驟二：🔴 先讓「另外兩種不得被搬走」紅

在 e2e 補：一段含**不支援寫法**的程式 → 程式碼面板仍有 **Info 級**標記，
且在 `semorphe-residual` 那一組。

⚠️ **這一支今天是綠的**——所以它靠**注入**證明會紅：
把 `renderResidual` 的濾網拿掉（或改成全部送診斷），它必須紅。

---

## 步驟三：🔴 先讓 e2e 的「少分號 → Error」紅

在 `e2e/diagnostics.spec.ts` 補：少分號的程式 → 程式碼面板出現 **Error 級**波浪。

**現在跑 → 必須紅**（今天是 Info）。
⚠️ 確認紅的理由是「severity 不對」而**不是**「找不到標記」。

---

## 步驟四：改資料形狀

```
src/core/diagnostics.ts     Diagnostic 加 source；🆕 diagnosticsFromTree()
src/core/view-host.ts       DiagnosticsEvent 跟著改
src/languages/cpp/*.ts      規則產出端統一填 source: 'component'
```

```bash
npx tsc --noEmit     # ⚠️ 預期紅——把清單抄進 tasks，確認都在範圍內
```

---

## 步驟五：接上會合點

```
src/ui/app.ts               訂閱 semantic:update → 快取 tree → 合併兩個來源，一次廣播
src/ui/panels/monaco-panel  renderResidual 濾掉 syntax_error
src/ui/panels/blockly-panel SYNTAX_ERROR 的積木側文案
src/i18n/{zh-TW,en}         12 份 → 16 份
tests/integration/audit-diagnostic-labels.test.ts   身分來源要擴（規則表 ＋ 樹產出端）
```

---

## 步驟六：反向驗證（真的跑一次，不可推理）

```
把 renderResidual 的濾網拿掉        → 步驟二必須紅（顯示兩次）
把 unsupported 也送進診斷           → 步驟二必須紅（我們的問題變成學生的錯誤）
拿掉 SYNTAX_ERROR 的任一份文案      → 第四十二條護欄必須紅【並指名】
把兩個面板的 SYNTAX_ERROR 文案寫成同一句 → 單元測試必須紅
```

---

## 步驟七：瀏覽器實測

⚠️ **改完原始碼要重 build 再測**——e2e／preview 跑的是產物
（`experience` 那條剛學到的）。

| 情境 | 程式碼面板 | 積木面板 |
|---|---|---|
| `int x = 1`（少分號） | 🔴 **紅波浪**，說這一行語法不完整 | 積木紅框 ＋ 「這塊是照抄的：…」 |
| 含不支援寫法 | 🟡 **仍是灰色 Info**，主詞仍是「我還不認得」 | 灰色 |
| 兩者同時出現 | 一紅一灰，**同時可見** | 同上 |

---

## 步驟八：確認沒踩到別的

```bash
npm test
npx vitest run tests/integration/audit-*.test.ts     # 42 條
npm run test:e2e
git diff --stat tests/baselines/projection-residual.json   # 🔴 必須是空的
```

🔴 **`projection-residual.json` 一個字元都不該變。** 變了 → **停下來查**。
