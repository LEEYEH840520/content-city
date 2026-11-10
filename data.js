/* =========================================================
 *  李曄的內容城市 — 資料檔
 *  ---------------------------------------------------------
 *  網站的「所有內容」都在這個檔案。要擴充內容時：
 *    1. 新增一個地區 → 在 categories 加一筆
 *    2. 新增一格內容 → 在 items 加一筆（會自動排到該地區的空格）
 *    3. 讓兩格相連   → 在 rel 填上對方的 id（會畫出協作線）
 *  其他檔案（index.html / app.js / style.css）都不用動。
 *  詳細說明請看 README.md
 * ========================================================= */

window.ISLAND_DATA = {
  site: {
    owner: '李曄',
    brand: 'LEE YEH',
    islandName: '內容城市',
    title: 'IP 操盤手 × 內容策略師',
    tagline: '一棟作品，一座相連的城市。',
    hint: '點一棟建築，開始探索',
    avatar: 'assets/avatar.jpg',
    /* 左上索引卡的三個亮點數字（給客戶看的重點，最多三個） */
    stats: [
      { value: '14 年', label: '剪輯實戰' },
      { value: '1,000+', label: '部影片' },
      { value: '200萬+', label: '最高自然流量' },
    ],
    /* 聯絡入口：右上角按鈕 + 每個面板底部的邀請（contactId 是要打開的那一格） */
    contactId: 'contact',
    contactLabel: '聯絡我',
    cta: { text: '想做類似的內容？', button: '聊聊合作' },
  },

  /* ---------- 開場導覽（第一次進站會出現） ---------- */
  intro: [
    {
      kicker: 'HELLO / 01',
      title: '大家好，我是李曄',
      text: 'IP 操盤手 × 內容策略師。結合 AI 與創意，讓角色有靈魂；讓內容有市場、故事能自我演化。',
    },
    {
      kicker: 'HOW TO / 02',
      title: '這是一座內容城市',
      text: '每一棟建築是一項職能、一個理念或一個合作案例；內容越豐富，大樓蓋得越高。建築之間的線，代表它們在實戰中如何互相支援。',
    },
    {
      kicker: 'START / 03',
      title: '點一棟建築，開始探索',
      text: '拖曳移動、滾輪或雙指縮放。街上住著貓狗、水豚和鳥兒，點點看牠們！也可以切換到「清單」，用列表方式瀏覽全部內容。',
    },
  ],

  /* ---------- 地區（分類） ----------
   * id     : 英文代號（items 用 cat 對應）
   * name   : 地區名稱（地圖上的大字）
   * label  : 分類名稱（篩選、清單用）
   * anchor : 地區中心在地圖格子上的位置 [欄, 列]，(0,0) 是城市中心
   * clickable : 填 false 代表這區的建築不能點開（只顯示名稱）
   * building  : 'civic' = 整區合併成一座大房子，招牌列出底下每一項（不能點）
   *             'house' 小房子、'post' 郵局、'lighthouse' 燈塔（可點）；不填 = 每項一塊小木片
   */
  categories: [
    { id: 'hub',     name: '市中心',   label: '關於我',   icon: '🎬', color: '#f4c95d', anchor: [0, 0] },
    { id: 'contact', name: '郵局',     label: '聯絡',     icon: '✉️', color: '#ef8a7a', anchor: [-0.55, -1.15], building: 'post' },
    { id: 'skill',   name: '職能局',   label: '核心職能', icon: '🛠️', color: '#f2a65a', anchor: [-2, -1], clickable: false, building: 'civic' },
    { id: 'stage',   name: '我的理念', label: '經營理念', icon: '💡', color: '#8cc084', anchor: [0.55, -1.15], building: 'lighthouse' },
    { id: 'service', name: '服務處',   label: '服務範疇', icon: '🏪', color: '#6fb3d2', anchor: [-2, 1], clickable: false, building: 'civic' },
    { id: 'case',    name: '案例大街', label: '合作案例', icon: '🏙️', color: '#d98aa6', anchor: [2, 1] },
    { id: 'brand',   name: '合作足跡', label: '品牌足跡', icon: '👣', color: '#a99be0', anchor: [0, 2] },
  ],

  /* ---------- 每一格內容 ----------
   * 必填：id、cat、title
   * 選填：
   *   short    地圖名牌上的短名稱（沒填就用 title）
   *   icon     格子上的 emoji（沒填就用地區 icon）
   *   image    頭像圖片路徑（有填就取代 icon，例如 'assets/clients/xxx.jpg'）
   *   asOf     數據更新日期（會顯示在數字下方）
   *   pos      指定格子位置 [欄, 列]（沒填會自動排）
   *   weight   建築大小 0～1（沒填就依內容量自動計算）
   *   clickable 填 false 就不能點開
   *   subtitle 引言 / 副標
   *   summary  一句話摘要
   *   stats    [{ value, label }] 數字亮點
   *   fields   [[標題, 內容]] 條列資訊
   *   body     [段落, 段落...] 長文
   *   tags     [標籤...]
   *   videos   [{ label, url }] 代表作影片，會直接嵌在面板裡（點了才載入）
   *            支援 YouTube、Instagram Reels、Facebook Reels 的網址
   *   links    [{ label, url }] 外部連結（url 空白就不顯示）
   *   rel      [相關格子的 id...] 協作線
   */
  items: [
    /* ===== 市中心 ===== */
    {
      id: 'me', cat: 'hub', pos: [0, 0], short: '李曄', icon: '🎬',
      title: '李曄',
      subtitle: '技術熟練度是內容產出的基本盤，而策略性的市場轉化才是核心價值。',
      summary: '在流量碎片化的時代，我主張影音不應只是視覺的堆疊，而是具備轉化邏輯的商業資產。我專注於透過精準的角色定位與 AI 策略工具，協助品牌建立長期的社群價值。',
      stats: [
        { value: '14 年', label: '剪輯實戰' },
        { value: '1,000+', label: '部影片' },
        { value: '2019', label: '投入自媒體' },
      ],
      body: [
        '我的剪輯生涯始於高中時期，這 14 年的實務累積，已讓剪輯從技術層面昇華為一種對影像節奏的「專業直覺」。2019 年，我正式投入自媒體領域，參與創立 YouTube 頻道【釣魚Bar】，完成了從零到一的品牌建構實操。',
        '至今，我已累積超過 1,000 部影片的實戰量能，經驗橫跨教育培訓、科技、醫美、房地產及消費品牌等多元領域。這種跨產業的歷練，使我具備敏銳的角色 IP 定位能力，能根據不同產業痛點進行內容編導，確保影片不僅吸睛，更能為品牌創造實質的營收轉化。',
      ],
      tags: ['教育培訓', '科技', '醫美', '房地產', '消費品牌'],
      rel: ['contact'],
    },

    /* ===== 郵局 ===== */
    {
      id: 'contact', cat: 'contact', pos: [-0.55, -1.15], short: '聯絡我', icon: '✉️',
      title: '一起合作吧',
      subtitle: '「務實產出，建立價值」是我對每一份作品的承諾。',
      summary: '在流量喧囂的時代，我更在乎內容是否能為合作夥伴解決問題、創造具體回報。若您正在尋找一位能將技術細節、創意溫度與市場邏輯完美結合的夥伴，歡迎隨時聯繫。',
      fields: [
        ['電話 / Line ID', '0980-680-452'],
        ['信箱', 'As4102054019@gmail.com'],
        ['地區', '雙北地區'],
      ],
      links: [
        { label: '寄信給我', url: 'mailto:As4102054019@gmail.com' },
        { label: '撥打電話', url: 'tel:0980680452' },
      ],
    },

    /* ===== 職能工坊 ===== */
    {
      id: 'skill-script', cat: 'skill', icon: '📝', title: '企劃腳本',
      summary: '深入理解品牌定位，撰寫具備故事性與市場引力的腳本，實現角色與市場的共鳴。',
    },
    {
      id: 'skill-shoot', cat: 'skill', icon: '🎥', title: '拍攝剪輯',
      summary: '憑藉 14 年實戰直覺，精準掌控影像節奏與視覺美學，打造高品質內容。',
    },
    {
      id: 'skill-account', cat: 'skill', icon: '📱', title: '帳號代操',
      summary: '橫跨 TikTok、IG、FB 的多平台經營策略，提升社群黏著度與粉絲轉化率。',
      tags: ['TikTok', 'IG', 'FB'],
    },
    {
      id: 'skill-ai', cat: 'skill', icon: '🤖', title: 'AI 內容生成',
      subtitle: 'AI 不僅是自動化工具，更是輔助創意與數據分析的策略大腦，讓每一份腳本都有據可循。',
      summary: '利用 AI 進行熱門題材分析、腳本優化與素材生成，提升製作效率與創意精準度。',
      rel: ['skill-script'],
    },
    {
      id: 'skill-ads', cat: 'skill', icon: '📣', title: '廣告投放',
      summary: '將優質內容轉化為精準的行銷素材，確保訊息觸及目標客群，達成高轉化成效。',
    },

    /* ===== 我的理念（獨立一格，不連協作線） ===== */
    {
      id: 'philosophy', cat: 'stage', pos: [0.55, -1.15], icon: '💡', title: '我的理念', short: '我的理念',
      subtitle: '唯有深耕內容質量並與觀眾建立穩固的「信任感」，才能實現品牌長期的戰略價值。',
      summary: '我深信，追求短期流量紅利是短視的。內容要經過四個階段的成長，才能具備自我演化的生命力。',
      fields: [
        ['01 被理解', '透過清晰的故事線與精確的角色定位，建立明確的品牌標籤。'],
        ['02 被喜歡', '賦予角色生命力與溫度，讓受眾產生情感連結而非僅是資訊接收。'],
        ['03 被信任', '透過穩定且持續的優質內容產出，建立品牌的專業性與可靠度。'],
        ['04 創造價值', '最終達成系統化運營，將流量轉化為真實的商業價值。'],
      ],
      body: ['這套邏輯能協助品牌從「點閱次數」轉化為「忠誠追隨」，將社群經營轉化為企業的長期資產。'],
    },

    /* ===== 服務市集 ===== */
    {
      id: 'svc-youtube', cat: 'service', icon: '▶️', title: 'YouTube 長影片製作', short: 'YouTube 長影片',
      summary: '適合深度的品牌敘事、教學內容或專業訪談。',
      rel: ['skill-shoot'],
    },
    {
      id: 'svc-short', cat: 'service', icon: '⚡', title: '短影片剪輯',
      summary: '針對 TikTok、Reels、Shorts 製作節奏明快、具備高穿透力的流量素材。',
      rel: ['skill-shoot'],
    },
    {
      id: 'svc-brandfilm', cat: 'service', icon: '✨', title: '形象影片',
      summary: '提升品牌視覺層次，建立專業職人或企業質感。',
    },
    {
      id: 'svc-event', cat: 'service', icon: '🎉', title: '活動花絮剪輯', short: '活動花絮',
      summary: '捕捉現場關鍵時刻，轉化為具備社群渲染力的宣傳素材。',
    },
    {
      id: 'svc-podcast', cat: 'service', icon: '🎙️', title: 'Podcast 製作', short: 'Podcast',
      summary: '跨足音頻市場，擴大內容的觸及深度與場景。',
    },
    {
      id: 'svc-ad', cat: 'service', icon: '📺', title: '廣告影片製作', short: '廣告影片',
      summary: '為投放而生的廣告素材，精準抓住目標客群的注意力，帶動實際轉換。',
    },

    /* ===== 案例大街 ===== */
    {
      id: 'case-mingli', cat: 'case', icon: '📶', image: 'assets/clients/mingli.jpg', title: '名立電信', asOf: '2026/11/06',
      subtitle: '「把最無聊的電信話題，變成最有趣的流量素材。」',
      stats: [
        { value: '200 萬+', label: '最高自然流量' },
        { value: '2.7 萬+', label: '社群粉絲' },
        { value: '8,887', label: 'IG 粉絲' },
      ],
      fields: [
        ['角色定位', '創業老闆、搞笑活潑的運動員、十年電信資深專家。'],
        ['關鍵操作', '以搞笑短劇與創意情境包裝枯燥的電信知識，利用二手手機回收價策略成功引導客戶回店。'],
      ],
      videos: [{ label: '代表作', url: 'https://www.instagram.com/reel/DPLIO-DEyoV/' }],
      links: [{ label: 'IG', url: 'https://www.instagram.com/mingli.tw/' }, { label: 'FB', url: 'https://www.facebook.com/profile.php?id=100063985424071' }],
      rel: ['skill-script', 'svc-short'],
    },
    {
      id: 'case-jiaxing', cat: 'case', icon: '🎓', image: 'assets/clients/jiaxing.jpg', asOf: '2026/11/06', title: '佳興老師', short: '佳興老師',
      subtitle: '「讓教育不只是授課，而是一場能轉化的品牌行銷。」',
      summary: '四個 TikTok 帳號 + IG 的矩陣經營。',
      stats: [
        { value: '14.3 萬', label: 'TikTok 主帳粉絲' },
        { value: '破萬', label: '衛星帳號平均' },
        { value: '2.46 萬', label: 'IG 粉絲' },
        { value: '100+', label: '學員轉化' },
      ],
      fields: [
        ['角色定位', '14 年培訓經驗資深業務、演說家、創業者。'],
        ['關鍵操作', '為不同平台設計差異化主題（業務力 / 幸福人生 / AI 教學），透過短影音精準導流至活動報名。'],
      ],
      links: [{ label: 'TikTok', url: 'https://www.tiktok.com/@haa00014' }, { label: 'IG', url: 'https://www.instagram.com/no1speaker_kevin/' }, { label: 'FB', url: 'https://www.facebook.com/topspeakerkevin' }],
      rel: ['skill-account', 'svc-short'],
    },
    {
      id: 'case-catherine', cat: 'case', icon: '🥂', image: 'assets/clients/catherine.jpg', asOf: '2026/11/06', title: 'Catherineeeeh（錢嫂系列）', short: 'Catherineeeeh',
      subtitle: '「讓一個人的生活，成為一個能變現的品牌故事。」',
      stats: [
        { value: '1.5 萬+', label: '半年 IG 增粉' },
        { value: '4.57 萬', label: '目前 IG 粉絲' },
        { value: '6,463', label: 'Threads 粉絲' },
        { value: '10+ 筆', label: '每日平均諮詢' },
      ],
      fields: [
        ['角色定位', '在美華人、醫美與房地產專業、敢講敢玩的強勢女力。'],
        ['關鍵操作', '題材橫跨餐廳探店、人生觀分享與街頭互動，結合 AI 工具優化腳本與熱門題材分析。'],
      ],
      videos: [{ label: '代表作', url: 'https://www.instagram.com/reel/DTe0OX0jxa0/' }],
      links: [{ label: 'IG 主帳', url: 'https://www.instagram.com/catherineeeeh/' }, { label: 'Threads', url: 'https://www.threads.com/@catherineeeeh' }],
      rel: ['skill-ai', 'skill-account'],
    },
    {
      id: 'case-nana', cat: 'case', icon: '👑', image: 'assets/clients/nana.jpg', title: '業務大姐頭 — 娜娜陳', short: '娜娜陳',
      subtitle: '「讓一位超業變成品牌，讓真誠成為最強的行銷力。」',
      stats: [
        { value: '1.2 萬', label: 'FB 粉絲（一年半）' },
        { value: '5,000+', label: 'TikTok' },
        { value: '20 家+', label: '企業邀約演講' },
        { value: '2 間', label: '加盟店' },
      ],
      fields: [
        ['角色定位', '超級業務、專業講師、接地氣的大姊頭。'],
        ['關鍵操作', '用影片說故事，傳遞真實的業務職人精神，將個人特質品牌化。'],
      ],
      videos: [{ label: '代表作', url: 'https://www.facebook.com/reel/1298572688575510' }],
      links: [{ label: 'FB', url: 'https://www.facebook.com/nanalovestoyota' }],
      rel: ['skill-script'],
    },
    {
      id: 'case-fishingbar', cat: 'case', icon: '🎣', image: 'assets/clients/fishingbar.jpg', asOf: '2026/11/06', title: '釣魚BAR',
      subtitle: '「從興趣出發，把日常變成一場娛樂節目。」',
      stats: [
        { value: '2.48 萬', label: '頻道訂閱' },
        { value: '2.5 年', label: '共同經營' },
      ],
      fields: [
        ['角色定位', '愛釣魚的男生、生活綜藝風格。'],
        ['關鍵操作', '共同經營 2.5 年，以「學習 + 綜藝」呈現釣魚主題，大幅提升內容娛樂性。'],
        ['品牌合作', '與知名品牌「漁拓釣具」達成優質長期合作。'],
      ],
      videos: [{ label: '代表作', url: 'https://www.youtube.com/watch?v=5AMUTDjxPiM' }],
      links: [{ label: 'YouTube', url: 'https://www.youtube.com/@bar6673' }],
      rel: ['me', 'svc-youtube', 'skill-shoot'],
    },
    {
      id: 'case-haoshidai', cat: 'case', icon: '🏦', image: 'assets/clients/haoshidai.jpg', asOf: '2026/11/06', title: '好事貸',
      subtitle: '「讓金融知識變得有溫度，也能被大眾看懂。」',
      stats: [
        { value: '6.59 萬', label: '頻道訂閱' },
        { value: '數十億+', label: '廣告帶動業績' },
      ],
      fields: [
        ['角色定位', '光頭老闆、銀行產業專家。'],
        ['關鍵操作', '將枯燥的專業知識以輕鬆語氣呈現，拉近與觀眾距離；影像素材應用於廣告投放。'],
      ],
      videos: [{ label: '代表作', url: 'https://www.youtube.com/watch?v=B_C1__dfq3A' }],
      links: [{ label: 'YouTube', url: 'https://www.youtube.com/@houseloantw/videos' }],
      rel: ['svc-youtube', 'skill-ads'],
    },
    {
      id: 'case-eip', cat: 'case', icon: '✏️', image: 'assets/clients/eip.png', title: 'eiP',
      subtitle: '「讓產品不只是功能，而是一種生活風格。」',
      stats: [{ value: '數千萬', label: '廣告營收' }],
      fields: [
        ['角色定位', 'iPad 周邊產品第一品牌，涵蓋觸控筆、保護殼等。'],
        ['關鍵操作', '製作品牌形象行銷片與直播切片，作為廣告行銷的核心素材。'],
      ],
      links: [{ label: '官網', url: 'https://www.eipstore.com.tw/' }],
      rel: ['svc-brandfilm', 'skill-ads'],
    },

    /* ===== 合作足跡（純後製） ===== */
    {
      id: 'brand-weilu', cat: 'brand', icon: '🌶️', image: 'assets/clients/weilu.jpg', asOf: '2026/11/06', title: '味旅（香料老司機 Rex）', short: '味旅',
      summary: '美食與香料品牌，強化視覺吸引力與美食質感。',
      stats: [
        { value: '4.02 萬', label: 'YouTube 訂閱' },
        { value: '1.78 萬', label: 'IG 粉絲' },
      ],
      videos: [{ label: '代表作', url: 'https://www.youtube.com/watch?v=JkQ76hIHX8s' }],
      links: [{ label: 'YouTube', url: 'https://www.youtube.com/@SPICES_JOURNEY_REX' }, { label: 'IG', url: 'https://www.instagram.com/spices_jny/' }],
      rel: ['skill-shoot'],
    },
    {
      id: 'brand-ecpro', cat: 'brand', icon: '💼', image: 'assets/clients/ecpro.jpg', asOf: '2026/11/06', title: 'ecpro.tw（林克威）', short: 'ecpro.tw',
      summary: '創業顧問與網路行銷相關知識影片，精準傳遞專業權威感。',
      stats: [{ value: '14.3 萬', label: 'IG 粉絲' }],
      links: [{ label: 'IG', url: 'https://www.instagram.com/ecpro.tw/' }],
      rel: ['skill-shoot'],
    },
    {
      id: 'brand-xuanyan', cat: 'brand', icon: '🌸', image: 'assets/clients/xuanyan.jpg', asOf: '2026/11/06', title: '瑄燕（書瑄 Jessica）', short: '瑄燕',
      summary: '品牌經營者的個人品牌形象視覺打造。',
      stats: [{ value: '1.23 萬', label: 'IG 粉絲' }],
      videos: [{ label: '代表作', url: 'https://www.instagram.com/reel/DQEZO2FEUcL/' }],
      links: [{ label: '官網', url: 'https://xuanyan.com.tw/' }, { label: 'IG', url: 'https://www.instagram.com/jessica913xuan/' }],
      rel: ['svc-brandfilm'],
    },
  ],

  /* ---------- 城市日誌（右下角輪播；id 可點擊跳到該格） ---------- */
  log: [
    { text: '名立電信的短劇衝上 200 萬+ 自然流量', id: 'case-mingli' },
    { text: '佳興老師 TikTok 主帳累積 14.3 萬粉絲', id: 'case-jiaxing' },
    { text: '錢嫂系列 IG 粉絲突破 4.5 萬', id: 'case-catherine' },
    { text: '娜娜陳開設第 2 間加盟店', id: 'case-nana' },
    { text: '釣魚BAR 與漁拓釣具達成長期合作', id: 'case-fishingbar' },
    { text: '好事貸頻道累積 6.59 萬訂閱', id: 'case-haoshidai' },
    { text: 'eiP 廣告素材創造數千萬營收', id: 'case-eip' },
    { text: 'AI 工坊正在分析本週熱門題材', id: 'skill-ai' },
    { text: '剪輯室累計作品超過 1,000 部', id: 'me' },
  ],
};
