# 台東 x 墾丁家庭旅行助手

這是手機優先的純靜態 MVP，可直接用瀏覽器開啟，不需要 React、Node、資料庫或建置工具。

## 直接開啟

在檔案總管中打開 `index.html` 即可使用。

## 使用本機伺服器

若瀏覽器因本機安全限制無法載入資料，請在此資料夾執行：

```bash
python -m http.server 8000
```

然後開啟：

```text
http://localhost:8000
```

## 放入菜單圖片

把圖片放到 `assets/menus/`，檔名需與 `data/itinerary.js` 內的 `menuImages` 一致。例如：

```text
assets/menus/day1-pizza.jpg
```

圖片尚未放入時，網站會顯示待補提示，不會出現破圖。

主方案與備案都支援一張或多張菜單圖：

```js
menuImages: [
  "assets/menus/filename.jpg"
]
```

備案的菜單圖也只需要在 `data/itinerary.js` 補上，不需要改 `app.js`。

## 修改行程

所有行程資料都在 `data/itinerary.js`。每個站點至少包含：

```text
id, day, date, time, title, description, latestDeparture, address, phone,
mapQuery, menuImages, mapImages, notes, alternatives, externalLinks
```

已知地址的站點會使用 Google Maps Search URL。尚未確認地址或電話的欄位請保留空字串或 TODO，不要自行補猜。

導航目的地可用 `navigationTargets`，適合一個站點內有多個店家或景點：

```js
navigationTargets: [
  {
    label: "店家名稱",
    query: "店家名稱 地址或搜尋關鍵字",
    phone: "089123456",
    menuImages: ["assets/menus/example.jpg"]
  }
]
```

備案請使用物件格式，這樣 modal 內會自動顯示導航、電話與菜單按鈕：

```js
alternatives: [
  {
    title: "備案名稱",
    description: "簡短說明",
    mapQuery: "Google Maps 搜尋關鍵字",
    phone: "089123456",
    menuImages: ["assets/menus/example.jpg"]
  }
]
```

電話按鈕會使用 `tel:`，顯示時可保留易讀格式，程式會自動移除空白與連字號建立撥號連結。

## 家長工具密碼

家長工具預設密碼：`2027`。

家長工具密碼為純前端簡易防誤觸機制，並非安全登入。密碼可在 `app.js` 的 `PARENT_TOOL_PASSWORD` 修改，不應放入真正重要或常用的私人密碼。

## 未來部署 GitHub Pages

本輪不部署、不 commit、不 push。未來若要部署 GitHub Pages，可將整個資料夾推到 GitHub repository，並在 repository settings 的 Pages 選擇從 main branch 根目錄發布。
