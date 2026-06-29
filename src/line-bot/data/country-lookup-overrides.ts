/**
 * Manual country/city patterns with higher priority than CLDR-generated entries.
 * City keywords that imply a country are listed here (not in CLDR territories).
 */
export const COUNTRY_LOOKUP_OVERRIDES: Array<[RegExp, string]> = [
  [/台灣|臺灣/, "Taiwan, Province of China"],
  [/韓國|南韓|首爾/, "South Korea"],
  [/美國|紐約|洛杉磯|舊金山/, "United States"],
  [/英國|倫敦/, "United Kingdom"],
  [/法國|巴黎/, "France"],
  [/義大利|羅馬|威尼斯/, "Italy"],
  [/澳洲|雪梨/, "Australia"],
  [/泰國|曼谷/, "Thailand"],
  [/中國|北京|上海/, "China"],
  [/丹麥|哥本哈根/, "Denmark"],
  [/日本/, "Japan"],
  [/挪威/, "Norway"],
  [/新加坡/, "Singapore"],
  [/香港/, "Hong Kong"],
];
