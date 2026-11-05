#!/usr/bin/env bash
# 長測試的排程（skill：knowledge/skills/long-test-run）——全套、建置、整輪 e2e，一條鏈。
#
#   tools/long-test.sh <worktree> <輸出目錄> [--suite] [--build] [--e2e] [--port N] [--only <e2e 檔名…>]
#   沒給 --suite／--build／--e2e 時三段都跑；--e2e 會先建置。
#
# 🔴 三個這個 repo 踩過的坑，寫死在這裡：
#   ① 等 cella 用「沒有【正在跑】的」——cella 讓出空檔是 SIGSTOP（行程還在、STAT 是 T），`pgrep` 照樣查得到，會永遠等下去
#   ② （2026-11-04 退場）全套曾經要帶參照編譯器的墊片——6c-5 之後 npm test 不再呼叫參照編譯器，只有探針 refcc-cross-check 要它
#   ③ e2e 不佔 4173／4199 以外的人：用暫存設定在指定的埠起 preview，跑完刪掉暫存設定
#   ④ 跑的期間 worktree 被改過，量到的是一個沒有人提交過的混合狀態（experience〈長測試讀的是 worktree 的【現在】〉）
#      ——處方寫了「不動」而 2026-11-04、05 又各犯一次，所以改成機器在擋：開跑與結束各取一次【檔案內容】的指紋，
#      不一樣就大聲說、結束碼改成 3。指紋是內容的樹雜湊（暫時的 index ＋ write-tree），中途【提交】不算改（內容沒變）。
set -u
WT=${1:?用法：tools/long-test.sh <worktree> <輸出目錄> [--suite] [--build] [--e2e] [--port N] [--only 檔名…]}
OUT=${2:?缺輸出目錄（放 scratchpad）}
shift 2
SUITE=0; BUILD=0; E2E=0; PORT=4199; ONLY=()
while [ $# -gt 0 ]; do
  case "$1" in
    --suite) SUITE=1 ;;
    --build) BUILD=1 ;;
    --e2e) E2E=1; BUILD=1 ;;
    --port) PORT=$2; shift ;;
    --only) shift; while [ $# -gt 0 ] && [[ "$1" != --* ]]; do ONLY+=("$1"); shift; done; continue ;;
    *) echo "不認得的參數：$1" >&2; exit 2 ;;
  esac
  shift
done
[ $SUITE = 0 ] && [ $BUILD = 0 ] && [ $E2E = 0 ] && { SUITE=1; BUILD=1; E2E=1; }

WT=$(cd "$WT" && pwd)
NAME=$(basename "$WT")
mkdir -p "$OUT"

cella_running() { ps -axo stat,command | grep -E '[c]ella/target|[c]argo test|[c]ella check' | awk '$1 !~ /^T/' | wc -l | tr -d ' '; }
wait_cella() { until [ "$(cella_running)" -eq 0 ]; do sleep 60; done; }
strip() { LC_ALL=C sed 's/\x1b\[[0-9;]*m//g'; }

cd "$WT" || exit 1
status=0
fingerprint() { local idx; idx=$(mktemp); cp "$(git rev-parse --git-path index)" "$idx" 2>/dev/null; GIT_INDEX_FILE="$idx" git add -A . >/dev/null 2>&1; GIT_INDEX_FILE="$idx" git write-tree; rm -f "$idx"; }
FP_START=$(fingerprint)

if [ $SUITE = 1 ]; then
  wait_cella
  echo "suite 開始 $(date +%T)（${NAME}）"
  npm test > "$OUT/test-$NAME.log" 2>&1
  strip < "$OUT/test-$NAME.log" | grep -aE '^ FAIL|Test Files|Tests ' | sort -u | head -30
  strip < "$OUT/test-$NAME.log" | grep -aqE '^ FAIL' && status=1
fi

if [ $BUILD = 1 ]; then
  echo "build 開始 $(date +%T)"
  if ! npm run build > "$OUT/build-$NAME.log" 2>&1; then echo "🔴 建置失敗：$OUT/build-$NAME.log"; exit 1; fi
fi

if [ $E2E = 1 ]; then
  # 🔴 暫存設定寫在【輸出目錄】，不寫進 worktree（2026-11-05）：上一輪被砍掉時它來不及刪，留在 worktree 裡，
  #    下一輪開跑的指紋就把它算進去、跑完又被刪掉——乾淨的一輪被判成「跑的期間被改過」（exit 3）。
  CFG="$(cd "$OUT" && pwd)/pw-$PORT.tmp.config.ts"
  cat > "$CFG" <<EOF
import base from '$WT/playwright.config'
export default {
  ...base,
  testDir: '$WT/e2e',
  use: { ...base.use, baseURL: 'http://localhost:$PORT/' },
  projects: base.projects?.map((p) => ({ ...p, use: { ...p.use, baseURL: 'http://localhost:$PORT/' } })),
  webServer: { command: 'npx vite preview --port $PORT --strictPort', url: 'http://localhost:$PORT/', reuseExistingServer: false, timeout: 60_000 },
}
EOF
  wait_cella
  echo "e2e 開始 $(date +%T)（埠 ${PORT}）"
  npx playwright test --config="$CFG" ${ONLY[@]+"${ONLY[@]}"} > "$OUT/e2e-$NAME.log" 2>&1 || status=1
  rm -f "$CFG"
  grep -E '✘|passed|failed|flaky' "$OUT/e2e-$NAME.log" | tail -12
fi

FP_END=$(fingerprint)
if [ "$FP_END" != "$FP_START" ]; then
  echo "🔴 跑的期間 $WT 的檔案被改過——這一輪量到的是混合狀態，結果不能當合併的依據；改好後重跑（長測試在跑的 worktree 不動，要做別的就開新的 worktree）"
  # 🟢 說出是哪幾個路徑（2026-11-05 第 281 刀：一次「工作樹結束時是乾淨的」而指紋不同——開跑時有上一輪被砍掉留下的暫存檔，
  #    跑完被測試自己清掉。沒有清單的話只能猜）。`+` 跑完才有、`-` 開跑時有而跑完沒了、`M` 內容變了。
  git diff-tree -r --name-status "$FP_START" "$FP_END" | sed 's/^A/  +/; s/^D/  -/; s/^M/  M/' | head -20
  status=3
fi
echo "結束 $(date +%T)"
exit $status
