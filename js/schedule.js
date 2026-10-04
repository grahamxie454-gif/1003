// ================= 排程 =================
function alloc(list,total){
  var w=list.map(function(k){return Math.max(1,citySpots(k,false,false).length)}),sum=w.reduce(function(a,b){return a+b},0);
  var rest=total-list.length,q=w.map(function(x){return x/sum*rest}),fl=q.map(Math.floor);
  var r=rest-fl.reduce(function(a,b){return a+b},0);
  q.map(function(v,i){return [v-fl[i],i]}).sort(function(a,b){return b[0]-a[0]}).slice(0,r).forEach(function(x){fl[x[1]]++});
  return fl.map(function(v){return v+1});
}
function toMin(t){var m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null}
function dayFlights(no){
  var out=[],o=st.fl.out,r=st.fl.ret;
  if(no===1&&toMin(o.arr)!==null)out.push({kind:'arrive',no:o.no,from:o.from,to:o.to,time:o.arr});
  if(no===st.days&&toMin(r.dep)!==null)out.push({kind:'depart',no:r.no,from:r.from,to:r.to,time:r.dep});
  return out;
}
function dayTimes(no){
  var r=DAYS[no]||{},s=toMin(r.start),e=toMin(r.end);
  return {start:s!==null?s:(st.pace==='relax'?630:540),end:e!==null?e:1200};
}
// 用餐時段：午餐 11:00–13:30、晚餐 17:30–20:00，單餐不超過 90 分鐘
var MEALS=[{n:'午餐',k:'lunch',lo:660,hi:810,dur:75},{n:'晚餐',k:'dinner',lo:1050,hi:1200,dur:75}];
function stayOf(x){return x.stay>0?x.stay:({c:90,n:75,s:60,x:60,f:75}[x.s]||60)}
var isFood=function(x){return x.s==='f'};
// ---- Google 路線時間：有快取就用 Google 的時間，沒有就先用估算並排隊向 Google 取得 ----
var ROUTE={},ROUTE_NEED={},ROUTE_TRIED={},ROUTE_OFF=false,ROUTE_MSG='',routeTimer=null;
function gMode(m){return m==='walk'?'WALK':(m==='drive'?'DRIVE':'TRANSIT')}
function leg(fq,tq,a,b,ms){
  var est=localLeg(a,b,ms),key=gMode(est.mode)+'|'+fq+'|'+tq,h=ROUTE[key];
  if(h)return {km:h.m/1000,min:round5(h.s/60),mode:est.mode,g:true};
  if(!ROUTE_OFF&&!ROUTE_TRIED[key])ROUTE_NEED[key]={key:key,mode:gMode(est.mode),from:fq,to:tq};
  return est;
}
function scheduleRoutes(){
  clearTimeout(routeTimer);
  if(ROUTE_OFF||!Object.keys(ROUTE_NEED).length)return;
  routeTimer=setTimeout(fetchRoutes,1200);
}
async function fetchRoutes(){
  var keys=Object.keys(ROUTE_NEED).filter(function(k){return !ROUTE[k]&&!ROUTE_TRIED[k]}).slice(0,20);
  if(!keys.length||!sb)return;
  var legs=keys.map(function(k){return ROUTE_NEED[k]});
  keys.forEach(function(k){ROUTE_TRIED[k]=1;delete ROUTE_NEED[k]});
  ROUTE_MSG='正在向 Google 取得路線時間…';var st0=$('routeStat');if(st0)st0.textContent=ROUTE_MSG;
  try{
    var r=await sb.functions.invoke('route-times',{body:{legs:legs}});
    var d=r.data||{},got=0;
    if(r.error){
      var detail=r.error.message||'呼叫失敗';
      try{if(r.error.context&&r.error.context.text){var tx=await r.error.context.text();if(tx)detail+='：'+tx.slice(0,200)}}catch(e2){}
      throw new Error(detail);
    }
    if(d.error==='not_configured'){ROUTE_OFF=true;ROUTE_MSG='尚未設定 Google 金鑰，路線時間使用估算。'}
    else if(d.error){ROUTE_OFF=true;ROUTE_MSG='路線查詢失敗：'+d.error}
    else{
      (d.results||[]).forEach(function(x){ROUTE[x.key]={s:x.s,m:x.m};got++});
      if(d.capped){ROUTE_OFF=true;ROUTE_MSG='今日 Google 查詢額度已用完，其餘路線時間使用估算。'}
      else if(d.fails&&!got)ROUTE_MSG='部分路段 Google 無法規劃（'+d.fails+' 段），這些路段使用估算。'+(d.lastErr?'原因：'+d.lastErr:'');
      else ROUTE_MSG='';
    }
    if(got)render(true);else{var s1=$('routeStat');if(s1)s1.textContent=ROUTE_MSG}
    scheduleRoutes();
  }catch(err){ROUTE_OFF=true;ROUTE_MSG='路線查詢失敗，路線時間使用估算。原因：'+(err.message||err);var s2=$('routeStat');if(s2)s2.textContent=ROUTE_MSG}
}
async function loadRoutes(){
  try{
    for(var from=0;from<5000;from+=1000){
      var r=await sb.from('route_cache').select('key,secs,meters').range(from,from+999);
      if(r.error||!r.data)break;
      r.data.forEach(function(x){ROUTE[x.key]={s:x.secs,m:x.meters}});
      if(r.data.length<1000)break;
    }
  }catch(e){}
}

function simDay(o){
  var ms=o.ms,rows=[],t=Math.max(o.start,o.ready),cur=null,curName='',curQ='',hl=null,hn='',hlQ='',
    meals=o.off?[]:MEALS.slice(),q=o.queue.slice(),skipped=[],cost=0,travel=0,sights=0,guard=0,gi=0,dayD={};
  if(o.hotel){hn=o.hotel.name;hlQ=hotelQ(o.hotel,o.k);if(typeof o.hotel.lat==='number'){hl=[o.hotel.lat,o.hotel.lng];cur=hl;curName=hn;curQ=hlQ}}
  if(o.arrive){rows.push({type:'hop',hop:o.arrive,start:t,end:t+o.arrive.min,cost:o.arrive.cost});t+=o.arrive.min;travel+=o.arrive.min}
  function mv(lg,toName,toQ,at){
    rows.push({type:'move',lg:lg,from:curName,to:toName,fromQ:curQ,toQ:toQ,start:at,end:at+lg.min});
    travel+=lg.min;
  }
  // 自動挑餐廳：優先挑當天景點同地區、離目前位置最近的
  function pickFood(){
    if(o.noPick||!o.food.length)return null;
    var idx=o.food.map(function(f,i){return i}),pref=idx.filter(function(i){return dayD[o.food[i].dist]});
    if(!pref.length&&q[0]&&!isFood(q[0]))pref=idx.filter(function(i){return o.food[i].dist===q[0].dist});
    if(!pref.length)pref=idx;
    var best=pref[0];
    if(cur){var bd=1e9;pref.forEach(function(i){var d=hav(cur,spotLL(o.food[i]));if(d<bd){bd=d;best=i}})}
    return o.food.splice(best,1)[0];
  }
  function gap(a,b){if(b-a>=30)rows.push({type:'free',key:'g'+(gi++),start:a,end:b})}
  function meal(m,maxGap){
    var rest=pickFood(),tgt=rest?spotLL(rest):cur;
    var lg=(cur&&rest)?leg(curQ,mapQ(rest),cur,tgt,ms):null,arr=t+(lg?lg.min:0);
    if(rest&&m.lo-arr>maxGap){o.food.unshift(rest);rest=null;tgt=cur;lg=null;arr=t}
    var s0=Math.max(arr,m.lo),en=Math.min(s0+m.dur,m.hi);
    if(en-s0<45||en>o.end){if(rest)o.food.unshift(rest);return false}
    if(lg)mv(lg,rest.name,mapQ(rest),t);
    gap(arr,s0);
    rows.push({type:'meal',n:m.n,key:m.k,s:rest,start:s0,end:en,cost:rest?rest.cost:0});
    if(rest){cost+=rest.cost;cur=tgt;curName=rest.name;curQ=mapQ(rest);dayD[rest.dist]=dayD[rest.dist]||0}
    t=en;return true;
  }
  while(guard++<100){
    var m=meals[0],h0=q[0],x=(h0&&(h0.pin||isFood(h0)||sights<o.cap))?h0:null;
    if(!x){
      if(m){meal(m,90);meals.shift();continue}
      break;
    }
    var tgt=spotLL(x),xq=mapQ(x);
    if(!cur&&o.hotel){hl=[tgt[0]+0.012,tgt[1]+0.012];cur=hl;curName=hn;curQ=hlQ}
    var lg=cur?leg(curQ,xq,cur,tgt,ms):null,arr=t+(lg?lg.min:0);
    var ret=hl?leg(xq,hlQ,tgt,hl,ms).min:0;
    if(isFood(x)){
      // 人為放入的餐廳：照順序排，超出用餐時段會標示紅框
      while(meals.length&&arr>meals[0].hi-45)meals.shift();
      var mm=meals[0],en2=arr+75,over2=!mm||arr<mm.lo||arr>mm.hi-45||arr+ret>o.end;
      if(mm&&!over2)en2=Math.min(arr+mm.dur,mm.hi);
      if(mm)meals.shift();
      if(lg)mv(lg,x.name,xq,t);
      rows.push({type:'meal',n:mm?mm.n:'用餐',key:'f_'+x.id,s:x,start:arr,end:en2,cost:x.cost,over:over2});
      cost+=x.cost;cur=tgt;curName=x.name;curQ=xq;t=en2;q.shift();
      continue;
    }
    var d=stayOf(x),en=arr+d;
    if(m&&q.filter(isFood).length<meals.length){
      if(d>=240&&arr<m.hi&&en>m.lo)meals.shift();
      else if(en>m.hi-45&&m.lo-t<=60){meal(m,60);meals.shift();continue}
    }
    var over=en+ret>o.end;
    // 自動排程：放不下就留在未排入；固定或手動排入的景點一律排入，超時會標示
    if(over&&!o.force&&!x.pin){skipped.push(q.shift());continue}
    if(lg)mv(lg,x.name,xq,t);
    rows.push({type:'sight',s:x,start:arr,end:en,cost:x.cost,over:over});
    cost+=x.cost;sights++;dayD[x.dist]=1;cur=tgt;curName=x.name;curQ=xq;t=en;q.shift();
  }
  if(!o.off){
    var retm=(hl&&cur!==hl)?leg(curQ,hlQ,cur,hl,ms).min:0;
    gap(t,o.end-retm);
    if(o.end-retm-t>=30)t=o.end-retm;
  }
  if(hl&&cur!==hl){var rl=leg(curQ,hlQ,cur,hl,ms);mv(rl,hn,hlQ,t);t+=rl.min}
  var loc=0;ms.forEach(function(x){loc+=LOCAL[x]});loc/=ms.length;
  var paid=rows.filter(function(r){return r.type==='move'&&r.lg.mode!=='walk'});
  paid.forEach(function(r){r.cost=Math.round(loc/paid.length/10)*10});
  return {rows:rows,rest:skipped.concat(q),cost:cost,travel:travel,end:t};
}
// 自動排程時挑出當天的景點：同地區優先；只有當天該區景點 ≤1 個時才加入另一區；最多兩區
function pickExtras(rem,pinned,cap){
  var D=[];
  pinned.forEach(function(x){if(!isFood(x)&&D.indexOf(x.dist)<0)D.push(x.dist)});
  if(D.length>=2||cap<=0)return [];
  var order=[];
  rem.forEach(function(x){if(order.indexOf(x.dist)<0)order.push(x.dist)});
  var primary=D.length?D[0]:order[0];
  if(primary===undefined)return [];
  var out=rem.filter(function(x){return x.dist===primary}).slice(0,cap);
  var base=pinned.filter(function(x){return !isFood(x)}).length+out.length;
  if(base<=1&&out.length<cap){
    var sec=order.filter(function(d){return d!==primary})[0];
    if(sec!==undefined)out=out.concat(rem.filter(function(x){return x.dist===sec}).slice(0,cap-out.length));
  }
  return out;
}
// 排程邏輯：
// 1. 自動排程：同地區的景點排同一天；某區當天只有 1 個景點時才加另一區，最多兩區。
// 2. 餐廳依午餐 11:00–13:30、晚餐 17:30–20:00 安排；沒有餐廳或沒安排時，產生可編輯的「自行安排用餐」。
// 3. 手動拖拉後（st.lay）位置固定；「固定」開啟的項目（st.fix）在重新排程時不會被移動。
// 4. 放不下或被移出的項目放在各城市最後一天的「未排入」區。
function plan(){
  var ordered=orderCities(st.ci.filter(function(k){return C[k]}));
  var over=ordered.length>st.days,cities=ordered.slice(0,st.days),total=st.days;
  var cd=alloc(cities,total),foreign=CO[C[cities[0]].co].flight>0;
  var hops=[null],days=[],spotCost=0,dayNo=0,dayCity=[],lay=st.lay,fix=st.fix||{},pool={};
  cities.forEach(function(k,ci){
    var all=citySpots(k,false,true);
    all.forEach(function(x){x.pin=fix[x.id]?fix[x.id]:0});
    var byId={};all.forEach(function(x){byId[x.id]=x});
    var sights=all.filter(function(x){return !isFood(x)}),foodAll=all.filter(isFood);
    var firstDay=dayNo+1,lastDay=dayNo+cd[ci],hopRes=null;
    for(var z=firstDay;z<=lastDay;z++)dayCity[z]=k;
    function pinnedFor(dn){
      var ids=Object.keys(fix).filter(function(id){return fix[id]===dn&&byId[id]});
      if(lay&&lay[dn])ids.sort(function(a,b){var x=lay[dn].indexOf(a),y=lay[dn].indexOf(b);return (x<0?999:x)-(y<0?999:y)});
      return ids.map(function(id){return byId[id]});
    }
    function run(greedy){
      var food=foodAll.filter(function(x){return !x.pin}),rem=sights.filter(function(x){return !x.pin}),out=[],cost=0,placed={};
      for(var i=0;i<cd[ci];i++){
        var dn=firstDay+i;
        var drv=dayDrive(dn),ms=modesFor(drv),fls=dayFlights(dn);
        var hasArr=fls.some(function(f){return f.kind==='arrive'}),hasDep=fls.some(function(f){return f.kind==='depart'});
        var arrive=null;
        if(i===0&&ci>0){arrive=hop(cities[ci-1],k,ms);hopRes=arrive}
        var tmr=dayTimes(dn),ready=0,limit=1440,pre=[],post=[];
        fls.forEach(function(f){
          var t=toMin(f.time),o=st.fl.out,r=st.fl.ret;
          if(f.kind==='arrive'){
            ready=Math.max(ready,t+90);
            var dp=toMin(o.dep);
            pre.push({type:'flight',text:'搭乘 '+(f.no||'航班')+(f.from||f.to?'（'+(f.from||'')+' → '+(f.to||'')+'）':''),start:dp!==null?dp:t,end:t});
            pre.push({type:'buffer',text:'入境、領行李，前往住宿或市區',start:t,end:t+90});
          }else{
            limit=Math.min(limit,t-180);
            var ar=toMin(r.arr);
            post.push({type:'buffer',text:'前往機場並辦理登機',start:t-180,end:t});
            post.push({type:'flight',text:'搭乘 '+(f.no||'航班')+(f.from||f.to?'（'+(f.from||'')+' → '+(f.to||'')+'）':''),start:t,end:ar!==null&&ar>t?ar:t});
          }
        });
        if(dn===1&&foreign&&!hasArr)ready=Math.max(ready,810);
        if(dn===total&&!hasDep)limit=Math.min(limit,foreign?780:1080);
        var hot=null;
        for(var j2=dn;j2>=1&&dayCity[j2]===k;j2--){var hh=DAYS[j2]&&DAYS[j2].hotel;if(hh&&(hh.name||hh.url)){hot={name:hh.name||'住宿（地圖連結）',url:hh.url,lat:hh.lat,lng:hh.lng,cost:hh.cost};break}}
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
          var extras=pickExtras(rem,pin,capDay);
          queue=pin.concat(extras);cap=99;
          if(extras.length>capDay)cap=pin.filter(function(x){return !isFood(x)}).length+capDay;
        }
        var sim=simDay({no:dn,k:k,ms:ms,start:tmr.start,ready:ready,end:Math.min(tmr.end,limit),hotel:hot,queue:queue,food:food,arrive:arrive,cap:cap,off:dayOff,force:force,noPick:noPick});
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
        out.push({no:dn,city:k,rows:rows,spots:spots,arrive:arrive,travel:sim.travel,first:i===0,last:i===cd[ci]-1,foreign:foreign,drive:drv,ms:ms,hotel:hot,flights:fls,off:dayOff,tour:tourD,tStart:tmr.start,tEnd:Math.min(tmr.end,limit),ready:ready});
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
    dayNo=lastDay;
  });
  return {days:days,spots:spotCost,left:[],pool:pool,over:over,cities:cities,hops:hops,foreign:foreign};
}

