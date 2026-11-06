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
# 🟢 共用排隊（2026-11-07，使用者決定「測試執行資源有限」）：三個專案的長測試都透過 cos-mos 的 `slot.mjs` 排隊——
#    不在它底下時，透過它重新啟動自己（名額、負載准入都由它管；我們的負載閘門關掉，免得兩道疊起來）。
#    契約（cos-mos 規格〈契約〉）：子命令與旗標、COSMOS_* 環境變數、結束碼照傳（128+訊號、2、127）、stderr 只承諾 `slot: ` 開頭的四種句子。
#    找不到 slot.mjs（例如別台機器）就照舊直接跑，由我們自己的負載閘門頂著；`SEMORPHE_NO_SLOT=1` 可以強制不排隊。
SLOT_TOOL=${COSMOS_SLOT_TOOL:-"$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)/cos-mos/tools/slot.mjs"}
if [ -z "${SEMORPHE_UNDER_SLOT:-}" ] && [ "${SEMORPHE_NO_SLOT:-0}" != 1 ] && [ -f "$SLOT_TOOL" ]; then
  exec node "$SLOT_TOOL" run --project semorphe --label long-test -- env SEMORPHE_UNDER_SLOT=1 SEMORPHE_LOAD_GATE=0 bash "$0" "$@"
fi

WT=${1:?用法：tools/long-test.sh <worktree> <輸出目錄> [--suite] [--build] [--e2e] [--port N] [--no-wait-cella] [--only 檔名…]}
OUT=${2:?缺輸出目錄（放 scratchpad）}
shift 2
SUITE=0; BUILD=0; E2E=0; PORT=4199; ONLY=(); WAIT_CELLA=1
while [ $# -gt 0 ]; do
  case "$1" in
    --suite) SUITE=1 ;;
    --build) BUILD=1 ;;
    --e2e) E2E=1; BUILD=1 ;;
    --port) PORT=$2; shift ;;
    # Cella 整夜都在跑自己的測試時（例如子代理在做一件大事），等它跑完會等到天亮——那時不等、負載造成的紅照舊單獨重跑來判
    --no-wait-cella) WAIT_CELLA=0 ;;
    --only) shift; while [ $# -gt 0 ] && [[ "$1" != --* ]]; do ONLY+=("$1"); shift; done; continue ;;
    *) echo "不認得的參數：$1" >&2; exit 2 ;;
  esac
  shift
done
[ $SUITE = 0 ] && [ $BUILD = 0 ] && [ $E2E = 0 ] && { SUITE=1; BUILD=1; E2E=1; }

WT=$(cd "$WT" && pwd)
# 🔴 worktree 不存在時上一行得到空字串，而 `cd ""` 等於不換目錄——原本會在呼叫者所在的目錄（通常是主樹）照跑（2026-11-07 煙霧測試量到）
[ -n "$WT" ] || { echo "🔴 找不到 worktree（第一個參數）" >&2; exit 2; }
NAME=$(basename "$WT")
mkdir -p "$OUT"

# 🔴 只看【執行檔】，不看整串指令文字（2026-11-05）：呼叫這支腳本的 shell 自己的指令列裡寫著「cargo test」時
#    （例如同一行先 pgrep 一下），舊的寫法把那個 shell 算成「Cella 在跑」——等自己等了 74 分鐘。
cella_running() { ps -axo stat=,comm= | awk '$1 !~ /^T/ && ($2 ~ /(^|\/)cargo$/ || $2 ~ /cella\/target\// || $2 ~ /(^|\/)cella$/)' | wc -l | tr -d ' '; }
# ⏱ 等有上限（2026-11-06）：Cella 的子代理整夜跑測試時，「等它跑完」等了兩個鐘頭還沒開始——一個等別人的閘沒有上限，就是一個安靜的停擺。
#    最多等 WAIT_MAX 分鐘，等不到就說出來、照跑（負載造成的紅照舊單獨重跑來判）。
WAIT_MAX=${WAIT_MAX:-20}
wait_cella() {
  [ "$WAIT_CELLA" = 1 ] || return 0
  local waited=0
  until [ "$(cella_running)" -eq 0 ]; do
    if [ "$waited" -ge "$WAIT_MAX" ]; then echo "⏱ 等了 ${waited} 分鐘，Cella 仍在跑自己的測試——照跑（紅的那幾支單獨重跑再判）"; return 0; fi
    sleep 60; waited=$((waited + 1))
  done
}
strip() { LC_ALL=C sed 's/\x1b\[[0-9;]*m//g'; }

# 🔴 負載閘門（2026-11-07，使用者決定「測試執行資源有限」——經 cos-mos-main → semorphe-main 轉達）：
#    一分鐘負載超過核心數 2 倍就先延後、每 10 分鐘說一次為什麼；最多等 LOAD_WAIT_MAX 分鐘，等不到就照跑並註明。
#    起因（2026-11-06）：Cella 的建置把負載推到 150～285（8 核），長測試全套 44 分鐘才跑到 1000／8000——
#    跑下去只會得到一堆「逾時」的紅、還拖慢對方。之後由 cos-mos 的共用排隊（`~/.cos-mos/slots/`）接手，這裡是最小的第一步。
NCPU=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 8)
LOAD_LIMIT=$((NCPU * 2))
LOAD_WAIT_MAX=${LOAD_WAIT_MAX:-60}
load_now() { sysctl -n vm.loadavg 2>/dev/null | awk '{print int($2)}' || awk '{print int($1)}' /proc/loadavg; }
wait_load() {
  # 經 cos-mos 的共用排隊（`slot.mjs run …`）啟動時，負載閘門由它管（三個專案同一條規則）——這裡關掉，免得兩道疊起來
  #（它最多等 30 分、這裡最多 60 分）。開始／結束負載兩欄照記。
  [ "${SEMORPHE_LOAD_GATE:-1}" = 0 ] && return 0
  local waited=0 l
  l=$(load_now)
  while [ "$l" -gt "$LOAD_LIMIT" ]; do
    if [ "$waited" -ge "$LOAD_WAIT_MAX" ]; then echo "⏱ 負載 ${l} 仍超過 ${LOAD_LIMIT}（核心數 ${NCPU} 的 2 倍）——等了 ${waited} 分鐘，照跑；逾時的紅標「負載」，單獨重跑或交 CI 再判"; return 0; fi
    [ $((waited % 10)) -eq 0 ] && echo "⏸ 負載 ${l} 超過 ${LOAD_LIMIT}（核心數 ${NCPU} 的 2 倍），先延後（$(date +%T)）——機器上最吃 CPU 的：$(ps -axo %cpu=,comm= -r | head -2 | awk '{print $2}' | xargs -n1 basename | paste -sd, -)"
    sleep 60; waited=$((waited + 1)); l=$(load_now)
  done
}

cd "$WT" || exit 1
status=0
fingerprint() { local idx; idx=$(mktemp); cp "$(git rev-parse --git-path index)" "$idx" 2>/dev/null; GIT_INDEX_FILE="$idx" git add -A . >/dev/null 2>&1; GIT_INDEX_FILE="$idx" git write-tree; rm -f "$idx"; }
FP_START=$(fingerprint)

# 🟢 狀態檔（2026-11-05，窗口試點）：session 是快取、真相在檔案——「誰的長測試在跑、跑到哪、結果是什麼」
#    原本只在對話與 ${CLAUDE_JOB_DIR}（工作結束就被清掉）裡。寫在 git 的共用目錄：每個 worktree 都看得到、不會被提交、
#    worktree 刪了它還在。一輪一行，不用人寫。讀法：`tail "$(git rev-parse --git-common-dir)/long-test/runs.tsv"`
STATE_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)/long-test"
mkdir -p "$STATE_DIR"
RANGE="$([ $SUITE = 1 ] && printf 全套,)$([ $E2E = 1 ] && printf e2e,)$([ $BUILD = 1 ] && [ $E2E = 0 ] && printf 建置,)${ONLY[*]:-}"
RUN_START="$(date '+%F %T')"
printf '%s\t%s\t%s\t%s\t%s\t跑著\t%s\n' "$RUN_START" "$NAME" "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)" "$RANGE" "$OUT" > "$STATE_DIR/$NAME.now"
# 被中斷（Ctrl-C、被停掉）時也要收：「跑著」留下來，窗口會以為它還在跑。記一筆「中斷」再清掉
on_abort() { printf '%s\t%s\t%s\t%s\t%s\t中斷\t—\t%s\n' "$RUN_START" "$NAME" "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)" "$RANGE" "$OUT" >> "$STATE_DIR/runs.tsv"; rm -f "$STATE_DIR/$NAME.now"; exit 130; }
trap on_abort INT TERM HUP

if [ $SUITE = 1 ]; then
  wait_cella
  wait_load
  LOAD_START=${LOAD_START:-$(load_now)}
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
  #    ⚠️ 設定不在 worktree 裡之後，webServer 要指定 cwd（預設是設定檔所在的目錄，那裡沒有 vite）。
  CFG="$(cd "$OUT" && pwd)/pw-$PORT.tmp.config.ts"
  cat > "$CFG" <<EOF
import base from '$WT/playwright.config'
export default {
  ...base,
  testDir: '$WT/e2e',
  use: { ...base.use, baseURL: 'http://localhost:$PORT/' },
  projects: base.projects?.map((p) => ({ ...p, use: { ...p.use, baseURL: 'http://localhost:$PORT/' } })),
  webServer: { command: 'npx vite preview --port $PORT --strictPort', cwd: '$WT', url: 'http://localhost:$PORT/', reuseExistingServer: false, timeout: 60_000 },
}
EOF
  wait_cella
  wait_load
  LOAD_START=${LOAD_START:-$(load_now)}
  echo "e2e 開始 $(date +%T)（埠 ${PORT}，負載 $(load_now)）"
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
# 一輪一行：開始、worktree、分支、提交、範圍、結果、紅了哪幾支、輸出目錄（結果：0 綠／1 紅／3 跑的期間被改過）
REDS=$(cat "$OUT"/*.log 2>/dev/null | strip | grep -aoE '^ FAIL  [^ ]+|✘ +[0-9]+ \[[a-z]+\] › [^ ]+' | sed 's/^ FAIL  //; s/.*› //' | sort -u | head -8 | paste -sd, -)
# 最後兩欄（2026-11-07）：開始時與結束時的一分鐘負載（核心數 ${NCPU}）——紅的時候先看這兩欄：超過 ${LOAD_LIMIT} 的逾時紅是「負載」，不是缺陷
LOAD_END=$(load_now)
# 每檔耗時 ＋「過了但變慢」（2026-11-07，測試執行資源有限②的後半）：寫 $STATE_DIR/timing/<這一輪>.tsv、和上一輪比——只報不擋
node "$(dirname "$0")/long-test-timing.mjs" "$OUT" "$STATE_DIR" "$(echo "$RUN_START" | tr ' :' '_-')-$NAME" "$LOAD_END" || true
printf '%s\t%s\t%s\t%s\t%s\texit=%s\t%s\t%s\t負載開始=%s\t負載結束=%s\n' "$RUN_START" "$NAME" "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)" "$RANGE" "$status" "${REDS:-—}" "$OUT" "${LOAD_START:-—}" "$LOAD_END" >> "$STATE_DIR/runs.tsv"
rm -f "$STATE_DIR/$NAME.now"
exit $status
