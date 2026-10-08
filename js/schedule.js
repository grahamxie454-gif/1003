// ================= 排程 =================
function alloc(list,total){
  var w=list.map(function(k){return Math.max(1,citySpots(k,false,false).length)}),sum=w.reduce(function(a,b){return a+b},0);
  var rest=total-list.length,q=w.map(function(x){return x/sum*rest}),fl=q.map(Math.floor);
  var r=rest-fl.reduce(function(a,b){return a+b},0);
  q.map(function(v,i){return [v-fl[i],i]}).sort(function(a,b){return b[0]-a[0]}).slice(0,r).forEach(function(x){fl[x[1]]++});
  return fl.map(function(v){return v+1});
}
function toMin(t){var m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null}
function dayTimes(no){
  var r=DAYS[no]||{},s=toMin(r.start),e=toMin(r.end);
  return {start:s!==null?s:(st.pace==='relax'?630:540),end:e!==null?e:1200};
}
// 用餐時段：午餐 11:00–13:30、晚餐 17:30–20:00，單餐不超過 90 分鐘
var MEALS=[{n:'午餐',k:'lunch',lo:660,hi:810,dur:75},{n:'晚餐',k:'dinner',lo:1050,hi:1200,dur:75}];
function stayOf(x){return x.stay>0?x.stay:({c:90,n:75,s:60,x:60,f:75}[x.s]||60)}
var isFood=function(x){return x.s==='f'};
// ---- 移動時間 ----
// 規劃與調整順序時一律先用估算值（顯示「估算」）。按每天的「更新」圖示，只更新那一天：
// 依序查詢每個路段，下一段的出發時間 = 前一段查到的實際結束時間。
// 1.5 公里內用步行（不需要出發時間，查過就用快取）；1.5 公里以上用大眾運輸（日本用 NAVITIME，其他用 Google），
// 出發日期一律用「下週同一個星期」，並以 15 分鐘為單位。需要搭船的路段，由 Google／NAVITIME 依船班時刻計算（含等船時間）。
var ROUTE={},ROUTE_TRIED={},ROUTE_MSG='',ROUTE_BUSY=false,ROUTE_DAY=0,LEGDAY=1,LEGCO='';
var TZ={jp:9,kr:9,tw:8,sg:8,th:7,fr:1,it:1,uk:0,us:-5};
function gMode(m){return m==='walk'?'WALK':(m==='drive'?'DRIVE':'TRANSIT')}
// 第 no 天對應的出發日期（YYYY-MM-DD）：取行程當天是星期幾，換成「下週」的同一個星期
function dayDateISO(no){
  var fp=flightPlan(),o=fp.ok?fp.start:'',base=(o&&!isNaN(Date.parse(o)))?Date.parse(o)+(no-1)*864e5:Date.now()+(no-1)*864e5;
  var w=new Date(base).getUTCDay();
  var n=new Date(),today=Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate());
  var toMon=((8-new Date(today).getUTCDay())%7)||7;            // 到下週一的天數
  return new Date(today+(toMon+((w+6)%7))*864e5).toISOString().slice(0,10);
}
// 出發時間：回傳 ISO（含時區）與 epoch 秒；at 為當天第幾分鐘，取 15 分鐘為單位
function depFor(no,co,at){
  var m=Math.min(1425,Math.max(0,Math.round(at/15)*15)),tz=TZ[co]!==undefined?TZ[co]:8,pad=function(n){return ('0'+n).slice(-2)};
  var date=dayDateISO(no),hm=pad(Math.floor(m/60))+':'+pad(m%60);
  return {iso:date+'T'+hm+':00'+(tz<0?'-':'+')+pad(Math.abs(tz))+':00',epoch:Math.floor(Date.parse(date+'T'+hm+':00Z')/1000)-tz*3600};
}
function leg(fq,tq,a,b,ms,at,estO){
  var fx=estO?null:(airportLeg(fq,tq,a,b,ms,at)||ferryLeg(fq,tq,a,b,ms,at));if(fx)return fx;
  var est=estO||((inAnyIsle(a)&&inAnyIsle(b))?islandWalk(a,b):localLeg(a,b,ms)),g=gMode(est.mode),dep=g==='TRANSIT'?depFor(LEGDAY,LEGCO,at||0).iso:'',nav=(g==='TRANSIT'&&LEGCO==='jp');
  var key=(nav?'NAVI':g)+'|'+fq+'|'+tq+(dep?'|'+dep:''),h=ROUTE[key],out;
  if(h)out={km:h.m/1000,min:Math.max(15,Math.round(h.s/60/15)*15),mode:est.mode,g:true,fare:h.f||0,src:nav?'NAVITIME':'Google'};
  else out=est;
  out.key=key;out.req={key:key,mode:g,prov:nav?'NAVI':'',from:fq,to:tq,dep:dep};
  return out;
}
function setRouteMsg(t){
  ROUTE_MSG=t;var el=$('routeStat');if(el)el.textContent=t;
  [].forEach.call(document.querySelectorAll('button[data-act=calcday]'),function(b){b.disabled=ROUTE_BUSY;b.classList.toggle('spin',ROUTE_BUSY&&+b.dataset.no===ROUTE_DAY)});
}
async function askRoutes(reqs){
  reqs.forEach(function(r){ROUTE_TRIED[r.key]=1});
  var r=await sb.functions.invoke('route-times',{body:{legs:reqs}});
  if(r.error){
    var detail=r.error.message||'呼叫失敗';
    try{if(r.error.context&&r.error.context.text){var tx=await r.error.context.text();if(tx)detail+='：'+tx.slice(0,200)}}catch(e2){}
    return {stop:'路線查詢失敗：'+detail};
  }
  var d=r.data||{};
  if(d.error==='not_configured')return {stop:'尚未設定 Google 金鑰，路線時間維持估算。'};
  if(d.error==='not_configured_navitime')return {stop:'尚未設定 NAVITIME 金鑰（Supabase Secrets：NAVITIME_KEY 或 AERODATABOX_KEY），日本大眾運輸維持估算。'};
  var got=0;
  (d.results||[]).forEach(function(x){ROUTE[x.key]={s:x.s,m:x.m,f:x.f};got++});
  if(d.error)return {stop:'路線查詢失敗：'+d.error,got:got};
  if(d.capped)return {stop:'今日查詢額度已用完，其餘路線維持估算，明天可再按一次。',got:got};
  return {got:got,fails:d.fails||0,lastErr:d.lastErr||''};
}
// 只更新某一天：先一次查完步行（與時間無關），再依序查每段大眾運輸，後一段用前一段的結果推算出發時間
async function calcDay(no){
  if(ROUTE_BUSY||!sb)return;
  ROUTE_BUSY=true;ROUTE_DAY=no;ROUTE_TRIED={};
  var got=0,fails=0,lastErr='',stop='';
  function pending(){
    var d=plan().days.filter(function(x){return x.no===no})[0];
    return d?d.rows.filter(function(r){return r.type==='move'&&!r.lg.g&&!ROUTE_TRIED[r.lg.key]}):[];
  }
  try{
    setRouteMsg('第 '+no+' 天：計算移動時間中…');
    var walk=pending().filter(function(r){return r.lg.req.mode==='WALK'});
    for(var i=0;i<walk.length&&!stop;i+=20){
      var res=await askRoutes(walk.slice(i,i+20).map(function(r){return r.lg.req}));
      got+=res.got||0;fails+=res.fails||0;if(res.lastErr)lastErr=res.lastErr;if(res.stop)stop=res.stop;
    }
    for(var n=0;n<40&&!stop;n++){
      var rows=pending();
      if(!rows.length)break;
      setRouteMsg('第 '+no+' 天：計算移動時間中…（'+rows.length+' 段待查）');
      var r1=await askRoutes([rows[0].lg.req]);
      got+=r1.got||0;fails+=r1.fails||0;if(r1.lastErr)lastErr=r1.lastErr;if(r1.stop)stop=r1.stop;
      render(true);
    }
  }catch(err){stop='路線查詢失敗：'+(err.message||err)}
  ROUTE_BUSY=false;
  render(true);
  setRouteMsg(stop||('第 '+no+' 天移動時間已更新：本次新查詢 '+got+' 段'+(fails?'，'+fails+' 段無法規劃（維持估算）'+(lastErr?'，原因：'+lastErr:''):'')+'。'));
}
async function loadRoutes(){
  try{
    for(var from=0;from<5000;from+=1000){
      var r=await sb.from('route_cache').select('key,secs,meters,fare').range(from,from+999);
      if(r.error||!r.data)break;
      r.data.forEach(function(x){ROUTE[x.key]={s:x.secs,m:x.meters,f:x.fare}});
      if(r.data.length<1000)break;
    }
  }catch(e){}
}

function simDay(o){
  LEGDAY=o.no;LEGCO=C[o.k]?C[o.k].co:'';
  var ms=o.ms,rows=[],t=Math.max(o.start,o.ready),cur=null,curName='',curQ='',curLoc=null,
    meals=o.off?[]:MEALS.slice(),q=o.queue.slice(),skipped=[],cost=0,travel=0,sights=0,guard=0,gi=0,dayD={};
  var CITYLL=[(C[o.k]&&C[o.k].lat)||0,(C[o.k]&&C[o.k].lng)||0];
  // 地點（住宿或機場）的座標；住宿沒有座標時，以附近景點的位置估計；機場以市中心外約 30 公里估計
  function llOf(loc,near){
    if(!loc)return null;
    if(loc.ll)return loc.ll;
    if(loc._ll)return loc._ll;
    if(loc.kind==='airport'){loc._ll=[CITYLL[0]+0.2,CITYLL[1]+0.2];return loc._ll}
    if(near){var nb=inAnyIsle(near)?CITYLL:near;loc._ll=[nb[0]+0.012,nb[1]+0.012];return loc._ll}
    return null;
  }
  function setCur(loc,near){curLoc=loc;cur=llOf(loc,near);curName=loc.name;curQ=loc.q}
  if(o.startLoc&&(o.startLoc.ll||o.startLoc.kind==='airport'))setCur(o.startLoc);
  if(o.arrive){rows.push({type:'hop',hop:o.arrive,start:t,end:t+o.arrive.min,cost:o.arrive.cost});t+=o.arrive.min;travel+=o.arrive.min}
  function mv(lg,toName,toQ,at){
    var f=lg.ferry;
    if(lg.parts){
      // 機場 ⇄ 車站 ⇄ 目的地：每一段各自一列
      var tt=at,fn=curName,fqq=curQ;
      lg.parts.forEach(function(p){
        var nm=p.toName||toName,qq=p.toQ||toQ;
        rows.push({type:'move',lg:p.lg,from:fn,to:nm,fromQ:fqq,toQ:qq,start:tt,end:tt+p.lg.min});
        tt+=p.lg.min;fn=nm;fqq=qq;
      });
      travel+=lg.min;
      return;
    }
    if(f){
      // 離島渡船：前往碼頭 → 候船與航行 → 碼頭到目的地
      var t1=at+f.p1.min;
      rows.push({type:'move',lg:f.p1,from:curName,to:f.from.name,fromQ:curQ,toQ:f.from.q,start:at,end:t1});
      if(f.none)rows.push({type:'ferry',route:f.route,text:f.text,times:f.times,season:f.season,none:true,start:t1,end:t1+60});
      else{
        rows.push({type:'ferry',route:f.route,text:f.text,times:f.times,season:f.season,cost:f.cost,fromQ:f.from.q,toQ:f.to.q,start:f.dep,end:f.dep+f.dur});
        rows.push({type:'move',lg:f.p3,from:f.to.name,to:toName,fromQ:f.to.q,toQ:toQ,start:f.dep+f.dur,end:f.dep+f.dur+f.p3.min});
        cost+=f.cost;
      }
      travel+=f.none?60:lg.min;
      return;
    }
    rows.push({type:'move',lg:lg,from:curName,to:toName,fromQ:curQ,toQ:toQ,start:at,end:at+lg.min});
    travel+=lg.min;
  }
  // 離島：目前在島上時，離開要搭船；離開島嶼 = 前往本島碼頭（含候船、航行）
  function onIsle(){return !!cur&&inAnyIsle(cur)}
  function leaveIsle(){
    var r=FERRY_ROUTES.filter(function(x){return inIsle(cur,x)})[0];
    if(!r)return;
    var pier={name:r.main.name,q:r.main.ll[0]+','+r.main.ll[1],ll:r.main.ll,kind:'pier'};
    var lg=leg(curQ,pier.q,cur,pier.ll,ms,t);
    mv(lg,pier.name,pier.q,t);
    t+=(lg.ferry&&lg.ferry.none)?60:lg.min;
    setCur(pier);
  }
  // 第一天：抵達機場後先到住宿點入住（寄放行李），再從住宿點出發
  if(o.via&&cur&&curLoc!==o.via){
    var vlg=leg(curQ,o.via.q,cur,llOf(o.via,CITYLL),ms,t);
    mv(vlg,o.via.name,o.via.q,t);t+=vlg.min;
    setCur(o.via,CITYLL);
    rows.push({type:'buffer',text:'辦理入住或寄放行李',start:t,end:t+30});t+=30;
  }
  // 自動挑餐廳：優先挑當天景點同地區、離目前位置最近的
  function pickFood(m){
    if(o.noPick||!o.food.length)return null;
    // 只挑「當天、用餐時段有營業」的餐廳（沒提供營業時間的不受限制）
    var est=Math.max(t,m?m.lo:t),idx=o.food.map(function(f,i){return i}).filter(function(i){var ft=openFit(o.food[i],o.no,est,m?m.dur:75);return !!ft&&!ft.short&&ft.start<=est+30});
    if(!idx.length)return null;
    var pref=idx.filter(function(i){return dayD[o.food[i].dist]});
    if(!pref.length&&q[0]&&!isFood(q[0]))pref=idx.filter(function(i){return o.food[i].dist===q[0].dist});
    if(!pref.length)pref=idx;
    var best=pref[0];
    if(cur){var bd=1e9;pref.forEach(function(i){var d=hav(cur,spotLL(o.food[i]));if(d<bd){bd=d;best=i}})}
    return o.food.splice(best,1)[0];
  }
  // 空檔：長度可由使用者調整（DAYS[天].gaps[鍵].m），或刪除（.del）。鍵依空檔出現的順序編號。
  var GP=(DAYS[o.no]&&DAYS[o.no].gaps)||{},MMIN=(DAYS[o.no]&&DAYS[o.no].mealMin)||{};
  function gapLen(a,b){
    var nat=b-a;
    if(nat<30)return {len:nat>0?nat:0,row:null};
    var k='g'+(gi++),ov=GP[k];
    if(ov&&ov.del)return {len:0,row:null};
    var len=(ov&&ov.m>0)?ov.m:nat;
    return {len:len,row:{type:'free',key:k,start:a,end:a+len,nat:nat}};
  }
  function meal(m,maxGap){
    var rest=pickFood(m);
    if(!rest&&onIsle())leaveIsle();   // 離島上沒有指定餐廳時，先回本島再用餐
    var tgt=rest?spotLL(rest):cur,lo=m.lo;
    var lg=(cur&&rest)?leg(curQ,mapQ(rest),cur,tgt,ms,t):null,arr=t+(lg?lg.min:0);
    if(rest&&m.lo-arr>maxGap){o.food.unshift(rest);rest=null;tgt=cur;lg=null;arr=t}
    if(rest){var sMeal=Math.max(arr,m.lo),fitR=openFit(rest,o.no,sMeal,(st.stay&&st.stay[rest.id])||m.dur);if(!fitR||fitR.short||fitR.start>sMeal+30){o.food.unshift(rest);rest=null;tgt=cur;lg=null;arr=t}else lo=Math.max(lo,fitR.start)}   // 到了還沒開／快打烊：改成自行安排用餐
    var g=gapLen(arr,Math.max(arr,lo)),s0=arr+g.len;
    var dur=rest?((st.stay&&st.stay[rest.id])||m.dur):(MMIN[m.k]||m.dur),en=s0+dur;
    if(s0>m.hi||en>o.end){if(rest)o.food.unshift(rest);return false}
    if(rest&&o.endLoc){var rr=leg(mapQ(rest),o.endLoc.q,tgt,llOf(o.endLoc,tgt),ms,en);if(rr.min>=600){o.food.unshift(rest);return false}}   // 離島餐廳：吃完要趕得上回程船
    if(lg)mv(lg,rest.name,mapQ(rest),t);
    if(g.row)rows.push(g.row);
    rows.push({type:'meal',n:m.n,key:m.k,s:rest,start:s0,end:en,cost:rest?rest.cost:0,over:s0<m.lo||s0>m.hi});
    if(rest){cost+=rest.cost;curLoc=null;cur=tgt;curName=rest.name;curQ=mapQ(rest);dayD[rest.dist]=dayD[rest.dist]||0}
    t=en;return true;
  }
  while(guard++<100){
    var m=meals[0],h0=q[0],x=(h0&&(h0.pin||isFood(h0)||sights<o.cap))?h0:null;
    if(!x){
      if(m){meal(m,90);meals.shift();continue}
      break;
    }
    var tgt=spotLL(x),xq=mapQ(x);
    if(!cur&&o.startLoc)setCur(o.startLoc,tgt);
    var lg=cur?leg(curQ,xq,cur,tgt,ms,t):null,arr=t+(lg?lg.min:0);
    var ret=o.endLoc?leg(xq,o.endLoc.q,tgt,llOf(o.endLoc,tgt),ms,arr+(isFood(x)?75:stayOf(x))).min:0;
    if(isFood(x)){
      // 人為放入的餐廳：照順序排，超出用餐時段會標示紅框
      while(meals.length&&arr>meals[0].hi)meals.shift();
      var dur2=(st.stay&&st.stay[x.id])||75,fitF=openFit(x,o.no,arr,dur2),arr0F=arr;
      if(fitF){arr=fitF.start;dur2=fitF.stay}
      var mm=meals[0],en2=arr+dur2,over2=!mm||arr<mm.lo||arr>mm.hi;
      if(mm)meals.shift();
      if(lg)mv(lg,x.name,xq,t);
      if(fitF&&arr>arr0F)rows.push({type:'buffer',text:'等候開店（'+hm(arr)+' 開始營業）',start:arr0F,end:arr});
      rows.push({type:'meal',n:mm?mm.n:'用餐',key:'f_'+x.id,s:x,start:arr,end:en2,cost:x.cost,over:over2||!fitF,closed:!fitF,short:!!(fitF&&fitF.short)});
      cost+=x.cost;curLoc=null;cur=tgt;curName=x.name;curQ=xq;t=en2;q.shift();
      if(onIsle()&&!(q[0]&&inAnyIsle(spotLL(q[0]))))leaveIsle();
      continue;
    }
    var d=stayOf(x),arr0=arr,fit=openFit(x,o.no,arr,d);
    // 營業時間：還沒開就等（最多 90 分鐘）、快打烊就縮短停留；當天公休或時間對不上就排不進來
    if(fit){arr=fit.start;d=fit.stay;if(arr>arr0)ret=o.endLoc?leg(xq,o.endLoc.q,tgt,llOf(o.endLoc,tgt),ms,arr+d).min:0}
    var en=arr+d,closed=!fit;
    if(m&&q.filter(isFood).length<meals.length){
      if(d>=240&&arr<m.hi&&en>m.lo)meals.shift();
      else if(en>m.hi-45&&m.lo-t<=60){meal(m,60);meals.shift();continue}
    }
    var over=en+ret>o.end;
    // 自動排程：放不下（或不在營業時間內）就留在未排入；固定或手動排入的景點一律排入，超時或不在營業時間內會標示
    if((over||closed)&&!o.force&&!x.pin){skipped.push(q.shift());continue}
    if(lg)mv(lg,x.name,xq,t);
    if(fit&&arr>arr0)rows.push({type:'buffer',text:'等候開放（'+hm(arr)+' 開始營業）',start:arr0,end:arr});
    rows.push({type:'sight',s:x,start:arr,end:en,cost:x.cost,over:over||closed,closed:closed,short:!!(fit&&fit.short)});
    cost+=x.cost;sights++;dayD[x.dist]=1;curLoc=null;cur=tgt;curName=x.name;curQ=xq;t=en;q.shift();
    if(onIsle()&&!(q[0]&&inAnyIsle(spotLL(q[0]))))leaveIsle();
  }
  if(onIsle())leaveIsle();
  if(!o.off){
    var needEnd=o.endLoc&&curLoc!==o.endLoc&&cur;
    var retm=needEnd?leg(curQ,o.endLoc.q,cur,llOf(o.endLoc,cur),ms,t).min:0;
    var tg=gapLen(t,o.end-retm);
    if(tg.row)rows.push(tg.row);
    t+=tg.len;
  }
  if(!o.off&&o.endLoc&&curLoc!==o.endLoc&&cur){var rl=leg(curQ,o.endLoc.q,cur,llOf(o.endLoc,cur),ms,t);mv(rl,o.endLoc.name,o.endLoc.q,t);t+=rl.min;setCur(o.endLoc,cur)}
  var loc=0;ms.forEach(function(x){loc+=LOCAL[x]});loc/=ms.length;
  var paid=rows.filter(function(r){return r.type==='move'&&r.lg.mode!=='walk'});
  paid.forEach(function(r){r.cost=(r.lg.twd>=0)?r.lg.twd:(r.lg.fare>0)?Math.round(r.lg.fare*0.21/10)*10:Math.round(loc/paid.length/10)*10});
  return {rows:rows,rest:skipped.concat(q),cost:cost,travel:travel,end:t};
}
// 自動排程時挑出當天的景點：只取同一個地區的景點（依樹狀清單的地區順序）
function pickExtras(rem,pinned,cap,dn){
  rem=rem.filter(function(x){return openThatDay(x,dn)});   // 當天公休的景點留給其他天
  // 預設同一天只排一個地區；有空檔時，由使用者自行把另一個地區的景點指派進來（最多兩區）
  var D=[];
  pinned.forEach(function(x){if(!isFood(x)&&D.indexOf(x.dist)<0)D.push(x.dist)});
  if(D.length>=2||cap<=0)return [];
  var primary=D.length?D[0]:(rem[0]&&rem[0].dist);
  if(primary===undefined)return [];
  return rem.filter(function(x){return x.dist===primary}).slice(0,cap);
}
// 排程邏輯：
// 1. 自動排程：同一天只排一個地區的景點；有空檔時由使用者自行指派另一個地區（最多兩區，系統會擋第三區）。
// 2. 餐廳依午餐 11:00–13:30、晚餐 17:30–20:00 安排；沒有餐廳或沒安排時，產生可編輯的「自行安排用餐」。
// 3. 手動拖拉後（st.lay）位置固定；「固定」開啟的項目（st.fix）在重新排程時不會被移動。
// 4. 放不下或被移出的項目放在各城市最後一天的「未排入」區。
function plan(){
  var fpl=flightPlan(),F=flList(),home=homeCo();
  var over=false,cities=[],cd=[],cfirst=[];
  // 國家依航班抵達順序；每個國家從「抵達當天」開始，連續的天數依城市景點數分配
  fpl.countries.forEach(function(c,si){
    var want=fpl.counts[si],list=orderCities(st.ci.filter(function(k){return C[k]&&C[k].co===c})),cs=list.slice(0,want);
    if(list.length>want)over=true;
    if(!cs.length)return;
    var a=alloc(cs,want),d0=fpl.firsts[si];
    cs.forEach(function(k,i){cities.push(k);cd.push(a[i]);cfirst.push(d0);d0+=a[i]});
  });
  var foreign=true;
  var hops=[null],days=[],spotCost=0,dayCity=[],lay=st.lay,fix=st.fix||{},pool={};
  // 住宿與機場的地點物件（同一份住宿共用同一個物件，才能判斷「起點＝終點」）
  var HLOC={},ALOC={};
  function hotelFor(n,k2){
    for(var j=n;j>=1&&dayCity[j]===k2;j--){var hh=DAYS[j]&&DAYS[j].hotel;if(hh&&(hh.name||hh.url))return {j:j,h:{name:hh.name||'住宿（地圖連結）',url:hh.url,lat:hh.lat,lng:hh.lng,hsrc:hh.hsrc,cost:hh.cost}}}
    return null;
  }
  function hotelLoc(rec,k2){
    if(!rec)return null;
    return HLOC[rec.j]||(HLOC[rec.j]={name:rec.h.name,q:hotelQ(rec.h,k2),ll:typeof rec.h.lat==='number'?[rec.h.lat,rec.h.lng]:null,kind:'hotel'});
  }
  function hotelStopsOf(a,b){
    var out=[];
    [a,b].forEach(function(l){
      if(l&&l.kind==='hotel'&&!out.some(function(x){return x.q===l.q}))out.push({n:l.name,q:l.q,la:l.ll?l.ll[0]:null,lo:l.ll?l.ll[1]:null});
    });
    return out;
  }
  function airportLoc(code,k2){
    var nm=String(code||'').trim(),key=k2+'|'+nm,A=airportInfo(nm,k2);
    if(A)return ALOC[key]||(ALOC[key]={name:A.nm+'（'+A.code+'）',q:llq(A.ll),ll:A.ll,kind:'airport'});
    return ALOC[key]||(ALOC[key]={name:'機場'+(nm?'（'+nm+'）':''),q:nm?nm+' airport':(C[k2].n+' 機場'),ll:null,kind:'airport'});
  }
  cities.forEach(function(k,ci){
    var all=citySpots(k,false,true);
    all.forEach(function(x){x.pin=fix[x.id]?fix[x.id]:0});
    var byId={};all.forEach(function(x){byId[x.id]=x});
    var sights=all.filter(function(x){return !isFood(x)}),foodAll=all.filter(isFood);
    var firstDay=cfirst[ci],lastDay=cfirst[ci]+cd[ci]-1,hopRes=null;
    for(var z=firstDay;z<=lastDay;z++)dayCity[z]=k;
    function pinnedFor(dn){
      var ids=Object.keys(fix).filter(function(id){return fix[id]===dn&&byId[id]});
      if(!lay&&st.fixSeq&&st.fixSeq[dn])ids.sort(function(a,b){var x=st.fixSeq[dn].indexOf(a),y=st.fixSeq[dn].indexOf(b);return (x<0?999:x)-(y<0?999:y)});
      if(lay&&lay[dn])ids.sort(function(a,b){var x=lay[dn].indexOf(a),y=lay[dn].indexOf(b);return (x<0?999:x)-(y<0?999:y)});
      return ids.map(function(id){return byId[id]});
    }
    function run(greedy){
      var food=foodAll.filter(function(x){return !x.pin}),rem=sights.filter(function(x){return !x.pin}),out=[],cost=0,placed={};
      for(var i=0;i<cd[ci];i++){
        var dn=firstDay+i;
        var drv=dayDrive(dn),ms=modesFor(drv),fls=dayFlights(dn),fd=dayInfo(dn)||{arrive:[],depart:[]};
        var hasArr=fls.some(function(f){return f.kind==='arrive'}),hasDep=fls.some(function(f){return f.kind==='depart'});
        var arrF=fd.arrive.length?F[fd.arrive[0]]:null,depF=fd.depart.length?F[fd.depart[fd.depart.length-1]]:null;
        var arrive=null;
        if(i===0&&ci>0&&C[cities[ci-1]].co===C[k].co){arrive=hop(cities[ci-1],k,ms);hopRes=arrive}   // 同國家換城市：大眾運輸／自駕；跨國由航班處理
        var tmr=dayTimes(dn),ready=0,limit=1440,pre=[],post=[];
        fls.forEach(function(f){
          var t=toMin(f.time);
          if(f.kind==='arrive'){
            // 航班抵達的日期與時間就是行程的起點：機場停留（至少 60 分鐘）之後才開始
            ready=Math.max(ready,t+f.stay);
            var dp=toMin(f.dep),px=f.plus>0;
            pre.push({type:'flight',text:'搭乘 '+(f.no||'航班')+(f.from||f.to?'（'+(f.from||'')+' → '+(f.to||'')+'）':'')+(px?'・'+(f.dep||'')+' 起飛，隔日抵達（+'+f.plus+'）':''),start:(!px&&dp!==null)?dp:t,end:t});
            pre.push({type:'buffer',text:'抵達機場，入境、領行李',start:t,end:t+f.stay});
          }else{
            limit=Math.min(limit,t-180);
            var ar=toMin(f.arr);
            post.push({type:'buffer',text:'辦理登機與安檢',start:t-180,end:t});
            post.push({type:'flight',text:'搭乘 '+(f.no||'航班')+(f.from||f.to?'（'+(f.from||'')+' → '+(f.to||'')+'）':'')+(f.plus>0?'・+'+f.plus+' 抵達':''),start:t,end:(f.plus===0&&ar!==null&&ar>t)?ar:t});
          }
        });
        if(arrF&&!hasArr)ready=Math.max(ready,810);                  // 沒填抵達時間：假設下午才開始
        var goHome=!!depF&&depF.toCo===home;
        if(depF&&!hasDep)limit=Math.min(limit,goHome?780:1080);      // 沒填起飛時間：預留前往機場的時間
        // 住宿：每天的「今晚住宿」是當天結束時回去的地方；隔天早上從這裡出發。搭機離開的那天不設定住宿，結束後前往機場。
        var endRec=depF?null:hotelFor(dn,k),hot=endRec?endRec.h:null;
        var endLoc=depF?airportLoc(depF.from,k):hotelLoc(endRec,k);
        var startLoc=null,via=null;
        if(arrF){
          // 搭飛機抵達的當天：從機場出發，可選擇先到住宿點入住
          startLoc=airportLoc(arrF.to,k);
          via=(arrF.checkin!=='direct')?hotelLoc(endRec||hotelFor(dn,k),k):null;
        }else if(arrive)startLoc=hotelLoc(endRec,k);
        else startLoc=hotelLoc(hotelFor(dn-1,k),k);
        var tourD=(DAYS[dn]&&DAYS[dn].tour&&DAYS[dn].tour.on)?DAYS[dn].tour:null;
        var dayOff=!!(DAYS[dn]&&DAYS[dn].off)||!!tourD,queue=[],cap=99,force=false,noPick=false;
        if(dayOff){cap=0}
        else if(lay){
          var ids=(lay[dn]||[]).slice();
          pinnedFor(dn).forEach(function(x){if(ids.indexOf(x.id)<0)ids.push(x.id)});
          queue=ids.map(function(id){return byId[id]}).filter(Boolean);force=true;noPick=true;
        }else{
          var pin=pinnedFor(dn),left2=0;
          for(var q2=dn;q2<=lastDay;q2++)if(!(DAYS[q2]&&DAYS[q2].off))left2++;
          var capDay=(greedy||left2<=1)?99:Math.max(1,Math.ceil(rem.length/left2));
          var extras=pickExtras(rem,pin,capDay,dn);
          queue=pin.concat(extras);cap=99;
          if(extras.length>capDay)cap=pin.filter(function(x){return !isFood(x)}).length+capDay;
        }
        var sim=simDay({no:dn,k:k,ms:ms,start:tmr.start,ready:ready,end:Math.min(tmr.end,limit),startLoc:startLoc,endLoc:endLoc,via:via,queue:queue,food:food,arrive:arrive,cap:cap,off:dayOff,force:force,noPick:noPick});
        cost+=sim.cost;
        var tourRows=[];
        if(tourD){
          var tc=parseInt(tourD.cost,10)>0?parseInt(tourD.cost,10):0;
          tourRows.push({type:'tour',name:tourD.name||'當地自由行',cost:tc,url:tourD.url||'',start:Math.max(tmr.start,ready)+(arrive?arrive.min:0),end:Math.max(Math.min(tmr.end,limit),Math.max(tmr.start,ready)+60)});
          cost+=tc;
        }
        var rows=pre.concat(sim.rows,tourRows,post),spots=[];
        sim.rows.forEach(function(r){if((r.type==='sight'||r.type==='meal')&&r.s){spots.push(r.s);placed[r.s.id]=1}});
        rem=rem.filter(function(x){return !placed[x.id]});
        out.push({no:dn,city:k,rows:rows,spots:spots,arrive:arrive,travel:sim.travel,first:i===0,last:i===cd[ci]-1,foreign:foreign,drive:drv,ms:ms,hotel:hot,startQ:startLoc?startLoc.q:'',endQ:endLoc?endLoc.q:'',hotelStops:hotelStopsOf(startLoc,endLoc),flights:fls,off:dayOff,tour:tourD,tStart:tmr.start,tEnd:Math.min(tmr.end,limit),ready:ready,noHotel:!!depF,goHome:goHome,arrF:arrF,depF:depF,arrNoTime:!!arrF&&!hasArr,depNoTime:!!depF&&!hasDep});
      }
      return {days:out,cost:cost,placed:placed};
    }
    var res=run(false);
    if(!lay){
      var unplaced=sights.filter(function(x){return !res.placed[x.id]});
      if(unplaced.length){
        var r2=run(true),un2=sights.filter(function(x){return !r2.placed[x.id]});
        if(un2.length<unplaced.length)res=r2;
      }
    }
    if(hopRes)hops[ci]=hopRes;
    res.days.forEach(function(d){days.push(d)});
    spotCost+=res.cost;
    pool[k]=sights.concat(foodAll).filter(function(x){return !res.placed[x.id]});
  });
  // 還在出發國家的純飛行日（例如跨日抵達、當天起飛的前一天或回國的隔天）：只列出航班
  fpl.days.forEach(function(fd,idx){
    if(fd.owner!==home)return;
    var no=idx+1,rows=[],ft=function(f){return (f.no||'航班')+(f.from||f.to?'（'+(f.from||'')+' → '+(f.to||'')+'）':'')};
    fd.depart.forEach(function(j){
      var f=F[j],t=toMin(f.dep),ar=toMin(f.arr);
      if(t!==null)rows.push({type:'buffer',text:'辦理登機與安檢',start:t-180,end:t});
      rows.push({type:'flight',text:'搭乘 '+ft(f)+((f.plus||0)>0?'・'+(f.arr||'')+' 抵達（+'+f.plus+'）':''),start:t!==null?t:0,end:t!==null?(((f.plus||0)===0&&ar!==null&&ar>t)?ar:t):0});
    });
    fd.homeArr.forEach(function(j){
      var f=F[j],ar=toMin(f.arr);
      rows.push({type:'flight',text:'抵達 '+(f.to||coName(home))+'（'+(f.no||'航班')+'）・旅程結束',start:ar!==null?ar:0,end:ar!==null?ar:0});
    });
    days.push({no:no,city:'',home:true,rows:rows,spots:[],arrive:null,travel:0,first:false,last:false,foreign:false,drive:false,ms:[],hotel:null,startQ:'',endQ:'',hotelStops:[],flights:[],off:false,tour:null,tStart:0,tEnd:0,ready:0,noHotel:true});
  });
  days.sort(function(a,b){return a.no-b.no});
  return {days:days,spots:spotCost,left:[],pool:pool,over:over,cities:cities,hops:hops,foreign:foreign};
}

