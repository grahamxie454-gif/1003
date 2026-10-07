// ================= 離島渡船：依「行程當天的季節」與「實際班次」安排 =================
// 往返離島的路段不用一般的大眾運輸估算，而是：
//   前往碼頭（大眾運輸／步行）→ 等下一班船（依當天所在季節的時刻表）→ 搭船 → 碼頭到景點（步行）。
// 時刻表用「行程實際日期」判斷季節（不是下週同星期），找不到當天還有的班次時，該景點會被視為排不進去。
// 新增離島：在 FERRY_ROUTES 加一筆即可（需有官方時刻表、碼頭座標與離島範圍）。
var FERRY_ROUTES=[{
  id:'aishima',
  name:'町營渡船「しんぐう」（新宮港 ⇄ 相島港）',
  src:'新宮町官網「町營渡船しんぐう時刻表」',
  main:{name:'新宮港（相島渡船場）',ll:[33.7081,130.4317]},
  isle:{name:'相島港',ll:[33.7567,130.3635],center:[33.762,130.365],r:2.5},   // r：離島範圍半徑（公里）
  dur:17,                       // 航行分鐘
  board:5,                      // 提前登船分鐘
  fare:480,                     // 日圓，大人單程
  seasons:[
    {label:'3/1–10/31 班次',months:[3,4,5,6,7,8,9,10],
     toIsle:['07:50','09:20','11:30','14:30','16:40','18:10'],
     toMain:['07:00','08:40','10:50','13:50','16:00','17:30']},
    {label:'11/1–2/28 班次（末班提前）',months:[11,12,1,2],
     toIsle:['07:50','09:20','11:30','14:30','17:40'],
     toMain:['07:00','08:40','10:50','13:50','17:00']}
  ],
  note:'假日客滿時可能無法上船；因風浪停航，會在相島發船前 30 分鐘決定。末班船錯過就只能留在島上，請務必確認。'
}];
function inIsle(ll,r){return !!ll&&hav(ll,r.isle.center)<=r.isle.r}
function islandWalk(a,b){var km=hav(a,b)*1.3;return {km:km,min:round5(km/5*60),mode:'walk'}}   // 離島內一律步行估算
function inAnyIsle(ll){return FERRY_ROUTES.some(function(r){return inIsle(ll,r)})}
// 第 no 天的實際日期（YYYY-MM-DD）
function tripDateISO(no){
  var p=flightPlan();
  return p.ok?addDaysStr(p.start,no-1):new Date().toISOString().slice(0,10);
}
function ferrySeason(r,iso){
  var m=+iso.slice(5,7);
  for(var i=0;i<r.seasons.length;i++)if(r.seasons[i].months.indexOf(m)>-1)return r.seasons[i];
  return r.seasons[0];
}
var fmtHM=function(m){var h=Math.floor(m/60)%24,mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm};
// 起點與終點分別在離島的兩側時，回傳含候船、航行的複合路段；否則回傳 null（由一般路線處理）
function ferryLeg(fq,tq,a,b,ms,at){
  if(!a||!b)return null;
  for(var ri=0;ri<FERRY_ROUTES.length;ri++){
    var r=FERRY_ROUTES[ri],ia=inIsle(a,r),ib=inIsle(b,r);
    if(ia===ib)continue;
    var toIsle=ib,P1=toIsle?r.main:r.isle,P2=toIsle?r.isle:r.main;
    var q1=P1.ll[0]+','+P1.ll[1],q2=P2.ll[0]+','+P2.ll[1];
    var p1=leg(fq,q1,a,P1.ll,ms,at);
    var ready=at+p1.min+r.board,sea=ferrySeason(r,tripDateISO(LEGDAY)),list=(toIsle?sea.toIsle:sea.toMain).map(toMin);
    var dep=null;
    for(var i=0;i<list.length;i++)if(list[i]>=ready){dep=list[i];break}
    var cost=Math.round(r.fare*0.21/10)*10,times=(toIsle?sea.toIsle:sea.toMain).join('、');
    var from={name:P1.name,q:q1},to={name:P2.name,q:q2};
    if(dep===null){
      // 當天已經沒有船：用很長的時間代表「排不進去」
      return {km:p1.km+7.5,min:600,mode:'ferry',key:'',req:null,
        ferry:{none:true,p1:p1,from:from,to:to,route:r.id,text:'⚠ 當天已無「'+P1.name+' → '+P2.name+'」的船班（'+sea.label+'：'+times+'）',times:times,season:sea.label,cost:0}};
    }
    var arrive=dep+r.dur,p3=leg(q2,tq,P2.ll,b,ms,arrive);
    return {km:p1.km+7.5+p3.km,min:arrive+p3.min-at,mode:'ferry',key:'',req:null,
      ferry:{p1:p1,p3:p3,from:from,to:to,dep:dep,dur:r.dur,wait:dep-(at+p1.min),cost:cost,route:r.id,season:sea.label,times:times,
        text:'搭乘渡船 '+P1.name+' '+fmtHM(dep)+' 開 → '+P2.name+' '+fmtHM(arrive)+' 抵達（候船 '+(dep-(at+p1.min))+' 分）'}};
  }
  return null;
}
// 行程裡用到的離島航線說明（顯示在交通建議）
function ferryNotesHtml(p){
  var used={};
  p.days.forEach(function(d){d.rows.forEach(function(r){if(r.type==='ferry'&&r.route)used[r.route]=1})});
  var ids=Object.keys(used);
  if(!ids.length)return '';
  return '<h3>離島渡船</h3><ul>'+ids.map(function(id){
    var r=FERRY_ROUTES.filter(function(x){return x.id===id})[0];
    return '<li><b>'+esc(r.name)+'</b>：單程約 '+r.dur+' 分鐘、大人約 ¥'+r.fare+'。'+r.seasons.map(function(s){return esc(s.label)+'—往離島 '+esc(s.toIsle.join('、'))+'；回本島 '+esc(s.toMain.join('、'))}).join('；')+'。'+esc(r.note)+'（資料來源：'+esc(r.src)+'；實際班次以船公司公告為準）</li>';
  }).join('')+'</ul>';
}

// ----- 由資料庫載入（ferry_routes 資料表）；上面的內建值只在資料庫讀不到時當備用 -----
function applyFerryRows(rows){
  FERRY_ROUTES=rows.map(function(r){
    return {id:r.id,name:r.name,src:r.source,note:r.note,dur:r.duration_min,board:r.board_min,fare:r.fare_jpy,seasons:r.seasons||[],
      main:{name:r.main_name,ll:[r.main_lat,r.main_lng]},
      isle:{name:r.isle_name,ll:[r.isle_lat,r.isle_lng],center:[r.isle_center_lat,r.isle_center_lng],r:+r.isle_radius_km}};
  });
}
