/** 香港 18 區及常見地址關鍵字（用於地址比對） */
const HK_DISTRICT_KEYWORDS = {
  中西區: ['中西區', '中環', '上環', '西環', '堅尼地城', '半山', '山頂', '金鐘', '西營盤', '石塘咀'],
  灣仔區: ['灣仔區', '灣仔', '銅鑼灣', '跑馬地', '大坑', '天后', '寶雲道'],
  東區: ['東區', '北角', '鰂魚涌', '太古', '西灣河', '筲箕灣', '柴灣', '小西灣', '炮台山'],
  南區: ['南區', '香港仔', '鴨脷洲', '黃竹坑', '淺水灣', '赤柱', '石澳', '薄扶林', '華富'],
  油尖旺區: ['油尖旺區', '油尖旺', '尖沙咀', '佐敦', '油麻地', '旺角', '大角咀', 'iSQUARE', '國際廣場'],
  深水埗區: ['深水埗區', '深水埗', '荔枝角', '長沙灣', '美孚', '石硤尾', '蘇屋', '又一村'],
  九龍城區: ['九龍城區', '九龍城', '土瓜灣', '紅磡', '何文田', '啟德', '九龍塘', '馬頭圍'],
  黃大仙區: ['黃大仙區', '黃大仙', '鑽石山', '樂富', '新蒲崗', '慈雲山', '牛池灣', '彩虹'],
  觀塘區: ['觀塘區', '觀塘', '牛頭角', '藍田', '油塘', '九龍灣', '秀茂坪', '順利'],
  荃灣區: ['荃灣區', '荃灣', '葵涌', '青衣', '馬灣', '汀九'],
  屯門區: ['屯門區', '屯門', '藍地', '掃管笏', '龍鼓灘'],
  元朗區: ['元朗區', '元朗', '天水圍', '錦田', '八鄉', '洪水橋', '朗屏'],
  北區: ['北區', '上水', '粉嶺', '沙頭角', '打鼓嶺', '古洞'],
  大埔區: ['大埔區', '大埔', '太和', '大尾篤', '林村'],
  西貢區: ['西貢區', '西貢', '將軍澳', '坑口', '寶琳', '調景嶺', '清水灣'],
  沙田區: ['沙田區', '沙田', '大圍', '馬鞍山', '火炭', '石門', '小瀝源'],
  葵青區: ['葵青區', '葵青', '葵芳', '葵興', '青衣', '荔景', '青衣'],
  離島區: ['離島區', '離島', '大嶼山', '東涌', '愉景灣', '長洲', '南丫島', '坪洲', '梅窩', '大澳'],
};

const HK_DISTRICTS = Object.keys(HK_DISTRICT_KEYWORDS);

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDistrictAddressFilter(district) {
  const keywords = HK_DISTRICT_KEYWORDS[district];
  if (!keywords) return null;
  return {
    $or: keywords.map((kw) => ({ address: new RegExp(escapeRegex(kw), 'i') })),
  };
}

/** 依地址推斷香港 18 區（migration / 建議用） */
function inferDistrictFromAddress(address) {
  const addr = String(address || '').trim();
  if (!addr) return null;

  let best = null;
  let bestLen = 0;
  for (const [district, keywords] of Object.entries(HK_DISTRICT_KEYWORDS)) {
    for (const kw of keywords) {
      if (addr.includes(kw) && kw.length > bestLen) {
        best = district;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

function isValidDistrict(value) {
  if (value == null || value === '') return true;
  return HK_DISTRICTS.includes(String(value).trim());
}

module.exports = {
  HK_DISTRICTS,
  HK_DISTRICT_KEYWORDS,
  buildDistrictAddressFilter,
  inferDistrictFromAddress,
  isValidDistrict,
};
