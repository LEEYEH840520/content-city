# 李曄的內容城市（2D 版）

靈感來自 HEART 政策島：把履歷做成一座 2D 城市。每一棟建築是一項職能、理念或案例，建築之間的線表示它們的關係。

```
index.html   頁面骨架（一般不用改）
style.css    樣式；改配色就改最上面的 :root 變數
app.js       程式（一般不用改）
data.js      ★ 所有內容都在這裡
assets/      圖片（avatar.jpg 是大頭照）
```

直接用瀏覽器打開 `index.html` 就能看，不需要安裝任何東西。

## 網址不會變

- 整個網站只有一頁。切換地圖、清單、打開格子，網址都維持原樣（不使用 `#` 或其他路由）。
- 之後要加內容，只要改 `data.js` 再重新上傳，網址還是同一個。

## 擴充內容（只改 data.js）

**新增一格**：在 `items` 加一筆，會自動排到該地區的空格，城市也會跟著長大。

```js
{
  id: 'case-new',            // 不重複的英文 id
  cat: 'case',               // 放在哪個地區（對應 categories 的 id）
  icon: '🚀',
  title: '新案例名稱',
  subtitle: '「一句引言」',
  stats: [{ value: '10 萬+', label: '觀看數' }],
  fields: [['角色定位', '...'], ['關鍵操作', '...']],
  links: [{ label: 'IG', url: 'https://instagram.com/...' }],
  rel: ['skill-script', 'svc-short'],   // 要連協作線的格子 id
},
```

**新增一個地區**：在 `categories` 加一筆，`anchor` 填在空曠的位置（例如 `[-6, 0]` 或 `[7, 1]`）。

```js
{ id: 'award', name: '榮譽燈塔', label: '獲獎紀錄', icon: '🏆', color: '#f5b971', anchor: [-6, 0] },
```

**讓某區不能點**：在該地區加 `clickable: false`（目前「職能局」「服務處」就是這樣），建築只顯示名稱、不能點開。單一格也可以在 `items` 裡加 `clickable: false`。

**風格**：遊戲地圖感的木頭拼圖島。海中央一整座大島，島上其他區域是灰調的拼圖片；亮起來、浮起來的那一塊就是我的城市，每個地區是一片粉彩拼圖。市中心固定是「市政府」；地區加 `building: 'civic'` 會整區合併成一座大房子，招牌列出底下每一項（目前是職能局、服務處，不能點）；其他內容是一塊正方形小木片。協作線預設關閉，可用下方工具列打開。

**建築大小**：預設依內容量自動計算（文字越多、數據 / 連結越多 → 木片越大）。想手動指定，在那一格加 `weight: 0.8`（0 最小、1 最大）。

**城市動物**：貓、狗、水豚、鴿子、斑鳩、鸚鵡會自動出現在公園和廣場，點牠們會叫一聲。下方工具列「🐾 動物」可以隱藏。

**代表作影片**：在那一格加 `videos: [{ label: '代表作', url: '影片網址' }]`，面板裡會出現封面，點了才載入播放器。支援 YouTube、Instagram Reels、Facebook Reels 的網址；可以放多支。影片播放時背景音樂會自動安靜。

**索引卡的亮點數字**：`site.stats`（最多三個）。

**聯絡入口**：右上角（手機在右下角）的「聯絡我」按鈕，和每個面板底部的邀請，文字在 `site.contactLabel`、`site.cta`，打開的是 `site.contactId` 那一格。

**分享預覽圖**：`assets/og.jpg`（1200×630），貼到 LINE / FB 時顯示。城市改版很多時可以請 Claude 重新截一張。

**補上連結**：`links` 的 `url` 留空就不會顯示按鈕，填上網址就會出現。

## 已上線

網址：https://leeyeh840520.github.io/content-city/
（GitHub repo：https://github.com/LEEYEH840520/content-city ）

**之後要更新網站**：改好檔案後，在這個資料夾執行

```
git add -A
git commit -m "更新內容"
git push
```

約 1 分鐘後網站就會更新，網址不變。也可以直接請 Claude 幫你推上去。

不會上傳的檔案寫在 `.gitignore`（履歷 PDF、原始大圖）。
