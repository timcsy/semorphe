---
name: upgrade-cella
description: cella 發了新版之後，把 semorphe 升上去——釘版、自己的 node_modules、新舊兩版判決比對、cella-pinned、照發版說明實測學生語料、回報；而「之前被 unsupported 蓋住的誤判」要在這一步被看見
user-invocable: true
argument-hint: "<cella-lang 版本> [@cella-lang/* 版本]（cella 的訊息裡會給）"
---

# 升級 Cella（upgrade-cella）

## 什麼時候用

cella 說「新版發到 npm 了」——202、212、217、220 四次都是同一套流程（使用者 2026-11-02 同意固化）。

## 做法

```
① 查版本     npm view cella-lang version；@cella-lang/{c,cpp,arduino,python,machine} 各查一次
② 開 worktree 釘版、【自己】npm install（不要連主樹的 node_modules）
③ cella-pinned   跑護欄：semanticsHash 變了才是判決語義變了
④ 課文判決比對   binding-verdict 在主樹（舊版）與 worktree（新版）各跑一次，diff（約兩分鐘）
          ⚠️ StudyCpp 那種會跑幾十分鐘的「舊版」不要在主樹跑——開一個釘在 main 的 worktree（主樹留給合併；experience〈拿主樹當「舊版」的量測，會把主樹鎖住〉）
⑤ 照發版說明實測  StudyCpp 裡受影響的那幾支 ＋ 看有沒有【新露出來的】reject
⑥ 基線          cella-pinned 更新 seenVersion、寫 note（判決差在哪）；test:guard
⑦ 長測試        tools/long-test.sh（建置會重編 Cella 模組、e2e 要跑）——合併前在【合併後的狀態】跑
⑧ 合併之後      主樹 npm install（沒有測試在用它的時候）；重匯回歸語料；回報 cella
```

### ① 版本號不一定一樣

同一次發版，各套件的版本號會差一分鐘（`cella-lang …0258`、`cpp …0259`、`python …0300`）。
**逐一查，不要照 cella-lang 的號碼套**——`package.json` 是精確釘版（沒有 `^`），差一分鐘就裝不到。

### ② 為什麼要自己的 node_modules

其他 worktree 的 `node_modules` 多半是連到主樹的符號連結。在主樹 `npm install` 會**換掉別人正在跑的測試底下的套件**。
新 worktree 自己裝；主樹等升級合進 main、而且沒有長測試在跑時才重裝（`pgrep -fl "vitest|playwright"`）。

### ③④ 判決有沒有變

```bash
npx vitest run tests/integration/audit-cella-pinned.test.ts          # semanticsHash
npx vitest run tests/probes/binding-verdict.test.ts > old.log         # 主樹（舊版）
(cd <worktree> && npx vitest run tests/probes/binding-verdict.test.ts) > new.log
diff <(grep -vE "Start|Duration|RUN|[0-9]+ms" old.log) <(grep -vE "Start|Duration|RUN|[0-9]+ms" new.log)
```

- `semanticsHash` 變了 → 護欄會紅：**先看判決差在哪，才上調**（那支護欄的 note 記了每一次）。
- ⚠️ 報表的 `checkerHash` 從 1759 起三版都一樣——它量的不是會隨版本變的東西，**不當判準**。

### ⑤ 🔴 實測：發版說明列的每一項，加上「新露出來的 reject」

照 cella 的發版說明挑 StudyCpp 裡對應的程式（`$STUDYCPP_DIR`，218 支；`find … | wc -l` 先確認不是空的），
用一支暫時的探針送 `checker.verdict`、印 `problems` 全文，**用完刪掉**（探針目錄的檔數有護欄在數）。

> 🔴 **一個構造從 unsupported 變成支援之後，它背後的下一個問題才看得見。**
> 220 補了 multiset 的 `lower_bound`／`erase`——學生的 4_15 從 unknown 變成 **reject**（迭代器的 `->` 被說「需要指標」）。
> 那是一個早就在的誤判，只是被 unsupported 蓋住了。**誤判 reject 比 unknown 嚴重**（P6：說一支合法的程式有錯）。

判斷誰的錯：先看**我們送了什麼**（形狀忠實於原始碼嗎），再在**舊版**上跑同一支（是不是這次升級帶來的）。
我們送錯 → 修 formalize；形狀對而 Cella 判錯 → 附最小重現回報 cella。

### ⑦ 長測試裡的兩個坑

- `tools/long-test.sh` 會**等 cella 跑完他們自己的檢查**才開始（刻意的，見那支腳本的①）——看起來像卡住，其實在排隊；
  `ps -axo stat,etime,command | grep -E '[c]ella/target|[c]ella check'` 看得到原因。
- 機器忙時護欄會假紅（`conformance` 的「掃到的元件數為零」、`lesson-answers-vs-compiler` 的編不過）——**單獨重跑那一支**再判。

### ⑧ 回報 cella 的內容

版本、課文判決比對的結果、發版說明每一項的實測、**新露出來的誤判**（附送出的 JSON 與最小重現）、
回歸語料重匯的位置（`/Users/timcsy/Documents/Projects/semorphe-cella-corpus/`，`tests/probes/export-cella-corpus.test.ts`）。

## 不是這支 skill 的事

- 接新的語法節點（例如 VLA 的 `sDeclV`）——那是 formalize 的一刀，可以跟升級同一條分支，但分開提交。
- 6c 的切換本身。

## 相關

- [[long-test-run]]——⑦ 的那支腳本
- `tests/baselines/cella-pinned.json` 的 note——每一次升級「判決差在哪」的紀錄
- 教訓〈兩條各自綠的分支，合起來的那個狀態沒有人跑過〉（`experience.md`）——⑦ 為什麼要在合併後的狀態跑
