// ================= 營業時間 =================
// 格式（分號分隔的規則；沒寫星期＝每天；星期可用 一二三四五六日、一-五、平日、假日；休＝公休；24h＝全天）：
//   09:00-17:00
//   一-五 11:00-14:30,17:00-21:00;六日 11:00-21:00;二休
//   每日 24h
// 空白＝未提供（排程時不限制）。跨午夜的時段（例如 18:00-02:00）會算到當天的 26:00。
var WEEK_ORDER='一二三四五六日',HCACHE={};
function dayIdx(ch){return ch==='日'?0:'一二三四五六'.indexOf(ch)+1}   // 週日=0，與 Date.getUTCDay() 一致
// 回傳 null（未提供）或長度 7 的陣列（索引同 getUTCDay），每格是 [[開,關],…]（分鐘）；空陣列＝公休
function parseHours(str){
  str=String(str||'').trim();
  if(!str)return null;
  if(HCACHE[str]!==undefined)return HCACHE[str];
  var gen=[],spec=[];
  str.split(/[;；\n]+/).forEach(function(seg){
    seg=seg.trim();if(!seg)return;
    var ivs=[],m,re=/(\d{1,2}):(\d{2})\s*[-–—~～至]\s*(\d{1,2}):(\d{2})/g;
    while((m=re.exec(seg))){var a=+m[1]*60+ +m[2],b=+m[3]*60+ +m[4];if(b<=a)b+=1440;ivs.push([a,b])}
    var all24=/24\s*(h|小時)|全天|終日/i.test(seg);
    var closed=!ivs.length&&!all24&&/休/.test(seg);
    if(!ivs.length&&!all24&&!closed)return;
    var dp=seg.replace(re,'').replace(/24\s*(h|小時)|全天|終日|公休|休息|休/gi,'').replace(/星期|禮拜|週|周/g,'').replace(/[,，、\s]/g,'');
    var days=[];
    if(/每日|每天/.test(dp))days=[0,1,2,3,4,5,6];
    dp=dp.replace(/每日|每天/g,'');
    if(/平日/.test(dp)){days=days.concat([1,2,3,4,5]);dp=dp.replace(/平日/g,'')}
    if(/假日|末/.test(dp)){days=days.concat([6,0]);dp=dp.replace(/假日|週末|周末|末/g,'')}
    dp=dp.replace(/([日一二三四五六])[-~～至]([日一二三四五六])/g,function(_,a,b){
      var i=WEEK_ORDER.indexOf(a),j=WEEK_ORDER.indexOf(b),k=i;
      for(var n=0;n<7;n++){days.push(dayIdx(WEEK_ORDER[k]));if(k===j)break;k=(k+1)%7}
      return '';
    });
    dp.split('').forEach(function(ch){if(/[日一二三四五六]/.test(ch))days.push(dayIdx(ch))});
    var ent={days:days,ivs:all24?[[0,1440]]:ivs};
    (days.length?spec:gen).push(ent);
  });
  var res=null;
  if(gen.length||spec.length){
    var g=gen.length?[].concat.apply([],gen.map(function(e){return e.ivs})):null;
    res=[0,1,2,3,4,5,6].map(function(){return g?g.slice():[]});
    spec.forEach(function(e){e.days.forEach(function(d){res[d]=e.ivs.slice()})});
  }
  HCACHE[str]=res;
  return res;
}
function weekdayOf(no){return new Date(tripDateISO(no)+'T00:00:00Z').getUTCDay()}
// 第 no 天當天的營業時段：null＝未提供；[]＝公休
function openIvs(x,no){var p=parseHours(x&&x.hours);return p?p[weekdayOf(no)]:null}
// 當天有沒有營業（未提供視為有）
function openThatDay(x,no){var iv=openIvs(x,no);return iv===null||iv.length>0}
// 在 arr 分鐘抵達、預計停留 stay 分鐘：回傳 {start,stay,short,known} 或 null（當天排不進去）。
// 還沒開門最多等 90 分鐘；快打烊時，停留可縮短到原本的六成（至少 30 分鐘）。
function openFit(x,no,arr,stay){
  var iv=openIvs(x,no);
  if(iv===null)return {start:arr,stay:stay,known:false};
  for(var i=0;i<iv.length;i++){
    var a=iv[i][0],b=iv[i][1],s=Math.max(arr,a);
    if(s-arr>90||s>=b)continue;
    if(s+stay<=b)return {start:s,stay:stay,known:true};
    var left=b-s;
    if(left>=Math.max(30,Math.ceil(stay*0.6)))return {start:s,stay:left,short:true,known:true};
  }
  return null;
}
var hm=function(m){m=Math.round(m);var h=Math.floor(m/60),mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm};
// 顯示用：當天的營業時間
function hoursLabel(x,no){
  var iv=openIvs(x,no);
  if(iv===null)return '營業時間未提供';
  if(!iv.length)return '當日公休（週'+'日一二三四五六'[weekdayOf(no)]+'）';
  if(iv.length===1&&iv[0][0]===0&&iv[0][1]>=1440)return '全天營業';
  return '營業 '+iv.map(function(p){return hm(p[0])+'–'+hm(p[1])}).join('、');
}
// 整週的營業時間（樹狀清單、說明用）
function hoursWeek(x){
  var p=parseHours(x&&x.hours);
  if(!p)return '未提供';
  var groups=[],order=[1,2,3,4,5,6,0];
  order.forEach(function(d){
    var t=p[d].length?p[d].map(function(v){return hm(v[0])+'–'+hm(v[1])}).join('、'):'休',g=groups.filter(function(y){return y.t===t})[0];
    if(g)g.d.push(d);else groups.push({t:t,d:[d]});
  });
  if(groups.length===1)return '每日 '+groups[0].t;
  return groups.map(function(g){return g.d.map(function(d){return '日一二三四五六'[d]}).join('')+' '+g.t}).join('；');
}
