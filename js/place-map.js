// ================= 由 Google 地點資料，換算成「新增景點」需要填的欄位 =================
// 輸入：trip-tools 的 place 查詢結果（名稱、座標、評分、營業時間、地點類型、價位）
// 輸出：名稱、類型（美食／文化／自然／購物）、子分類（與內建資料同一組詞）、建議停留、每人概估費用、座標、營業時間、所屬地區
// 依序比對，先符合的先用。[Google 類型, 類型, 子分類, 建議停留分鐘]
var PLACE_RULES=[
  ['ramen_restaurant','f','拉麵',60],['noodle_restaurant','f','麵食',60],['udon_restaurant','f','麵食',60],['soba_restaurant','f','麵食',60],
  ['sushi_restaurant','f','日式料理',75],['japanese_restaurant','f','日式料理',75],['tempura_restaurant','f','日式料理',75],['kaiseki_restaurant','f','日式料理',90],
  ['barbecue_restaurant','f','燒肉',90],['korean_barbecue_restaurant','f','燒肉',90],['yakiniku_restaurant','f','燒肉',90],
  ['izakaya','f','居酒屋',90],['hot_pot_restaurant','f','火鍋',90],['sukiyaki_restaurant','f','壽喜燒',90],
  ['seafood_restaurant','f','海鮮市場',75],['steak_house','f','牛排',75],['hamburger_restaurant','f','漢堡',60],
  ['italian_restaurant','f','義式',75],['pizza_restaurant','f','義式',60],['french_restaurant','f','法式',90],['british_restaurant','f','英式',75],
  ['wine_bar','f','酒館',75],['pub','f','酒館',75],['bar','f','酒館',75],
  ['cafe','f','咖啡甜點',60],['coffee_shop','f','咖啡甜點',60],['bakery','f','咖啡甜點',45],['dessert_shop','f','咖啡甜點',45],['dessert_restaurant','f','咖啡甜點',45],['ice_cream_shop','f','咖啡甜點',40],['tea_house','f','咖啡甜點',60],['confectionery','f','咖啡甜點',30],
  ['fast_food_restaurant','f','小吃',45],['food_court','f','小吃',60],['meal_takeaway','f','小吃',40],['sandwich_shop','f','小吃',40],
  ['restaurant','f','',75],['food','f','',60],
  ['buddhist_temple','c','寺廟神社',45],['shinto_shrine','c','寺廟神社',45],['hindu_temple','c','寺廟神社',45],['temple','c','寺廟神社',45],['shrine','c','寺廟神社',45],
  ['church','c','教堂',45],['cathedral','c','教堂',45],['mosque','c','寺廟神社',45],['synagogue','c','寺廟神社',45],['place_of_worship','c','寺廟神社',45],
  ['museum','c','博物館',90],['art_museum','c','美術館',90],['art_gallery','c','美術館',75],
  ['observation_deck','c','展望台',60],['castle','c','古蹟建築',75],['palace','c','古蹟建築',75],['historical_landmark','c','古蹟建築',60],['historical_place','c','古蹟建築',60],['monument','c','古蹟建築',30],['cultural_landmark','c','歷史文化',60],['heritage_building','c','古蹟建築',60],
  ['amusement_park','c','遊樂體驗',240],['theme_park','c','遊樂體驗',240],['aquarium','n','動植物園',120],['zoo','n','動植物園',150],['wildlife_park','n','動植物園',150],
  ['botanical_garden','n','公園庭園',75],['garden','n','公園庭園',60],['park','n','公園庭園',60],['national_park','n','自然景觀',120],['state_park','n','自然景觀',120],['city_park','n','公園庭園',60],
  ['beach','n','海岸',90],['hiking_area','n','步道河岸',120],['river','n','步道河岸',60],['lake','n','自然景觀',60],['natural_feature','n','自然景觀',60],['farm','n','農園',90],['hot_spring','n','溫泉',90],['onsen','n','溫泉',90],['spa','n','溫泉',90],
  ['shopping_mall','s','百貨商場',90],['department_store','s','百貨商場',90],['outlet_mall','s','百貨商場',120],['market','s','市場夜市',60],['flea_market','s','市場夜市',60],['farmers_market','s','市場夜市',60],['night_market','s','市場夜市',90],
  ['book_store','s','書店文創',45],['gift_shop','s','伴手禮',30],['souvenir_store','s','伴手禮',30],['clothing_store','s','手作選物',45],['store','s','手作選物',45],['supermarket','s','伴手禮',45],['convenience_store','s','伴手禮',20],
  ['tourist_attraction','c','歷史文化',60],['point_of_interest','c','',60]
];
// 各幣別換算成新台幣的概略匯率（只用來估每人費用）
var TWD_RATE={TWD:1,JPY:0.21,KRW:0.023,THB:0.9,SGD:24,EUR:35,GBP:41,USD:32,HKD:4.1,CNY:4.4,AUD:21,CAD:23,VND:0.0013,MYR:7};
function placeStyle(info){
  var ts=[].concat(info.primaryType?[info.primaryType]:[],info.types||[]);
  for(var i=0;i<PLACE_RULES.length;i++)if(ts.indexOf(PLACE_RULES[i][0])>-1)return {s:PLACE_RULES[i][1],tag:PLACE_RULES[i][2],stay:PLACE_RULES[i][3],type:PLACE_RULES[i][0]};
  return {s:'x',tag:'',stay:60,type:''};
}
// 每人概估費用（新台幣）。有價格區間就取中間值；只有價位等級時，餐廳用等級估計，其他地點不估（門票請自行填）
function placeCost(info,style){
  var pr=info.priceRange;
  if(pr&&pr.startPrice){
    var cur=pr.startPrice.currencyCode||(pr.endPrice&&pr.endPrice.currencyCode),rate=TWD_RATE[cur];
    var a=parseFloat(pr.startPrice.units||0),b=pr.endPrice?parseFloat(pr.endPrice.units||0):a;
    if(rate&&(a||b))return Math.round(((a+(b||a))/2)*rate/10)*10;
  }
  if(style==='f'){
    return ({PRICE_LEVEL_FREE:0,PRICE_LEVEL_INEXPENSIVE:250,PRICE_LEVEL_MODERATE:600,PRICE_LEVEL_EXPENSIVE:1200,PRICE_LEVEL_VERY_EXPENSIVE:2400})[info.priceLevel]||0;
  }
  return 0;
}
// 離座標最近的「已選地區」（30 公里內）；沒有就不指定
function nearestDistrict(k,ll,names){
  var best='',bd=30;
  names.forEach(function(dn){var p=distLL(k,dn),d=hav(ll,p);if(d<bd){bd=d;best=dn}});
  return best;
}
function placeToSpot(info,k,districts){
  var ps=placeStyle(info),has=typeof info.lat==='number';
  return {
    name:info.name||'',s:ps.s,tag:ps.tag,stay:ps.stay,type:ps.type,
    cost:placeCost(info,ps.s),hours:info.hours||'',rating:info.rating||null,
    lat:has?info.lat:null,lng:has?info.lng:null,
    district:has&&districts&&districts.length?nearestDistrict(k,[info.lat,info.lng],districts):''
  };
}
