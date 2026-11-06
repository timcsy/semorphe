# 有些網路連不上 semorphe.com——GitHub Pages 整組被擋

> 狀態：🟡 使用者決定先維持現狀；觀察 flushdns 是否有效（使用者還不確定）（2026-11-07）。
> 決定：DNS 先不改 A 記錄｜使用者原話（直接對窗口說，經窗口轉達）｜「DNS先照現在這樣，我發現似乎學校電腦執行ipconfig /flushdns是有效的，還不是很確定」（出處：11-07）｜取代：本檔原本的推薦 A0（只留 111）暫不執行。
> 🟡 與量測對得上的推測（窗口提、工人照〈🔴 量到的原因〉判斷）：flushdns 之後重新解析，**剛好拿到 111 那一個**就能開——是看運氣，快取到別的 IP 時還會再發生。
> 驗證（在連不上的那台）：`nslookup semorphe.com` 看拿到哪個 IP → `ipconfig /flushdns` → 再 `nslookup` 看有沒有變；能開的那幾次應該都是 111。若證實如此，A0 仍是根治的那一個。
> （原狀態：🟡 待使用者決定（2026-11-05；附推薦）。**原因已量到：GitHub Pages 四個 IP 裡有三個在這個網路被擋**（見〈🔴 量到的原因〉）。使用者回報：「在另外一台電腦無法開啟 semorphe.com，顯示 ERR_CONNECTION_RESET，有一些電腦則可以開；不能開的電腦開別的網站可以」。）

## 量到的（2026-11-05，開發機當時的網路）

| 連線 | 結果 |
|---|---|
| `https://semorphe.com`、`https://www.semorphe.com` | ❌ reset |
| `https://timcsy.github.io`、`https://pages.github.com` | ❌ reset（**所有 GitHub Pages**） |
| `https://github.com` | ✅ |
| `http://semorphe.com`（80 埠） | ✅ 200 |

- TCP 連得上；送出 TLS 的 Client Hello 之後立刻被 reset——**網路上的過濾設備依 SNI 擋**的典型樣子。換 TLS 1.2、HTTP/1.1 一樣。
- DNS 正確（GitHub Pages 的 185.199.108～111.153 與 IPv6）；憑證有效（Let's Encrypt，到 2027-01-27）。
- ⟹ **不是 semorphe 的設定壞了**；是某些網路（學校／公司的內容過濾、電信業者的過濾服務、路由器的家長控制、防毒的網頁防護）把 GitHub Pages 整組擋掉。

## 🔴 量到的原因（2026-11-05，使用者再補：「另一個 GitHub Pages 託管的 cella-lang.org 卻可以開」）

四個 IP × 兩個網址交叉測（`curl --resolve`）：

| IP | semorphe.com | cella-lang.org |
|---|---|---|
| 185.199.108.153 | ❌ reset | ❌ reset |
| 185.199.109.153 | ❌ reset | ❌ reset |
| 185.199.110.153 | ❌ reset | ❌ reset |
| 185.199.111.153 | ✅ 200 | ✅ 200 |

⟹ **擋的是 IP，不是網址**。DNS 每次輪流回這四個，電腦拿到哪個排前面就連哪個（還會快取）——拿到 111 的能開，所以「教室約三分之一能開」「cella-lang.org 能開」都是剛好拿到 111。下面 IPv6／HTTP/3 的推測在這張表之後**不再是主因**（留作脈絡）。

## 推測（被上面那張表取代）：同一間教室，約三分之一的電腦能開

整個網路擋的話應該全部不能開 ⟹ 過濾設備只擋**某一種連線方式**，能開的那些走了另一條路。最可能的兩個：
1. **IPv6**（TANet 常見）——semorphe.com 有 AAAA；很多過濾設備只檢查 IPv4。有 IPv6 的電腦優先走 v6 → 繞過；只有 v4 的被依 SNI reset。
2. **HTTP/3（UDP 443）**——GitHub Pages 支援 h3；過濾設備多半只看 TCP 的 TLS。曾經連成功過的 Chrome 記得 Alt-Svc、下次直接走 QUIC。

分辨：能開與不能開各一台，開 test-ipv6.com；`curl -4 -I https://semorphe.com` 與 `curl -6 -I https://semorphe.com` 比。

## 🟢 臨時的路：`http://semorphe.com`

80 埠沒有被擋（量到 200）。頁面能開之後執行與判斷都在瀏覽器裡（Cella 的 wasm），用 http 不影響功能。
⚠️ 所以**在這件事解決之前，不要打開 GitHub Pages 的 Enforce HTTPS**——打開之後 http 會被轉到 https，這條路就沒了。
（2026-11-05 第一版這裡建議打開它——那是在知道「教室要靠 http 先用」之前寫的，已收回。）

## 🟡 要你決定：學生在會擋 GitHub Pages 的網路上怎麼辦

| 選項 | 做法 | 代價 |
|---|---|---|
| **A0（推薦，最快）DNS 的 A 記錄只留 `185.199.111.153`**（AAAA 不動）＋ 請網管解封另外三個 IP | 在網域服務商後台改；各電腦等 DNS 快取過期（幾分鐘到一小時） | 少了 GitHub 的四 IP 備援——111 出問題時沒有替代；網管解封後可以改回四筆 |
| A 先不動託管，請網管加白名單；同時把「被擋時怎麼辦」寫進說明頁 | 學校網管把 `semorphe.com`（與 `*.github.io`）放行 | 不花錢、不動 DNS；每個學校要各自處理一次 |
| B 在前面加 Cloudflare 代理（DNS 交給 Cloudflare、橘色雲） | 連線的 IP 與憑證換成 Cloudflare 的，不再落在「GitHub Pages 整組」的規則裡 | 要把網域的 DNS 搬到 Cloudflare；多一層要維護的設定；Cloudflare 的 IP 也可能被別的規則擋 |
| C 換託管（Cloudflare Pages／Netlify／自架） | 部署流程（`deploy.yml`）改發到新的地方 | 改 CI、搬 DNS；e2e 與預覽流程要跟著改 |

**推薦 A0 ＋ A**：量到被擋的是三個特定 IP，只留可用的那一個立刻見效、而且可以改回；同時請網管解封。原本的理由仍成立——被擋的是特定網路的政策，最直接的解法是在那個網路放行；B／C 只是換一個「也可能被擋」的位置，而且動到 DNS 與部署。若真的有一批學校擋而網管不配合，再走 B（比 C 改得少）。

## 怎麼確認是哪一種擋（給使用者在那台電腦上做）

1. 改用手機熱點 → 能開 ⟹ 是原本的網路在擋。
2. 熱點也不能開 ⟹ 是那台電腦上的軟體（防毒的網頁防護、VPN、公司的管理程式）。
