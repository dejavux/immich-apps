/** 27SV125BR1-T 行程擴充（家庭用）· 圖片用 Commons 檔名；影片為中文 YouTube 短片（可多段，地圖頁輪播） */
window.TOUR_ENRICHMENT = {
  flights: {
    outbound: {
      flightNo: "BR391",
      airline: "長榮航空",
      date: "2027-01-25",
      from: "TPE 桃園",
      to: "DAD 峴港",
      depart: "09:45",
      arrive: "11:40",
      trackLinks: [
        { label: "Flightradar24 · BR391", url: "https://www.flightradar24.com/data/flights/br391" },
        { label: "民航局 · 桃園航班", url: "https://www.caa.gov.tw/ImmediateFlight.aspx?a=270&lang=1" },
      ],
    },
    inbound: {
      flightNo: "BR392",
      airline: "長榮航空",
      date: "2027-01-29",
      from: "DAD 峴港",
      to: "TPE 桃園",
      depart: "13:00",
      arrive: "16:50",
      trackLinks: [
        { label: "Flightradar24 · BR392", url: "https://www.flightradar24.com/data/flights/br392" },
        {
          label: "民航局 · 桃園抵達",
          url: "https://www.caa.gov.tw/ImmediateFlight.aspx?a=270&lang=1&sad=A&sap=TPE&sl=2",
        },
      ],
    },
  },
  optionalTours: [
    {
      title: "會安古鎮夜遊／乘船賞燈",
      days: "D2 前後",
      priceHint: "約 USD 10–20／人（領隊報價）",
      note: "常見自費：秋盆河或古鎮夜遊；是否成行看團員與領隊安排。",
    },
    {
      title: "五行山電梯／溶洞導覽",
      days: "D3",
      priceHint: "約 VND 40,000–150,000",
      note: "纜梯與部分洞窟可能自費；跟團含外觀時內部另計。",
    },
    {
      title: "巴拿山園區加購",
      days: "D4",
      priceHint: "依園區當日票種",
      note: "部分遊樂設施、酒窖品酒、快通等可能另費；團費通常含纜車＋主要景點。",
    },
    {
      title: "特色SPA／按摩",
      days: "D1–D4 晚",
      priceHint: "約 VND 300,000 起",
      note: "飯店或海濱按摩；注意營業時間與團體集合。",
    },
    {
      title: "會安訂製服／鞋",
      days: "D2",
      priceHint: "依料件與工時",
      note: "非強迫消費；本團標示無購物店，但古鎮自由時間可自選工作室。",
    },
  ],
  optionalDisclaimer:
    "自費項目未列於雄獅 API；以上為峴港團常見選項，**以出團領隊說明與當日安排為準**。本商品標示無購物。",
  poi: {
    dad: {
      title: "峴港國際機場 (DAD)",
      type: "交通",
      intro: "峴港國際機場為中部門戶，距美溪海灘約 15–20 分鐘車程。跟團通常有領隊與導遊接機。",
      images: [{ file: "Da Nang Airport 1.jpg", caption: "峴港機場航廈" }],
      videos: [{ youtubeId: "9hP-N-_fh0M", title: "峴港機場與接駁交通實拍（約 1 分）" }],
      events: [],
      shop: [
        {
          text: "越南腰果、咖啡粉",
          image: { file: "Roasted Cashew Nuts (52746470588).jpg" },
        },
        { text: "防曬、草帽", image: { file: "Beach chair.jpg" } },
        { text: "越式滴漏咖啡組", image: { file: "Vietnamese coffee ベトナムコーヒー DSCF1830.jpg" } },
      ],
    },
    "lodge-dn": {
      title: "峴港海濱飯店區",
      type: "Lodge",
      intro:
        "多為美溪海濱 4 星或同級，實際飯店以雄獅出團通知為準（Paris Deli Beach、Cicilia、Canvas 等）。",
      images: [
        { file: "My Khe Beach, Da Nang, Vietnam.jpg", caption: "美溪海灘" },
        { file: "Da Nang.jpg", caption: "峴港海濱天際線" },
      ],
      videos: [
        { youtubeId: "i-w0adMwpC0", title: "美溪沙灘療癒海景（約 1 分）" },
        { youtubeId: "gwhzBRSdvEU", title: "美溪沙灘日出空拍（約 4 分）" },
      ],
      events: ["部分飯店週末海濱活動（依飯店）"],
      shop: [
        { text: "便利店飲料、防蚊", image: { file: "Convenience store.jpg" } },
        { text: "海灘椰子、小吃", image: { file: "Coconut drink.jpg" } },
      ],
    },
    "lodge-hoian": {
      title: "會安古鎮住宿區",
      type: "Lodge",
      intro: "古鎮外圍或河畔飯店，方便夜遊燈籠街。",
      images: [
        { file: "Hội An, Ancient Town, 2020-01 CN-10.jpg", caption: "會安古鎮街道" },
        { file: "Hội An, Ancient Town, 2020-01 CN-06.jpg", caption: "燈籠街景" },
      ],
      videos: [
        { youtubeId: "xmWGI3uZT-E", title: "會安古城與手作燈籠（約 1 分）" },
        { youtubeId: "GArWbNlAhQ8", title: "會安燈籠古鎮氛圍（約 4 分）" },
      ],
      events: ["會安燈籠節（若日期重合）", "河畔放燈（部分自費）"],
      shop: [
        { text: "手工燈籠", image: { file: "Hoi An lanterns.jpg" } },
        { text: "皮革、奧黛布料", image: { file: "Ao dai.jpg" } },
      ],
    },
    sontra: {
      title: "山茶半島",
      type: "景點",
      intro: "峴港東北側山海公路，可遠眺峴港灣。",
      images: [
        {
          file: "Son-Tra-Peninsula Da-Nang Vietnam Statue-of-the-Bodhisattva-of-Mercy-01.jpg",
          caption: "山茶半島海岸",
        },
      ],
      videos: [{ youtubeId: "7jPVHecQX9Y", title: "山茶半島山海公路（約 1.5 分）" }],
      events: [],
      shop: [{ text: "路邊水果", image: { file: "Mango fruit.jpg" } }],
    },
    "sontra-pagoda": {
      title: "靈應寺（山茶）",
      type: "景點",
      intro: "巨大觀音像為地标；尊重寺廟禮儀。",
      images: [
        {
          file: "Son-Tra-Peninsula Da-Nang Vietnam Statue-of-the-Bodhisattva-of-Mercy-01.jpg",
          caption: "山茶靈應寺觀音像",
        },
      ],
      videos: [
        { youtubeId: "7jPVHecQX9Y", title: "靈應寺與觀音像（約 1.5 分）" },
        { youtubeId: "SmzGDmJQS3U", title: "山茶半島靈應寺海景（約 4 分）" },
      ],
      events: [],
      shop: [{ text: "香火、紀念品", image: { file: "Incense sticks.jpg" } }],
    },
    mykhe: {
      title: "美溪沙灘",
      type: "景點",
      intro: "沙質細軟的名海灘；注意浪況與旗幟。",
      images: [
        { file: "My Khe Beach, Da Nang, Vietnam.jpg", caption: "美溪沙灘" },
        { file: "My Khe Beach Da Nang.jpg", caption: "海灘活動" },
      ],
      videos: [
        { youtubeId: "i-w0adMwpC0", title: "美溪沙灘漫步（約 1 分）" },
        { youtubeId: "gwhzBRSdvEU", title: "世界最美海岸線之一（約 4 分）" },
      ],
      events: [],
      shop: [
        { text: "泳衣、浮潛裝備", image: { file: "Beach chair.jpg" } },
        { text: "沙灘椅（可能自費）", image: { file: "Beach chair.jpg" } },
      ],
    },
    camnam: {
      title: "迦南島生態之旅",
      type: "景點",
      intro: "竹桶船穿行椰子林；**實際為水路**，地圖車線為陸路接駁示意。",
      images: [
        { file: "Hội An, Ancient Town, 2020-01 CN-06.jpg", caption: "會安水鄉（示意）" },
        { file: "Coconut drink.jpg", caption: "椰子林／椰子飲" },
      ],
      videos: [
        { youtubeId: "_BIhCtQ_q0Q", title: "迦南島竹籃船旋轉體驗（約 12 秒）" },
        { youtubeId: "AEl2MgjMcrs", title: "竹筒船水上活動（約 30 秒）" },
        { youtubeId: "wgSsYaTJEUc", title: "迦南島竹桶船實拍（約 1 分）" },
        { youtubeId: "2_krIf2Siec", title: "秋盆河竹桶船（約 1 分）" },
      ],
      events: ["竹桶船（通常含在團費，以行程表為準）"],
      shop: [
        { text: "椰子糖", image: { file: "Coconut drink.jpg" } },
        { text: "斗笠", image: { file: "Aodai-nonla-crop.jpg" } },
      ],
    },
    hoian: {
      title: "會安古鎮",
      type: "景點",
      intro: "世界文化遺產古城，黃牆燈籠、日本橋；傍晚至夜間最佳。",
      images: [
        { file: "Hội An, Ancient Town, 2020-01 CN-10.jpg", caption: "古鎮街道" },
        { file: "Hội An, Chùa Cầu, 2020-01 CN-01.jpg", caption: "日本橋（來遠橋）" },
        { file: "Hội An, Ancient Town, 2020-01 CN-11.jpg", caption: "夜間燈籠" },
      ],
      videos: [
        { youtubeId: "s1z0xd3rNDM", title: "日本橋（來遠橋）與古鎮（約 1.5 分）" },
        { youtubeId: "_eXPxWTKJeU", title: "會安古鎮日本橋（約 1.5 分）" },
        { youtubeId: "xmWGI3uZT-E", title: "手作燈籠與古城漫步（約 1 分）" },
        { youtubeId: "BXJEI43IC7E", title: "黃牆燈籠與古橋氛圍（約 3.5 分）" },
      ],
      events: ["街頭表演（季節性）", "印象會安秀（若自費）"],
      shop: [
        { text: "燈籠、木雕", image: { file: "Hoi An lanterns.jpg" } },
        { text: "訂製鞋", image: { file: "Leather shoes.jpg" } },
        { text: "越南咖啡", image: { file: "Vietnamese coffee.jpg" } },
      ],
    },
    marble: {
      title: "五行山",
      type: "景點",
      intro: "石灰岩洞窟與天梯；穿走路方便的鞋。",
      images: [
        { file: "Marble Mountains View 3.JPG", caption: "五行山" },
        { file: "Marble Mountains View 3.JPG", caption: "山景與洞窟" },
      ],
      videos: [
        { youtubeId: "6YPEzj7t9og", title: "五行山石灰岩景觀（約 36 秒）" },
        { youtubeId: "qfR_B7MyxLc", title: "五行山與靈應寺一帶（約 4 分）" },
      ],
      events: [],
      shop: [
        { text: "大理石雕刻", image: { file: "Marble sculpture.jpg" } },
        { text: "小佛像紀念品", image: { file: "Marble sculpture.jpg" } },
      ],
    },
    pinkchurch: {
      title: "峴港大教堂（粉紅教堂）",
      type: "景點",
      intro: "粉紅哥德式外觀；彌撒時間請保持安靜。",
      images: [{ file: "Da Nang Cathedral.jpg", caption: "粉紅教堂" }],
      videos: [
        { youtubeId: "a8NMFFYPwjc", title: "粉紅教堂外觀（約 20 秒）" },
        { youtubeId: "6HMOJp2Cgg4", title: "峴港大教堂實拍（約 1 分）" },
        { youtubeId: "tCkRu9w0NxE", title: "粉紅教堂旅遊紀錄（約 1 分）" },
      ],
      events: ["週日彌撒（若開放參觀）"],
      shop: [{ text: "周邊咖啡店", image: { file: "Ca Phe Sua Da.jpg" } }],
    },
    apec: {
      title: "APEC 公園",
      type: "景點",
      intro: "海濱步道與會展地標，適合團體拍照。",
      images: [{ file: "Da Nang.jpg", caption: "峴港海濱（APEC 公園一帶示意）" }],
      videos: [
        { youtubeId: "HSKbktAxWNc", title: "APEC 紀念公園（約 40 秒）" },
        { youtubeId: "cdkOjar2Fr8", title: "APEC 公園周邊氛圍（約 2 分）" },
      ],
      events: [],
      shop: [{ text: "紀念品小攤", image: { file: "Souvenir shop.jpg" } }],
    },
    dragon: {
      title: "龍橋",
      type: "景點",
      intro: "橫跨韓江；**週六日晚間**常噴火／喷水。",
      images: [
        { file: "Da Nang.jpg", caption: "韓江與峴港市景（龍橋一帶）" },
        { file: "Da Nang.jpg", caption: "週末夜間活動（以當局公告為準）" },
      ],
      videos: [
        { youtubeId: "VNzytSZlDzI", title: "龍橋週末噴火（約 26 秒）" },
        { youtubeId: "mL8_CFSICsI", title: "龍橋噴火噴水體驗（約 50 秒）" },
      ],
      events: ["週末夜間噴火秀（以當局公告為準）"],
      shop: [{ text: "橋畔夜市小吃", image: { file: "Street food in Vietnam.jpg" } }],
    },
    "bana-gate": {
      title: "巴拿山纜車站",
      type: "景點",
      intro: "上山纜車；山上較涼，建議薄外套。",
      images: [{ file: "Ba Na Hills French Village.jpg", caption: "巴拿山園區（纜車上山）" }],
      videos: [
        { youtubeId: "RlrvpYCp1ec", title: "搭乘巴拿山高空纜車（約 2 分）" },
        { youtubeId: "Wpz4eBOW_q8", title: "纜車前往 Sun World 巴拿山（約 2 分）" },
        { youtubeId: "LaoNhlvwMx4", title: "上山沿途精華快剪（約 22 秒）" },
      ],
      events: [],
      shop: [{ text: "雨披、紀念品", image: { file: "Raincoat.jpg" } }],
    },
    "golden-bridge": {
      title: "黃金佛手橋",
      type: "景點",
      intro: "Ba Na 金色步道由石手托起；晨霧時最上鏡。",
      images: [
        { file: "Golden Bridge at Ba Na Hills 20250718.jpg", caption: "黃金佛手橋" },
        {
          file: "Aerial view of the Golden Bridge, Ba Na Hills, Da Nang, Vietnam.jpg",
          caption: "航拍",
        },
      ],
      videos: [
        { youtubeId: "LaoNhlvwMx4", title: "黃金佛手橋快剪（約 22 秒）" },
        { youtubeId: "9Ll_4dEtb5E", title: "佛手托橋景觀（約 2 分）" },
        { youtubeId: "GETk6t5dXxA", title: "佛手橋漫步實拍（約 4.5 分）" },
      ],
      events: [],
      shop: [{ text: "山頂葡萄酒、點心", image: { file: "Wine bottle.jpg" } }],
    },
    "bana-top": {
      title: "巴拿山山頂園區",
      type: "景點",
      intro: "法國村、靈應寺、遊樂設施；優先跟領隊動線。",
      images: [
        { file: "Ba Na Hills French Village.jpg", caption: "法國村" },
        { file: "Golden Bridge at Ba Na Hills 20250718.jpg", caption: "山頂園區" },
      ],
      videos: [
        { youtubeId: "LaoNhlvwMx4", title: "巴拿山園區精華（約 22 秒）" },
        { youtubeId: "RlrvpYCp1ec", title: "纜車與山頂園區（約 2 分）" },
        { youtubeId: "9Ll_4dEtb5E", title: "佛手橋與山頂景色（約 2 分）" },
      ],
      events: ["園區定時表演", "部分遊樂設施另費"],
      shop: [
        { text: "葡萄酒、乳酪", image: { file: "Wine bottle.jpg" } },
        { text: "主題樂園紀念品", image: { file: "Souvenir shop.jpg" } },
      ],
    },
    hanmarket: {
      title: "韓江市集 Han Market",
      type: "景點",
      intro: "市區傳統市場，適合最後採買伴手禮。",
      images: [{ file: "Vietnamese coffee.jpg", caption: "市集採買（示意）" }],
      videos: [
        { youtubeId: "OuQWQg4b-O0", title: "峴港伴手禮怎麼買（約 22 秒）" },
        { youtubeId: "OQqn50tU32U", title: "Han Market 韓市場逛街（約 3.5 分）" },
      ],
      events: [],
      shop: [
        { text: "咖啡粉、果乾", image: { file: "Coffee beans.jpg" } },
        { text: "腰果", image: { file: "Roasted Cashew Nuts (52746470588).jpg" } },
        { text: "滴漏杯", image: { file: "Vietnamese coffee ベトナムコーヒー DSCF1830.jpg" } },
      ],
    },
  },
};
