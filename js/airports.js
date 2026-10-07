// ================= 機場：可搭大眾運輸的實際起訖點 =================
// 機場本身不在市區，以「機場座標＋市中心估算」會嚴重失準。這裡為各機場記錄：
//   ll：航廈座標；hub：機場鐵路／巴士開往的市區主要車站；via：搭乘方式；min：機場到該車站的時間（含航廈到月台）；
//   twd：單程費用（新台幣，依各國匯率換算，僅供概估）；km：距離。
// 從機場出發的路段 = 機場 → 車站（本表；按「更新」會改用 Google／NAVITIME 的實際班次與票價）
//                    + 車站 → 目的地（一般大眾運輸路線）。前往機場則相反。
// 費用與時間為近期公開資料的概數，實際以營運公司公告為準。
var AIRPORTS={
  NRT:{nm:'成田機場',ll:[35.772,140.3929],hub:{n:'東京站',ll:[35.6812,139.7671]},via:'成田特快 N\'EX',mode:'train',min:53,twd:650,km:60},
  HND:{nm:'羽田機場',ll:[35.5494,139.7798],hub:{n:'品川站',ll:[35.6285,139.7388]},via:'京急機場線',mode:'train',min:15,twd:70,km:13},
  KIX:{nm:'關西機場',ll:[34.4273,135.244],hub:{n:'難波站',ll:[34.6666,135.5013]},via:'南海 Rapi:t 特急',mode:'train',min:40,twd:315,km:50},
  FUK:{nm:'福岡機場',ll:[33.5859,130.4507],hub:{n:'博多站',ll:[33.5897,130.4207]},via:'地下鐵空港線（國際線航廈需先搭免費接駁巴士）',mode:'metro',min:25,twd:55,km:5},
  CTS:{nm:'新千歲機場',ll:[42.7752,141.6923],hub:{n:'札幌站',ll:[43.0687,141.3508]},via:'JR 快速 Airport',mode:'train',min:40,twd:240,km:48},
  HKD:{nm:'函館機場',ll:[41.77,140.8219],hub:{n:'函館站',ll:[41.7737,140.7266]},via:'機場巴士',mode:'bus',min:25,twd:95,km:8},
  NGO:{nm:'中部機場',ll:[34.8584,136.8054],hub:{n:'名古屋站',ll:[35.1709,136.8815]},via:'名鐵 μSKY 特急',mode:'train',min:35,twd:300,km:35},
  ICN:{nm:'仁川機場',ll:[37.4602,126.4407],hub:{n:'首爾站',ll:[37.5547,126.9707]},via:'AREX 直通列車',mode:'train',min:50,twd:220,km:55},
  GMP:{nm:'金浦機場',ll:[37.5583,126.7906],hub:{n:'首爾站',ll:[37.5547,126.9707]},via:'AREX',mode:'train',min:25,twd:35,km:17},
  PUS:{nm:'釜山金海機場',ll:[35.1795,128.9382],hub:{n:'西面站',ll:[35.1579,129.0597]},via:'輕軌＋地鐵 2 號線',mode:'metro',min:45,twd:40,km:20},
  TPE:{nm:'桃園機場',ll:[25.0777,121.2328],hub:{n:'台北車站',ll:[25.0478,121.517]},via:'機場捷運直達車',mode:'metro',min:40,twd:160,km:40},
  TSA:{nm:'松山機場',ll:[25.0697,121.5522],hub:{n:'台北車站',ll:[25.0478,121.517]},via:'捷運文湖線轉板南線',mode:'metro',min:25,twd:25,km:6},
  KHH:{nm:'高雄機場',ll:[22.5771,120.35],hub:{n:'高雄車站',ll:[22.6395,120.3025]},via:'高雄捷運紅線',mode:'metro',min:25,twd:35,km:12},
  BKK:{nm:'素萬那普機場',ll:[13.69,100.7501],hub:{n:'帕亞泰站（Phaya Thai）',ll:[13.7568,100.5339]},via:'機場快線 City Line（可轉搭 BTS）',mode:'train',min:35,twd:40,km:30},
  CNX:{nm:'清邁機場',ll:[18.7668,98.9626],hub:{n:'塔佩門（古城）',ll:[18.7877,98.9931]},via:'雙條車或叫車（無鐵路）',mode:'bus',min:20,twd:55,km:5},
  SIN:{nm:'樟宜機場',ll:[1.3644,103.9915],hub:{n:'城市廳站（City Hall）',ll:[1.2931,103.852]},via:'地鐵 EW 線',mode:'metro',min:35,twd:60,km:20},
  CDG:{nm:'戴高樂機場',ll:[49.0097,2.5479],hub:{n:'夏特雷－雷阿勒站',ll:[48.8606,2.347]},via:'RER B',mode:'train',min:40,twd:455,km:30},
  FCO:{nm:'羅馬菲烏米奇諾機場',ll:[41.8003,12.2389],hub:{n:'羅馬特米尼站',ll:[41.901,12.501]},via:'Leonardo Express',mode:'train',min:35,twd:490,km:32},
  FLR:{nm:'佛羅倫斯機場',ll:[43.81,11.2051],hub:{n:'佛羅倫斯新聖母站',ll:[43.7765,11.248]},via:'T2 電車',mode:'metro',min:25,twd:60,km:6},
  LHR:{nm:'希斯洛機場',ll:[51.47,-0.4543],hub:{n:'皮卡迪里圓環站',ll:[51.5098,-0.1342]},via:'地鐵 Piccadilly 線',mode:'metro',min:55,twd:275,km:25},
  JFK:{nm:'甘迺迪機場',ll:[40.6413,-73.7781],hub:{n:'賓州車站（34 St）',ll:[40.7523,-73.9934]},via:'AirTrain＋地鐵 E 線',mode:'metro',min:70,twd:365,km:25}
};
// 沒有填機場代碼時，依城市預設主要機場
var AIRPORT_BY_CITY={tyo:'NRT',osa:'KIX',kyo:'KIX',nra:'KIX',fuk:'FUK',spk:'CTS',otr:'CTS',hko:'HKD',ngo:'NGO',sel:'ICN',pus:'PUS',bkk:'BKK',cnx:'CNX',sin:'SIN',par:'CDG',rom:'FCO',flr:'FLR',lon:'LHR',nyc:'JFK',tpe:'TPE',txg:'TPE',khh:'KHH'};
function airportInfo(code,city){
  var c=String(code||'').trim().toUpperCase().match(/[A-Z]{3}/);
  var A=(c&&AIRPORTS[c[0]])||(!c&&AIRPORT_BY_CITY[city]&&AIRPORTS[AIRPORT_BY_CITY[city]])||null;
  return A?Object.assign({code:(c&&c[0])||AIRPORT_BY_CITY[city]},A):null;
}
var llq=function(ll){return ll[0]+','+ll[1]};
function airportAt(ll){
  if(!ll)return null;
  for(var k in AIRPORTS)if(hav(ll,AIRPORTS[k].ll)<1)return AIRPORTS[k];
  return null;
}
// 機場 ⇄ 車站的固定路段（按「更新」會查詢實際班次與票價）
function accessLeg(A,toAirport,ms,at){
  var air=llq(A.ll),hub=llq(A.hub.ll),est={km:A.km,min:A.min,mode:A.mode,twd:A.twd,tbl:true};
  return toAirport?leg(hub,air,A.hub.ll,A.ll,ms,at,est):leg(air,hub,A.ll,A.hub.ll,ms,at,est);
}
// 起點或終點在機場時，改成「機場 ⇄ 車站」加上「車站 ⇄ 目的地」；其餘回傳 null
function airportLeg(fq,tq,a,b,ms,at){
  if(!a||!b)return null;
  var A=airportAt(a),B=airportAt(b);
  if(!!A===!!B)return null;
  var X=A||B,hubQ=llq(X.hub.ll),hn=X.hub.n+(X.via?'（'+X.via.split('（')[0]+'）':'');
  if(A){
    var p1=accessLeg(A,false,ms,at);
    if(hav(X.hub.ll,b)<1.2)return {km:p1.km,min:p1.min,mode:p1.mode,key:'',req:null,parts:[{lg:p1,toName:null,toQ:null}]};
    var p2=leg(hubQ,tq,X.hub.ll,b,ms,at+p1.min);
    return {km:p1.km+p2.km,min:p1.min+p2.min,mode:p2.mode,key:'',req:null,parts:[{lg:p1,toName:hn,toQ:hubQ},{lg:p2,toName:null,toQ:null}]};
  }
  var q1=leg(fq,hubQ,a,X.hub.ll,ms,at);
  if(hav(X.hub.ll,a)<1.2)q1=null;
  var t2=at+(q1?q1.min:0),q2=accessLeg(X,true,ms,t2);
  return {km:(q1?q1.km:0)+q2.km,min:(q1?q1.min:0)+q2.min,mode:q2.mode,key:'',req:null,
    parts:(q1?[{lg:q1,toName:hn,toQ:hubQ}]:[]).concat([{lg:q2,toName:null,toQ:null}])};
}
