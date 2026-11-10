#!/usr/bin/env bash
# 等 semorphe.com 的主線換成指定的入口檔（`assets/index-<hash>.js`）——deploy.yml 的 redeploy-pages 用。
# 為什麼：同一個 commit 的第二次 Pages 部署會回報成功而 `/` 還是上一版（2026-11-11，394 與 401 兩次）。
# 用法：tools/wait-live-entry.sh assets/index-XXXX.js [次數=30] [間隔秒=20]
set -uo pipefail
want="${1:?要給入口檔名}"; tries="${2:-30}"; gap="${3:-20}"
live=""
for i in $(seq 1 "$tries"); do
  live=$(curl -s "https://semorphe.com/index.html?ci=${GITHUB_RUN_ID:-local}-${i}-${RANDOM}" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  if [ "$live" = "$want" ]; then echo "🟢 線上主線是 $live"; exit 0; fi
  sleep "$gap"
done
echo "::error::部署回報成功，而線上主線是 ${live:-（讀不到）}、這一版是 ${want}——期間若又推了一次，線上可能已是更新的那一版；否則重跑 redeploy-pages（gh run rerun <run> --job <job id>）"
exit 1
