#!/usr/bin/env bash
#
# **把兩份站合成一包**——主線在 `/`，快車道在 `/next/`。
#
# ## 🔴 為什麼是一包
#
# GitHub Pages 一個 repo 一個站，一次部署換掉整包。所以「`/next/` 推上去就在、
# 而 `/` 只有 e2e 綠了才動」這件事，不能靠兩次部署做到——**要在一包裡放兩份**。
#
# ```
# dist/          ← 主線：${MAIN_REF}（預設是 verified 分支＝最後一次 e2e 綠的那一版）
# dist/next/     ← 快車道：現在這個 commit，沒有驗過
# ```
#
# ## ⚠️ 為什麼快車道值得存在，而它為什麼不是子網域
#
# `localStorage` 是 **per-origin** 的。`next.semorphe.com` 會讓學生在快車道上的
# 存檔、進度、作品**在主站全部不存在**——而他不會知道，直到他回家打開主站。
#
# > **同一個 origin 是這條路的唯一理由，而代價就是每一條絕對路徑都要帶前綴
# > （`src/core/base-path.ts`）。少帶一條的症狀不是報錯，是只有 `/next/` 那邊 404。**
#
# 用法：`tools/build-site.sh [主線要用哪個 ref]`（省略＝`verified`，沒有就退回 HEAD）
set -euo pipefail
# ⚠️ **`$VAR` 後面接全形字元時，大括號不能省**——那些字是多位元組，
#    bash 會把它們當成變數名的一部分，於是這一行自己爆成 `MAIN_REF?: unbound variable`。
#    🪦 同一天在 `tools/to-gif.sh` 踩過一次，寫了墓碑，然後在這個檔又踩一次。
#    > **一個只在錯誤路徑上跑的字串，它的 bug 會等到你最需要那句話的時候才出現；
#    > 而一個寫在【別的檔】裡的墓碑，攔不住你在這個檔重犯。**
#    🟢 所以它現在有護欄：`tests/integration/audit-shell-var-braces.test.ts`
cd "$(dirname "$0")/.."

MAIN_REF="${1:-verified}"
# 🔴 **快車道要建哪一版，是可以指定的**（2026-09-14）。
#
# 在此之前它寫死成 HEAD，而那造成一個課堂上最難解釋的缺陷：
#
# ```
# t=0   推 A                     t=3   推 B
# t=2   /next/ = A               t=5   /next/ = B          ✅
# t=9   A 的 e2e 綠 → promote
# t=11  A 的 redeploy 部署       /next/ = A                🔴 把 B 蓋回 A
# ```
#
# **第二次推送被第一次的延遲部署覆蓋**，症狀是「我明明改好了，過幾分鐘它又變回去」。
#
# > **一條分兩次部署的路，第二次帶著的是【它出發時的世界】
# > ——而世界在它跑的那幾分鐘裡動過了。**
#
# 🟢 修法：換版那一路傳 `origin/main`（現在的線頭），不是它自己的 commit。
NEXT_REF="${2:-HEAD}"

resolve() {
  if git rev-parse --verify --quiet "$1" >/dev/null; then echo "$1"; else
    echo "::notice::沒有 $1 這個 ref——退回 HEAD" >&2; echo HEAD
  fi
}
MAIN_REF="$(resolve "${MAIN_REF}")"
NEXT_REF="$(resolve "${NEXT_REF}")"
echo "主線 = ${MAIN_REF}（$(git rev-parse --short "$MAIN_REF")）· 快車道 = ${NEXT_REF}（$(git rev-parse --short "$NEXT_REF")）"

rm -rf dist dist-next .wt-main .wt-next

# $1=ref  $2=base  $3=輸出目錄
build_ref() {
  local ref="$1" base="$2" out="$3"
  if [ "$(git rev-parse "${ref}")" = "$(git rev-parse HEAD)" ]; then
    SITE_BASE="${base}" npm run build -- --base="${base}" --outDir "${out}"
    return
  fi
  # 🔴 **worktree 要完整歷史**——`sitemap.xml` 的 `lastmod` 問 `git log`，
  #    而淺複製裡 HEAD 沒有父節點 → 所有檔案都變成「今天新增」。
  #    （CI 那兩個 job 的 `fetch-depth: 0` 就是為了這個。）
  local wt=".wt-${out}"
  git worktree add -f "${wt}" "${ref}"
  ln -s "$PWD/node_modules" "${wt}/node_modules"
  ( cd "${wt}" && SITE_BASE="${base}" npm run build -- --base="${base}" --outDir "${out}" )
  mv "${wt}/${out}" "${out}"
  git worktree remove --force "${wt}"
}

build_ref "${NEXT_REF}" /next/ dist-next    # 快車道
build_ref "${MAIN_REF}" /      dist         # 主線
mv dist-next dist/next

# ★ 入口條件——兩份都要真的在，而且快車道要帶前綴
test -f dist/index.html      || { echo "::error::主線沒有 index.html"; exit 1; }
test -f dist/next/index.html || { echo "::error::快車道沒有 index.html"; exit 1; }
grep -q '/next/assets/' dist/next/index.html \
  || { echo "::error::快車道的資產路徑沒有帶 /next/ 前綴——它在主站底下會 404"; exit 1; }
grep -q 'noindex' "$(find dist/next/lessons -name index.html | head -1)" \
  || { echo "::error::快車道的課文頁沒有 noindex——搜尋引擎會端出沒驗過的那一版"; exit 1; }

echo "🟢 兩份都在：主線 $(du -sh dist | cut -f1)（含快車道 $(du -sh dist/next | cut -f1)）"
