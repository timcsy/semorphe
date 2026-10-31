---
name: long-test-run
description: 合併前的長測試（全套 ＋ 建置 ＋ 整輪 e2e）怎麼排——一支腳本一個入口，三個踩過的坑寫死在裡面；放背景跑，不擋進度
user-invocable: true
argument-hint: "[worktree 路徑] [--suite|--build|--e2e] [--port N] [--only 檔名…]"
---

# 長測試的排程（long-test-run）

## 什麼時候用

一刀做完、要合進 main 之前（CLAUDE.md「commit 前跑全套」「改了使用者按得到的東西跑 e2e」那幾列）。
**放背景跑**（`run_in_background`），等通知；不要輪詢、不要 sleep 等。

## 做法

```bash
tools/long-test.sh <worktree> <scratchpad 目錄>                 # 全套 → 建置 → 整輪 e2e
tools/long-test.sh <worktree> <scratchpad 目錄> --e2e --only flow-collapse blocks-collapse-shared
tools/long-test.sh <worktree> <scratchpad 目錄> --suite        # 只跑全套
```

log 寫在 `<scratchpad>/test-<worktree 名>.log`、`e2e-<worktree 名>.log`；腳本最後印出紅的那幾支。
兩個 worktree 同時跑 e2e 時給不同的 `--port`（4199、4198）——**不要用 4173**（使用者的 preview）。

## 🔴 腳本替你擋掉的三個坑（都是 2026-11-01 一天內撞到的）

| | 坑 | 症狀 |
|---|---|---|
| ① | 等 cella 用 `pgrep` | cella 讓出空檔是 **SIGSTOP**——行程還在（STAT `T`），`pgrep` 照樣查得到，鏈**永遠等下去**。要用「沒有【正在跑】的」 |
| ② | 全套沒帶 `SEMORPHE_REFCC_INCLUDE` | `audit-sanitizer-verdict` 等 7 支**假紅**（macOS 上 `bits/stdc++.h` 要墊片） |
| ③ | e2e 佔用別人的埠 | 用暫存的 playwright 設定在指定的埠起 preview，跑完刪掉（不留 `pw-*.tmp.config.ts`） |

## ⚠️ 腳本管不到的

- **跑的期間不要改那個 worktree**：改到一半的程式碼會讓結果新舊混雜，而 e2e 用的是開跑前那一份建置。
  要改就停掉、改完重跑（2026-11-01 在 189 上撞過一次）。
- **幾刀排隊時合成一條整合分支只驗一次**——一刀約 45 分鐘，三刀分開跑就是兩個多小時；main 的最終樹就是驗過的那一棵。
- 跟 cella 要空檔可以，跑完說一聲讓他們恢復。
- 紅了先單獨重跑那一支（CLAUDE.md「e2e 的假紅長什麼樣」）——忙碌機器上的 `toBeVisible` 逾時多半是時序。

## 相關

- 誕生場景：`knowledge/draft/2026-11-01-兩個宿主的建置與長測試的排程.md`（使用者 2026-11-01 照推薦定：做成 skill）
