function mapQ(x){if(typeof x.lat==='number')return x.lat+','+x.lng;return x.name+' '+C[x.k].n+' '+CO[C[x.k].co].n}
function mapSearch(x){return x.url||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(mapQ(x))}
function rateTxt(x){return x.rating?'<span class="rate" title="Google 地圖評分（參考值）">★ '+x.rating.toFixed(1)+'</span>':''}
// 地圖連結與路線查詢用的住宿位置：座標只有在確定是地點本身時才使用（places／pin）。
// 舊資料或只取得畫面中心（可能是城市中心）時，改用「飯店名稱＋城市」讓 Google 自己找飯店。
function hotelQ(h,city){
  var good=typeof h.lat==='number'&&(h.hsrc==='places'||h.hsrc==='pin');
  var realName=h.name&&h.name!=='住宿（地圖連結）';
  if(good)return h.lat+','+h.lng;
  if(realName)return h.name+' '+C[city].n;
  return typeof h.lat==='number'?h.lat+','+h.lng:('住宿 '+C[city].n);
}
// 當日所有地點（住宿 + 景點 + 餐廳），給「只標位置」的地圖頁使用
function dayStops(d){
  var out=[],i=0;
  (d.hotelStops||[]).forEach(function(h){out.push({n:h.n,q:h.q,la:h.la,lo:h.lo,k:'H'})});
  d.rows.forEach(function(r){
    if((r.type==='sight'||r.type==='meal')&&r.s){
      var s=r.s,ok=typeof s.lat==='number';
      out.push({n:s.name,q:mapQ(s),la:ok?s.lat:null,lo:ok?s.lng:null,i:++i});
    }
  });
  return out;
}
function flightTxt(f){return (f.kind==='arrive'?'抵達':'離開')+' '+(f.no||'')+' '+(f.from||'')+(f.to?' → '+f.to:'')+' '+(f.time||'')}
function dayEditor(d){
  if(d.no===st.days)return '<p class="hint">最後一天不設定住宿：從前一晚的住宿出發，結束後前往機場。</p>';
  var no=d.no,x=DAYS[no]||{},h=x.hotel||{},inh=!h.name&&!h.url&&d.hotel;
  var s='<details class="dd" data-no="'+no+'"'+(OPEN[no]?' open':'')+'><summary>住宿'+(d.hotel?'：'+esc(d.hotel.name):'（選填）')+'</summary><div class="ddbody">'+
    '<div class="ddrow"><input type="text" class="w2" data-no="'+no+'" data-f="hname" value="'+esc(h.name||'')+'" placeholder="'+(inh?'沿用：'+esc(d.hotel.name):'今晚住宿名稱')+'" aria-label="住宿名稱">'+
    '<input type="number" min="0" step="100" data-no="'+no+'" data-f="hcost" value="'+(h.cost||'')+'" placeholder="每晚雙人房 NT$" aria-label="住宿每晚費用"></div>'+
    '<div class="ddrow"><input type="url" class="w2" data-no="'+no+'" data-f="hurl" value="'+esc(h.url||'')+'" placeholder="Google 地圖分享連結（在地圖 App 按「分享」複製）" aria-label="住宿 Google 地圖分享連結">'+
    (h.url?'<a class="maplink" href="'+esc(h.url)+'" target="_blank" rel="noopener">開啟住宿地圖</a> <button type="button" class="ghost sm" data-act="hrefresh" data-no="'+no+'">重新取得位置</button>':'')+'</div>'+
    '<p class="hint">'+esc(HMSG[no]||(typeof h.lat==='number'?'已取得住宿座標，會用來估算每天出發與返回的移動時間。':'貼上分享連結後，系統會嘗試取得座標；取不到時仍可開啟地圖，移動時間以估計值計算。'))+'</p>'+
    '</div></details>';
  return s;
}

function renderRes(p){
  p=p||plan();var cs=p.cities,n=cs.length,total=st.days,nights=total-1,t=st.tier,m=TIERS[t][1];
  var modes=st.modes.length?st.modes:['metro'];
  var firstC=C[cs[0]],lastC=C[cs[n-1]],fc=CO[firstC.co];
  var fl=fc.flight*m;st.co.slice(1).forEach(function(c){fl+=0.5*CO[c].flight*m});   // 去回程機票 + 每多一個國家的航班（估算）
  var hotel=0,food=0,tr=0;
  p.days.forEach(function(d,i){
    food+=C[d.city].food[t];
    if(i<total-1)hotel+=(d.hotel&&d.hotel.cost>0?d.hotel.cost:C[d.city].hotel[t])/2;
    var loc=0;d.ms.forEach(function(x){loc+=LOCAL[x]});tr+=loc/d.ms.length;
  });
  p.hops.forEach(function(x){if(x)tr+=x.cost});
  var tot=fl+hotel+food+tr+p.spots;
  var parts=[['機票',fl,'c1'],['住宿',hotel,'c2'],['餐飲',food,'c3'],['交通',tr,'c5'],['景點門票餐費',p.spots,'c4']].filter(function(x){return x[1]>0});
  var cos=[];cs.forEach(function(k){if(cos.indexOf(C[k].co)<0)cos.push(C[k].co)});
  var h='';
  if(p.over)h+='<p class="warn">天數不足以安排 '+st.ci.length+' 座城市，目前只排前 '+n+' 座。請增加天數或減少城市。</p>';
  h+='<section class="pass"><div class="main"><div class="route"><div>TPE<small>桃園</small></div><span class="arrow"></span><div>'+esc(firstC.code||firstC.n)+'<small>'+esc(firstC.n)+(n>1?' 等 '+n+' 城':'')+'</small></div></div>'+
   '<dl class="facts"><div><dt>行程</dt><dd>'+total+' 天 '+nights+' 夜</dd></div><div><dt>城市順序'+(st.auto&&n>1?'（依距離）':'')+'</dt><dd>'+cs.map(function(k){return esc(C[k].n)}).join(' → ')+'</dd></div><div><dt>飛行時間</dt><dd>'+esc(fc.fh)+'</dd></div><div><dt>最佳季節</dt><dd>'+cs.map(function(k){return esc(C[k].n)+'：'+esc(C[k].season||'請自行查詢')}).join('<br>')+'</dd></div></dl></div>'+
   '<div class="stub"><span class="lbl">每人預算概估</span><span class="total">'+fmt(tot)+'</span><span class="sub">'+TIERS[t][0]+'等級・不含額外購物</span>'+
   '<div class="bar">'+parts.map(function(x){return '<span class="'+x[2]+'" style="width:'+(x[1]/tot*100)+'%"></span>'}).join('')+'</div>'+
   '<div class="legend">'+parts.map(function(x){return '<span><i class="'+x[2]+'"></i>'+x[0]+' '+fmt(x[1]).replace('NT$ ','')+'</span>'}).join('')+'</div></div></section>';
  h+='<section class="days">';
  p.days.forEach(function(d){
    var notes=[];
    if(d.no===1&&!d.flights.some(function(f){return f.kind==='arrive'}))notes.push(d.foreign?'抵達日（'+esc(fc.fh)+'），下午才開始行程。':'出發日，先到飯店放行李再出發。');
    if(d.arrive)notes.push('搭乘'+MNAME[d.arrive.mode]+'前往'+esc(C[d.city].n)+'，約 '+fmtMin(d.arrive.min)+'（約 '+fmtKm(d.arrive.km)+'）。');
    if(d.no===total&&!d.flights.some(function(f){return f.kind==='depart'}))notes.push(d.foreign?'返程日，預留至少 3 小時前往機場，只安排上午行程。':'返程日，傍晚前結束行程。');
    if(d.hotel)notes.push('今晚住宿：'+(d.hotel.url?'<a class="maplink" href="'+esc(d.hotel.url)+'" target="_blank" rel="noopener">'+esc(d.hotel.name)+'</a>':esc(d.hotel.name))+'。');
    var area=d.rows.filter(function(r){return r.type==='sight'}).map(function(r){return r.s.dist}).filter(function(v,j,a){return a.indexOf(v)===j}).join('、');
    h+='<article class="day"><h3>第 '+d.no+' 天'+(dayDate(d.no)?'<em class="date">'+dayDate(d.no)+'</em>':'')+'<em class="city">'+esc(C[d.city].n)+'</em>'+(area?'<em class="area">'+esc(area)+'</em>':'')+
      (d.travel?'<em class="move'+(d.travel>180?' long':'')+'">移動約 '+fmtMin(d.travel)+'</em>':'')+'</h3>'+(notes.length?'<p class="note">'+notes.join('')+'</p>':'');
    if(d.travel>180)h+='<p class="note" style="color:var(--stamp)">當天移動時間偏長，建議取消幾個地點或改用更快的交通工具。</p>';
    h+='<div class="dayact">';
    var ds_=dayStops(d);
    if(ds_.length)h+=iconLink(pinsUrl(ds_,'第 '+d.no+' 天・'+C[d.city].n),ICON_PIN,'在 Google 地圖查看當日所有地點的位置（不規劃路線）');
    h+='<button type="button" class="iconbtn" data-act="calcday" data-no="'+d.no+'" title="更新這一天的移動時間" aria-label="更新這一天的移動時間">'+ICON_REFRESH+'</button>';
    var dr=DAYS[d.no]||{},dt0=dayTimes(d.no);
    h+='<span class="timebox"><label>出發 <input type="time" data-no="'+d.no+'" data-f="start" value="'+(dr.start||'')+'" aria-label="當天出發時間（預設 '+minStr(dt0.start)+'）"></label>'+
      '<label>回住宿 <input type="time" data-no="'+d.no+'" data-f="end" value="'+(dr.end||'')+'" aria-label="當天回到住宿時間（預設 20:00）"></label></span>';
    var tr0=dr.tour||{};
    h+='<label><input type="checkbox" data-no="'+d.no+'" data-f="off"'+(dr.off?' checked':'')+'>今天休息，不安排行程</label>';
    h+='<label><input type="checkbox" data-no="'+d.no+'" data-f="tour"'+(tr0.on?' checked':'')+'>當地自由行</label>';
    if(hasDrive())h+='<label><input type="checkbox" data-no="'+d.no+'" data-f="drive"'+(d.drive?' checked':'')+(onlyDrive()?' disabled':'')+'>今天自駕'+(onlyDrive()?'（只選自駕，自動勾選）':'')+'</label>';
    h+='</div>';
    if(tr0.on)h+='<div class="tourbox"><input type="text" class="w2" maxlength="40" data-no="'+d.no+'" data-f="tname" value="'+esc(tr0.name||'')+'" placeholder="名稱，例如：富士山一日遊" aria-label="當地自由行名稱">'+
      '<input type="number" min="0" step="100" data-no="'+d.no+'" data-f="tcost" value="'+(tr0.cost||'')+'" placeholder="費用 NT$" aria-label="當地自由行費用">'+
      '<input type="url" class="w2" data-no="'+d.no+'" data-f="turl" value="'+esc(tr0.url||'')+'" placeholder="行程連結（貼上網址）" aria-label="當地自由行連結"></div>';
    var gd=(dr.gaps?Object.keys(dr.gaps).filter(function(k){return dr.gaps[k].del}).length:0);
    if(gd)h+='<p class="note">已刪除 '+gd+' 段空檔。<button type="button" class="ghost sm" data-act="gaprestore" data-no="'+d.no+'">還原</button></p>';
    h+=dayEditor(d);
    if(d.off&&!d.tour)h+='<p class="note">今天休息，不安排景點與用餐；其餘景點會順延到其他天。</p>';
    else if(!d.rows.length)h+='<p class="note">當天沒有可安排的行程。</p>';
    h+='<ol class="tl" data-day="'+d.no+'" data-city="'+esc(d.city)+'"'+(d.off?' data-off="1"':'')+'>'+d.rows.map(function(r){return rowHtml(r,d,p)}).join('')+'</ol>';
    if(d.last)h+=poolHtml(d,p);
    h+='</article>';
  });
  h+='</section>';
  h+='<section class="tips">';
  var hp=p.hops.slice(1).filter(Boolean);
  if(st.co.length>1)h+='<h3>國家之間的航班</h3><ul>'+flLegs().filter(function(L){return L.k!=='out'&&L.k!=='ret'}).map(function(L){var f=flGet(L.k);return '<li>'+esc(L.t)+'：'+esc(f.date||'尚未填日期')+(f.no?'　'+esc(f.no):'')+(f.dep?'　'+esc(f.dep)+' 起飛':'')+(f.arr?'・'+esc(f.arr)+' 抵達':'')+'</li>'}).join('')+'</ul>';
  if(hp.length)h+='<h3>城市間移動</h3><ul class="hops">'+hp.map(function(x){return '<li>'+esc(C[x.from].n)+' → '+esc(C[x.to].n)+'：'+MNAME[x.mode]+'，約 '+fmtMin(x.min)+'（約 '+fmtKm(x.km)+'），約 '+fmt(x.cost)+'</li>'}).join('')+'</ul>';
  h+='<h3>交通建議</h3><ul>'+modes.map(function(x){return '<li><b>'+MODES[x]+'</b>：'+MODE_TXT[x]+'</li>'}).join('')+
    (modes.indexOf('drive')>-1?cos.map(function(c){return '<li>'+esc(CO[c].n)+'：'+esc(CO[c].drive)+'</li>'}).join(''):'')+'</ul>'+
    '<h3>出發前小提醒</h3><ul>'+cos.map(function(c){return (CO[c].tips||[]).map(function(x){return '<li>'+esc(CO[c].n)+'：'+esc(x)+'</li>'}).join('')}).join('')+'</ul></section>';
  h+='<p class="hint">拖曳景點可調整順序或換天；手動調整後景點位置會固定，重新排程只會重算時間與移動。放不下的景點會留在各城市最後一天的「未排入」區，可拖進任何一天；想讓系統重新分配請按「自動重排」。餐廳只會排在午餐 11:00–13:30、晚餐 17:30–20:00，每餐不超過 90 分鐘。</p>';
  h+='<div class="actions"><button type="button" id="copy">複製行程文字</button>'+(st.lay?'<button type="button" class="ghost" id="reflow">自動重排（清除手動順序）</button>':'')+'<span class="status" id="cs"></span></div><p class="hint" id="routeStat">'+routeStatTxt(p)+'</p><div id="fb"></div>';
  h+=shareBoxHtml();
  $('res').innerHTML=h;
  $('copy').onclick=function(){copyText(toText(p,tot))};
  if($('reflow'))$('reflow').onclick=function(){
    var seq={};
    if(st.lay&&st.fix)Object.keys(st.lay).forEach(function(n){var a=st.lay[n].filter(function(id){return st.fix[id]===+n});if(a.length)seq[n]=a});
    st.fixSeq=seq;delete st.lay;render();
  };
}
function rowInfo(r,d){
  switch(r.type){
    case 'flight':case 'buffer':return {name:r.text,cost:'',link:''};
    case 'free':return {name:txtOf(d,r.key,'自行安排行程'),cost:'',link:''};
    case 'tour':return {name:'當地自由行：'+r.name,cost:r.cost||0,link:r.url||''};
    case 'hop':var h=r.hop;return {name:'城際移動（'+MNAME[h.mode]+'）：'+C[h.from].n+' → '+C[h.to].n,cost:Math.round(h.cost/10)*10,link:dirLink(C[h.from].n+' '+CO[C[h.from].co].n,C[h.to].n+' '+CO[C[h.to].co].n,h.mode,depFor(d.no,C[d.city].co,r.start).epoch)};
    case 'move':return {name:MNAME[r.lg.mode]+'：'+r.from+' → '+r.to,cost:r.cost||0,link:dirLink(r.fromQ,r.toQ,r.lg.mode,depFor(d.no,C[d.city].co,r.start).epoch)};
    case 'meal':return {name:r.n+'：'+(r.s?r.s.name:txtOf(d,r.key,'自行安排用餐')),cost:r.cost||0,link:r.s?mapSearch(r.s):''};
    case 'sight':return {name:r.s.name,cost:r.cost||0,link:mapSearch(r.s)};
  }
  return null;
}
function routeStatTxt(p){
  var g=0,e=0;
  p.days.forEach(function(d){d.rows.forEach(function(r){if(r.type==='move'){if(r.lg.g)g++;else e++}})});
  return (ROUTE_MSG?ROUTE_MSG+' ':'')+'移動時間：Google 規劃 '+g+' 段・估算 '+e+' 段。調整順序時一律先用估算（1.5 公里內步行、以上大眾運輸）；行程確定後再按「計算路線時間（日本用 NAVITIME、其他用 Google）」，會依各路段的出發日期與時間查詢，並以 15 分鐘為單位顯示。';
}
function txtOf(d,key,dflt){var t=DAYS[d.no]&&DAYS[d.no].txt&&DAYS[d.no].txt[key];return t||dflt}
function poolHtml(d,p){
  var list=p.pool[d.city]||[],days=p.days.filter(function(x){return x.city===d.city&&!x.off});
  var items=list.map(function(s){
    return '<li class="tr sg pool" draggable="true" data-id="'+esc(s.id)+'" data-day="pool" data-city="'+esc(d.city)+'"><div class="tt">—</div><div class="tb"><div class="n"><span class="grip" aria-hidden="true" title="拖曳到上方任一天">⋮⋮</span><b>'+esc(s.name)+'</b><span class="tag">'+STYLE[s.s]+(s.tag?'・'+esc(s.tag):'')+'</span>'+rateTxt(s)+'<a class="maplink" href="'+esc(mapSearch(s))+'" target="_blank" rel="noopener">看地圖</a></div>'+
      '<div class="meta">'+esc(s.dist)+'・'+costTxt(s)+(isFood(s)?'':'・<label class="stayin">停留 <input type="number" min="15" max="720" step="15" data-stay="'+esc(s.id)+'" value="'+stayOf(s)+'" aria-label="停留分鐘"> 分</label>')+'</div>'+
      '<div class="mvbar">'+(days.length?'<select data-mv="'+esc(s.id)+'" aria-label="加入某一天"><option value="">加入某一天…</option>'+days.map(function(x){return '<option value="'+x.no+'">第 '+x.no+' 天</option>'}).join('')+'</select>':'')+
      '<button type="button" class="ghost sm x" data-act="rm" data-id="'+esc(s.id)+'" aria-label="移除並取消勾選">✕</button></div></div></li>';
  }).join('');
  return '<div class="poolbox"><h4>未排入的項目（'+list.length+'）</h4><p class="hint">拖曳到上方任一天加入行程；把項目拖回這裡可移出行程；✕ 會取消勾選。</p><ol class="tl pool" data-day="pool" data-city="'+esc(d.city)+'">'+items+'</ol></div>';
}
function itemCtl(s,d,p,pinned){
  var same=p.days.filter(function(x){return x.city===d.city&&x.no!==d.no&&!x.off}),id=esc(s.id);
  return '<div class="mvbar"><button type="button" class="ghost sm pin'+(pinned?' on':'')+'" data-act="pin" data-id="'+id+'" data-day="'+d.no+'" aria-pressed="'+(pinned?'true':'false')+'" title="固定後，重新排程不會移動這個項目">'+(pinned?'🔒 已固定':'🔓 固定')+'</button>'+
    (pinned?'':'<button type="button" class="ghost sm" data-act="up" data-id="'+id+'" data-day="'+d.no+'" aria-label="上移">▲</button><button type="button" class="ghost sm" data-act="down" data-id="'+id+'" data-day="'+d.no+'" aria-label="下移">▼</button>'+
    (same.length?'<select data-mv="'+id+'" aria-label="移到同城市的其他天"><option value="">移到其他天…</option>'+same.map(function(x){return '<option value="'+x.no+'">第 '+x.no+' 天</option>'}).join('')+'</select>':''))+
    '<button type="button" class="ghost sm x" data-act="rm" data-id="'+id+'"'+(pinned?' disabled title="請先解除固定"':' title="從行程移除並取消勾選"')+' aria-label="移除">✕</button></div>';
}
function rowHtml(r,d,p){
  var tm='<div class="tt">'+minStr(r.start)+(r.end>r.start?'<small>–'+minStr(r.end)+'</small>':'')+'</div>',b='',cls=r.type,inf=rowInfo(r,d),li='';
  if(r.type==='flight')b='<b>✈ '+esc(r.text)+'</b>';
  else if(r.type==='tour'){cls='tour';b='<div class="n"><span class="tag meal">當地自由行</span><b>'+esc(r.name)+'</b>'+(r.url?'<a class="maplink" href="'+esc(r.url)+'" target="_blank" rel="noopener">行程連結</a>':'')+'</div><div class="meta">'+(r.cost?'約 '+fmt(r.cost):'費用未填')+'・全天由當地行程安排</div>'}
  else if(r.type==='buffer')b='<span class="soft">'+esc(r.text)+'（'+fmtMin(r.end-r.start)+'）</span>';
  else if(r.type==='free'){
    cls='fr';
    b='<input type="text" class="freetxt" data-no="'+d.no+'" data-tk="'+r.key+'" maxlength="40" value="'+esc(txtOf(d,r.key,''))+'" placeholder="自行安排行程（可改文字）" aria-label="空檔安排"> <label class="stayin"><input type="number" min="5" max="720" step="5" data-no="'+d.no+'" data-gapkey="'+r.key+'" value="'+(r.end-r.start)+'" aria-label="空檔分鐘"> 分</label> <button type="button" class="ghost sm x" data-act="gapdel" data-no="'+d.no+'" data-key="'+r.key+'" aria-label="刪除這段空檔">✕</button>';
  }
  else if(r.type==='hop'){cls='mv';b='<span class="soft">↓ '+MNAME[r.hop.mode]+'前往'+esc(C[r.hop.to].n)+'・約 '+fmtMin(r.hop.min)+'・約 '+fmtKm(r.hop.km)+'・約 '+fmt(r.hop.cost)+'</span>'}
  else if(r.type==='move'){cls='mv';b='<span class="soft">↓ '+MNAME[r.lg.mode]+'約 '+fmtMin(r.lg.min)+'・約 '+fmtKm(r.lg.km)+(r.cost?'・約 NT$ '+r.cost:'')+'・前往 '+esc(r.to)+(r.lg.g?' <span class="gtag">'+(r.lg.src||'Google')+'</span>':' <span class="gtag est">估算</span>')+' '+iconLink(inf.link,ICON_ROUTE,'路徑（Google 地圖，帶入出發時間）')+'</span>'}
  else if(r.type==='meal'){
    cls='ml';
    if(r.s){
      var pm=!!r.s.pin;
      cls+=' sg'+(pm?' pinned':'');
      b='<div class="n"><span class="grip" aria-hidden="true" title="拖曳調整順序">⋮⋮</span><span class="tag meal">'+r.n+'</span><b>'+esc(r.s.name)+'</b>'+rateTxt(r.s)+'<a class="maplink" href="'+esc(mapSearch(r.s))+'" target="_blank" rel="noopener">看地圖</a></div><div class="meta">'+esc(r.s.dist)+'・<label class="stayin">用餐 <input type="number" min="15" max="240" step="5" data-stay="'+esc(r.s.id)+'" value="'+(r.end-r.start)+'" aria-label="用餐分鐘"> 分</label>・'+costTxt(r.s)+'</div>'+itemCtl(r.s,d,p,pm);
      if(r.over)b+='<p class="overnote">⚠ 用餐開始時間不在建議時段內（午餐 11:00–13:30、晚餐 17:30–20:00）。</p>';
      li=(pm?'':' draggable="true"')+' data-id="'+esc(r.s.id)+'" data-day="'+d.no+'" data-city="'+esc(d.city)+'"';
    }else{
      b='<div class="n"><span class="tag meal">'+r.n+'</span><input type="text" class="freetxt" data-no="'+d.no+'" data-tk="'+r.key+'" maxlength="40" value="'+esc(txtOf(d,r.key,''))+'" placeholder="自行安排用餐（可改文字）" aria-label="用餐安排"></div><div class="meta"><label class="stayin">用餐 <input type="number" min="15" max="240" step="5" data-no="'+d.no+'" data-mealmin="'+r.key+'" value="'+(r.end-r.start)+'" aria-label="用餐分鐘"> 分</label>。從下方「未排入」拖入餐廳，或在樹狀選單勾選美食。</div>';
    }
  }else if(r.type==='sight'){
    cls='sg'+(r.s.pin?' pinned':'');
    var s=r.s,pn=!!s.pin;
    b='<div class="n"><span class="grip" aria-hidden="true" title="拖曳調整順序">⋮⋮</span><b>'+esc(s.name)+'</b><span class="tag">'+STYLE[s.s]+(s.tag?'・'+esc(s.tag):'')+'</span>'+rateTxt(s)+'<a class="maplink" href="'+esc(mapSearch(s))+'" target="_blank" rel="noopener">看地圖</a></div><p>'+esc(s.desc)+'</p>'+
      '<div class="meta">'+esc(s.dist)+'・'+costTxt(s)+'・<label class="stayin">停留 <input type="number" min="15" max="720" step="15" data-stay="'+esc(s.id)+'" value="'+(r.end-r.start)+'" aria-label="停留分鐘"> 分</label></div>'+itemCtl(s,d,p,pn);
    if(r.over)b+='<p class="overnote">⚠ 已超過當天回住宿或航班前的時間，請調整停留時間或移到其他天。</p>';
    li=(pn?'':' draggable="true"')+' data-id="'+esc(s.id)+'" data-day="'+d.no+'" data-city="'+esc(d.city)+'"';
  }
  return '<li class="tr '+cls+(r.over?' over':'')+'"'+li+'>'+tm+'<div class="tb">'+b+'</div></li>';
}
function toText(p,tot){
  var L=[p.cities.map(function(k){return C[k].n}).join('、')+' '+st.days+' 天自由行（每人約 '+fmt(tot)+'）'];
  p.days.forEach(function(d){
    L.push('','第 '+d.no+' 天 '+C[d.city].n+(d.drive?'【自駕】':''));
    if(d.hotel)L.push('　住宿：'+d.hotel.name+(d.hotel.url?' '+d.hotel.url:''));
    d.rows.forEach(function(r){
      var inf=rowInfo(r,d);if(!inf)return;
      L.push('　'+minStr(r.start)+'–'+minStr(r.end)+'　'+inf.name+(r.type==='sight'&&r.s.rating?' ★'+r.s.rating.toFixed(1):'')+(r.type==='sight'?'　'+inf.link:''));
    });
  });
  return L.join('\n');
}
function copyText(t){
  var ok=function(){$('cs').textContent='已複製';$('fb').innerHTML=''};
  var bad=function(){
    $('fb').innerHTML='<textarea class="fallback" id="ta" readonly></textarea>';
    var ta=$('ta');ta.value=t;ta.focus();ta.select();$('cs').textContent='請按住文字手動複製';
  };
  try{navigator.clipboard.writeText(t).then(ok,bad)}catch(e){bad()}
}
// 沒有完整的去程與回程日期時，不顯示規劃畫面（旅遊天數完全由日期計算）
function renderGate(a){
  $('pickbar').hidden=true;
  $('pick').innerHTML='';
  $('res').innerHTML='<div class="gate"><b>請先填寫所有航班的日期</b><p>旅遊天數由航班日期自動計算：「去程」「回程」以及（選了多個國家時）每相鄰兩個國家之間的航班，日期都填好之後，才會顯示景點選擇與每日行程規劃畫面。</p>'+
    (flightPlan().msg?'<p style="color:var(--stamp)">'+esc(flightPlan().msg)+'</p>':'')+'<p class="hint">在左側「3. 航班」的每一段航班填入日期即可（航班號與時間之後再補也可以）。</p></div>';
}
function render(skipSave){
  var a=autoDays();
  if(a<=0){renderGate(a);if(!skipSave)save();return}
  $('pickbar').hidden=false;
  var p=plan();renderPick(p);renderRes(p);if(!skipSave)save();
}
function rebuildAll(skipSave){normalize();buildStatic();buildCities();renderOrder();buildAdder();renderFlights();render(skipSave)}

