/** 家庭行程站設定（GitHub Pages／jsDelivr 靜態站；可改相簿 URL） */
window.FAMILY_TOURS_SITE = {
  brand: { short: "家庭行程", mark: "旅" },
  immich: {
    label: "家庭 Immich 相簿",
    /** 請改成實際 shared album 連結，例如 https://immich.3q.fi/albums/<uuid> */
    url: "https://immich.3q.fi/albums",
    hint: "登入後可從相簿列表進入峴港行前／出遊相簿",
  },
  homeHero: {
    title: "家庭出團行程",
    subtitle: "日期、地圖、航班與景點備忘 — 給家人一眼看懂動線。",
    coverFile: "Golden Bridge at Ba Na Hills 20250718.jpg",
  },
  tours: [
    {
      id: "danang-27sv125br1",
      href: "danang-lion-27sv125br1-map.html",
      title: "超值峴港 5 日",
      status: "confirmed",
      statusLabel: "已確認參團",
      chip: "27SV125BR1-T",
      depart: "2027-01-25",
      return: "2027-01-29",
      coverFile: "My Khe Beach, Da Nang, Vietnam.jpg",
      summary:
        "桃園長榮 BR391/392 · Date + Map · OSRM 車程 · POI 詳情與中文短片。",
      cta: "開啟行程地圖",
    },
    {
      id: "danang-baseline",
      href: "danang-lion-baseline-map.html",
      title: "峴港團 · 比價基線地圖",
      status: "draft",
      statusLabel: "比價參考",
      chip: "JX1 示意",
      depart: null,
      return: null,
      coverFile: "Da Nang.jpg",
      summary: "早期星宇／JX1 示意動線，僅供比價與景點順序參考，非本次已報名團。",
      cta: "開啟基線地圖",
    },
  ],
};
