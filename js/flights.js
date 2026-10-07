// ================= 航班：行程的骨架 =================
// 行程由「一串接續的航班」決定：每段航班設定航班號與日期，查詢後自動帶入出發／抵達機場、抵達的國家與城市、起降時間（跨日顯示 +1）。
// 國家依「航班抵達的順序」自動產生，不能調整；城市與景點的順序才能調整。最後一段航班要回到出發國家，行程才算完整。
var CC2CO={JP:'jp',KR:'kr',TW:'tw',SG:'sg',TH:'th',FR:'fr',IT:'it',GB:'uk',US:'us'};
var HOME_DEFAULT='tw';
var dayDiff=function(a,b){return Math.round((Date.parse(a)-Date.parse(b))/864e5)};
var validDate=function(s){return !!s&&!isNaN(Date.parse(s))};
var addDaysStr=function(s,n){return new Date(Date.parse(s)+n*864e5).toISOString().slice(0,10)};
function flList(){if(!Array.isArray(st.flights))st.flights=[];return st.flights}
function homeCo(){var f=flList()[0];return (f&&f.fromCo)||HOME_DEFAULT}
function arrDate(f){return validDate(f.date)?addDaysStr(f.date,f.plus||0):''}
function coName(c){return CO[c]?CO[c].n:({tw:'台灣'}[c]||c||'')}
function airportStay(f){return Math.max(60,parseInt(f.stay,10)||60)}
function plusTxt(f){return (f.plus||0)>0?'+'+f.plus:''}
// 讓航班的國家由城市決定：出發城市（第一段可選）、抵達城市；之後的出發城市＝上一段的抵達城市
function syncFlights(){
  var F=flList();
  F.forEach(function(f,i){
    if(i>0)f.fromCity=F[i-1].toCity||'';
    if(i===0&&!(f.fromCity&&C[f.fromCity])){f.fromCity=f.fromCo?pickCity(f.fromCo):(C.tpe?'tpe':pickCity(HOME_DEFAULT))}
    if(f.fromCity&&C[f.fromCity])f.fromCo=C[f.fromCity].co;
    if(f.toCity&&!C[f.toCity])f.toCity='';
    if(!f.toCity&&f.toCo){f.toCity=(F[0]&&F[0].fromCo===f.toCo)?F[0].fromCity:pickCity(f.toCo)}
    if(f.toCity)f.toCo=C[f.toCity].co;
  });
}
function cityOpts(sel,skipCo){
  return '<option value="">選擇城市</option>'+Object.keys(CO).map(function(c){
    var ks=Object.keys(C).filter(function(k){return C[k].co===c&&(c!==skipCo||k===sel)});
    return ks.length?'<optgroup label="'+esc(coName(c))+'">'+ks.map(function(k){return '<option value="'+esc(k)+'"'+(k===sel?' selected':'')+'>'+esc(C[k].n)+'</option>'}).join('')+'</optgroup>':'';
  }).join('');
}
function cityName(k){return C[k]?C[k].n:''}
// 航班抵達的外國城市（一定會排進行程）
function arrivalCities(){
  var home=homeCo();
  return flList().filter(function(f){return f.toCity&&C[f.toCity]&&C[f.toCity].co!==home}).map(function(f){return f.toCity});
}

// 依抵達機場座標挑最近的內建城市（300 公里內）；沒有座標就用該國第一個城市
function pickCity(co,lat,lon){
  var ks=Object.keys(C).filter(function(k){return C[k].co===co});
  if(!ks.length)return '';
  if(typeof lat==='number'&&typeof lon==='number'){
    var best='',bd=1e9;
    ks.forEach(function(k){if(typeof C[k].lat!=='number'||!C[k].lat)return;var d=hav([lat,lon],[C[k].lat,C[k].lng]);if(d<bd){bd=d;best=k}});
    if(best&&bd<=300)return best;
  }
  return ks[0];
}

// 檢查航班是否能接續：上一段抵達的國家 = 這一段出發的國家
function chainState(){
  syncFlights();
  var F=flList(),home=homeCo(),errs=[];
  F.forEach(function(f,i){
    if(i>0)f.fromCo=F[i-1].toCo||'';
    if(i>0&&F[i-1].toCo===home){errs[i]='已經回到出發國家（'+coName(home)+'），行程已完整，不能再新增航班。';return}
    if(i>0&&f.dFromCo&&F[i-1].toCo&&f.dFromCo!==F[i-1].toCo){
      errs[i]='跨國行程無法接續：這一段從「'+coName(f.dFromCo)+'」出發，但上一段抵達的是「'+coName(F[i-1].toCo)+'」。請修正航班；修正之前不能再新增航班。';return;
    }
    if(i>0&&validDate(f.date)&&validDate(F[i-1].date)&&f.date<arrDate(F[i-1])){errs[i]='起飛日期早於上一段航班的抵達日期（'+arrDate(F[i-1])+'）。';return}
    if(f.toCo&&f.fromCo&&f.toCo===f.fromCo)errs[i]='抵達國家與出發國家相同（'+coName(f.toCo)+'），不支援國內航班，請確認航班。';
  });
  var last=F[F.length-1],anyErr=errs.some(Boolean);
  var resolved=!!last&&validDate(last.date)&&!!last.toCo&&(last.toCo===home||!!last.toCity);
  return {errs:errs,anyErr:anyErr,complete:!!last&&!anyErr&&last.toCo===home&&resolved,canAdd:(!last)||(!anyErr&&resolved&&last.toCo!==home)};
}

// 回傳 {ok, code(0=缺資料,-1=不合理), msg, total, start, days[], countries[], counts[], firsts[]}
// days[k] = {date, owner(國家代碼；回到出發國家的純飛行日為出發國家), arrive:[航班索引], depart:[航班索引], homeArr:[航班索引]}
var FPC={k:'',v:null};
function fpKey(){return JSON.stringify(flList())+'|'+Object.keys(CO).length+'|'+Object.keys(C).length}
function flightPlan(){
  var key=fpKey();
  if(FPC.k===key)return FPC.v;
  var v=computePlan();
  FPC.k=fpKey();FPC.v=v;
  return v;
}
function computePlan(){
  syncFlights();
  var F=flList(),res={ok:false,code:0,msg:'',total:0,start:'',days:[],countries:[],counts:[],firsts:[]};
  if(!F.length){res.msg='請先新增第一段航班（航班號與日期）。';return res}
  var miss=[];
  F.forEach(function(f,i){
    var n='第 '+(i+1)+' 段航班';
    if(!f.no)miss.push(n+'的航班號');
    if(!validDate(f.date))miss.push(n+'的日期');
    if(i===0&&!(f.fromCity&&C[f.fromCity]))miss.push(n+'的出發城市');
    if(!f.toCity||!C[f.toCity])miss.push(n+'的抵達城市');
  });
  if(miss.length){res.msg='尚未填寫：'+miss.join('、')+'。';return res}
  var cs=chainState(),e=cs.errs.filter(Boolean)[0];
  if(e){res.code=-1;res.msg=e;return res}
  if(!cs.complete){res.msg='最後一段航班需要回到出發國家（'+coName(homeCo())+'），行程才算完整，請新增回程航班。';return res}
  var home=homeCo(),start=F[0].date,end=arrDate(F[F.length-1]),total=dayDiff(end,start)+1;
  if(total<2||total>40){res.code=-1;res.msg='行程總天數需介於 2–40 天，請確認航班日期。';return res}
  var days=[];
  for(var k=0;k<total;k++){
    var D=addDaysStr(start,k),owner=home,arr=[],dep=[],homeArr=[];
    F.forEach(function(f,j){
      var foreign=f.toCo!==home,ad=arrDate(f);
      // 外國航班：抵達當天起算抵達國的日子；回出發國家的航班：起飛日之後才算回到家
      if(foreign?ad<=D:f.date<D)owner=f.toCo;
      if(foreign&&ad===D)arr.push(j);
      if(!foreign&&ad===D)homeArr.push(j);
      if(f.date===D&&!(foreign&&ad===D))dep.push(j);
    });
    days.push({date:D,owner:owner,arrive:arr,depart:dep,homeArr:homeArr});
  }
  var order=[],counts={},firsts={},seen={},prev=null;
  for(var i=0;i<days.length;i++){
    var o=days[i].owner;
    if(o!==home){
      if(o!==prev&&seen[o]){res.code=-1;res.msg='同一個國家不能分兩次造訪（'+coName(o)+'）。';return res}
      if(!seen[o]){seen[o]=1;order.push(o);firsts[o]=i+1}
      counts[o]=(counts[o]||0)+1;
    }
    prev=o;
  }
  for(var q=0;q<F.length;q++)if(F[q].toCo!==home&&!counts[F[q].toCo]){res.code=-1;res.msg='「'+coName(F[q].toCo)+'」沒有可規劃的天數，請確認航班日期。';return res}
  res.ok=true;res.code=1;res.total=total;res.start=start;res.days=days;res.countries=order;
  res.counts=order.map(function(c){return counts[c]});res.firsts=order.map(function(c){return firsts[c]});
  return res;
}
function autoDays(){var p=flightPlan();return p.ok?p.total:p.code}
function dayInfo(no){var p=flightPlan();return p.ok?p.days[no-1]:null}
function dayDate(no){
  var p=flightPlan();if(!p.ok)return '';
  var d=new Date(Date.parse(p.start)+(no-1)*864e5);
  return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+'（'+'日一二三四五六'[d.getUTCDay()]+'）';
}
function syncDays(){
  var p=flightPlan();
  if(p.ok)st.days=p.total;
  $('days').value=st.days;
  $('daysOut').textContent=p.ok?(p.total+' 天 '+(p.total-1)+' 夜'):'尚未計算';
  $('daysHint').textContent=p.ok?('由第一段航班起飛日 '+p.start+' 到最後一段航班抵達日 '+addDaysStr(p.start,p.total-1)+' 自動計算（跨日抵達會多算一天）；'+p.countries.map(function(c,i){return coName(c)+' '+p.counts[i]+' 天'}).join('、')+'。'):
    (p.code<0?p.msg:'請在上方「航班」填入所有航班後，天數會自動計算。');
}

// 某一天的航班（有填時間的才會用來限制當天的時段）
function dayFlights(no){
  var d=dayInfo(no);if(!d)return [];
  var F=flList(),out=[];
  d.arrive.forEach(function(j){var f=F[j];out.push({kind:'arrive',no:f.no,from:f.from,to:f.to,time:f.arr,dep:f.dep,plus:f.plus||0,stay:airportStay(f),j:j})});
  d.depart.forEach(function(j){var f=F[j];out.push({kind:'depart',no:f.no,from:f.from,to:f.to,time:f.dep,arr:f.arr,plus:f.plus||0,j:j})});
  return out.filter(function(x){return toMin(x.time)!==null});
}

// ----- 把查詢結果套用到航班 -----
function homeCoFor(i,f){return i===0?(f.fromCo||HOME_DEFAULT):homeCo()}
function coOk(c){return !!c&&(!!CO[c]||c===HOME_DEFAULT)}
function applyLookup(i,d){
  var f=flList()[i],msgs=[];
  f.from=d.from||f.from||'';f.to=d.to||f.to||'';
  if(d.dep)f.dep=d.dep;if(d.arr)f.arr=d.arr;
  f.plus=d.plus||(d.nextDay?1:0);
  var fc=CC2CO[d.fromCc],tc=CC2CO[d.toCc];
  f.dFromCo=coOk(fc)?fc:'';
  if(i===0&&coOk(fc)){var fcity=pickCity(fc,d.fromLat,d.fromLon);if(fcity)f.fromCity=fcity}
  var tcity=coOk(tc)?pickCity(tc,d.toLat,d.toLon):'';
  if(tcity)f.toCity=tcity;
  else msgs.push('抵達地（'+(d.toCc||'未知')+'）不在內建城市中，請手動選擇抵達城市。');
  return msgs;
}

// ----- 畫面 -----
var FMSG={},FLBUSY={};
function planSig(){var p=flightPlan();return JSON.stringify([p.ok,p.total,p.countries,p.counts])}
function newFlight(fromCity,toCity){return {no:'',date:'',plus:0,from:'',to:'',dep:'',arr:'',fromCity:fromCity||'',toCity:toCity||'',stay:60}}
// 航班預設至少兩段（去程、回程）；超過兩段的才能刪除
function ensureFlights(){
  var F=flList();
  if(!F.length)F.push(newFlight(C.tpe?'tpe':pickCity(HOME_DEFAULT),''));
  syncFlights();
  if(F.length<2)F.push(newFlight(F[0].toCity||'',F[0].fromCity));
  syncFlights();
}
function renderFlights(){
  ensureFlights();
  var F=flList(),cs=chainState(),home=homeCo(),h='';
  h+='<p class="hint">每一段航班都要填航班號與起飛日期，按「查詢」會自動帶入機場、出發與抵達城市（國家由城市決定）和起降時間（跨日抵達會顯示 +1）。下一段航班的出發城市就是上一段的抵達城市，國家必須相同；最後一段要回到出發國家，才能展開行程。</p>';
  F.forEach(function(f,i){
    var last=i===F.length-1;
    h+='<div class="fl'+(cs.errs[i]?' bad':'')+'"><div class="flhead"><b>第 '+(i+1)+' 段航班'+(i===0?'（去程）':(i===1?'（回程，或接續下一個國家）':''))+'</b>'+(last&&i>=2?'<button type="button" class="ghost sm x" data-fdel="'+i+'" aria-label="刪除這段航班">✕</button>':'')+'</div>'+
      '<div class="row"><input type="text" data-fi="'+i+'" data-ff="no" value="'+esc(f.no||'')+'" placeholder="航班號 例：CI100" maxlength="8" aria-label="航班號">'+
      '<input type="date" data-fi="'+i+'" data-ff="date" value="'+esc(f.date||'')+'" aria-label="起飛日期">'+
      '<button type="button" class="ghost" data-fi="'+i+'" data-fact="lookup"'+(FLBUSY[i]?' disabled':'')+'>'+(FLBUSY[i]?'查詢中…':'查詢')+'</button></div>'+
      '<div class="row"><input type="text" data-fi="'+i+'" data-ff="from" value="'+esc(f.from||'')+'" placeholder="出發機場" maxlength="20" aria-label="出發機場"><input type="text" data-fi="'+i+'" data-ff="to" value="'+esc(f.to||'')+'" placeholder="抵達機場" maxlength="20" aria-label="抵達機場"></div>'+
      '<div class="row"><label>起飛時間<input type="time" data-fi="'+i+'" data-ff="dep" value="'+esc(f.dep||'')+'"></label><label>降落時間'+((f.plus||0)>0?' <span class="plus">'+plusTxt(f)+'</span>':'')+'<input type="time" data-fi="'+i+'" data-ff="arr" value="'+esc(f.arr||'')+'"></label>'+
        '<label>跨日<select data-fi="'+i+'" data-ff="plus"><option value="0">當天抵達</option><option value="1"'+((f.plus||0)===1?' selected':'')+'>+1 天</option><option value="2"'+((f.plus||0)===2?' selected':'')+'>+2 天</option></select></label></div>'+
      '<div class="row">'+(i===0?'<label>出發城市<select data-fi="0" data-ff="fromCity">'+cityOpts(f.fromCity,'')+'</select></label>':'<span class="muted">出發城市：'+esc(cityName(f.fromCity)||'（請先設定上一段）')+'（'+esc(coName(f.fromCo))+'）</span>')+
        '<label>抵達城市<select data-fi="'+i+'" data-ff="toCity">'+cityOpts(f.toCity,f.fromCo)+'</select></label></div>'+
      (f.toCo&&f.toCo!==home?'<div class="row"><label>抵達後在機場的停留時間（分鐘，不得少於 60）<input type="number" min="60" step="15" data-fi="'+i+'" data-ff="stay" value="'+airportStay(f)+'"></label></div>'+
        '<label class="checkin">抵達機場後<select data-fi="'+i+'" data-ff="checkin" aria-label="第 '+(i+1)+' 段航班抵達後的安排"><option value="hotel"'+(f.checkin!=='direct'?' selected':'')+'>先到住宿點入住，再從住宿點出發</option><option value="direct"'+(f.checkin==='direct'?' selected':'')+'>從機場直接去第一個行程，晚上再回住宿點</option></select></label>':'')+
      '<p class="fmsg'+((cs.errs[i]||(FMSG[i]&&FMSG[i][0]==='!'))?' err':'')+'">'+esc(cs.errs[i]||(FMSG[i]||'').replace(/^!/,'')||'')+'</p></div>';
  });
  var why=!cs.canAdd?(F.length&&cs.anyErr?'上方有航班錯誤，請先修正':(F.length&&F[F.length-1].toCo===home?'行程已完整（已回到出發國家）':'請先完成上一段航班（日期、抵達國家與城市）')):'';
  h+='<div class="row"><button type="button" class="ghost" data-fadd="1"'+(cs.canAdd?'':' disabled')+'>＋ '+(F.length?'新增接續航班':'新增第一段航班')+'</button>'+(why?'<span class="muted">'+esc(why)+'</span>':'')+'</div>';
  $('flights').innerHTML=h;
  renderExpand();
}
// 「展開行程」按鈕：航班與條件都設好之後，才顯示景點選擇與每日行程規劃
function renderExpand(){
  var b=$('expandBtn');if(!b)return;
  var p=flightPlan();
  b.disabled=!p.ok;
  b.textContent=st.expanded&&p.ok?'行程已展開':'展開行程';
  $('expandMsg').textContent=p.ok?(st.expanded?'修改航班或條件時，下方行程會即時更新。':'航班設定完成，按「展開行程」開始選擇城市與景點。'):p.msg;
}
function afterFlightChange(sigBefore){
  normalize();
  if(planSig()!==sigBefore){delete st.lay;delete st.fix;delete st.fixSeq}
  buildCities();renderOrder();syncDays();renderFlights();render();
}
on('flights','change',function(e){
  var el=e.target;
  var i=+el.dataset.fi,ff=el.dataset.ff,F=flList();
  if(isNaN(i)||!ff||!F[i])return;
  if(ff==='checkin'){if(el.value==='direct')F[i].checkin='direct';else delete F[i].checkin;render();return}
  var f=F[i],before=planSig(),v=el.value.trim();
  if(ff==='no')v=v.replace(/\s+/g,'').toUpperCase();
  if(ff==='plus')f.plus=parseInt(v,10)||0;
  else if(ff==='stay'){var n=parseInt(v,10);f.stay=(n>=60)?n:60;FMSG[i]=(n>=60)?'':'!機場停留時間不得少於 60 分鐘，已改為 60。'}
  else if(ff==='fromCity'){var oc=f.fromCity,oh=homeCo();f.fromCity=v;f.dFromCo='';syncFlights();var rt=F[1];if(rt&&v&&(rt.toCity===oc||(rt.toCo===oh&&C[v].co!==oh)))rt.toCity=v}
  else if(ff==='toCity'){f.toCity=v;if(!v)f.toCo=''}
  else if(v)f[ff]=v;else delete f[ff];
  // 降落時間比起飛時間早，一定是跨日抵達
  if((ff==='dep'||ff==='arr')&&f.dep&&f.arr&&toMin(f.arr)<toMin(f.dep)&&!f.plus){f.plus=1;FMSG[i]='降落時間早於起飛時間，已自動標示為 +1（隔日抵達）。'}
  afterFlightChange(before);
});
on('flights','click',async function(e){
  var add=e.target.closest('button[data-fadd]'),del=e.target.closest('button[data-fdel]'),b=e.target.closest('button[data-fact]');
  if(add){
    if(chainState().canAdd){
      var before=planSig(),F=flList();
      F.push(newFlight(F[F.length-1].toCity,''));
      afterFlightChange(before);
    }
    return;
  }
  if(del){
    var bf=planSig(),di=+del.dataset.fdel;if(di<2||di!==flList().length-1)return;flList().splice(di,1);
    if(!flList().length)st.expanded=false;
    afterFlightChange(bf);return;
  }
  if(!b)return;
  e.stopPropagation();
  var i=+b.dataset.fi,f=flList()[i];
  if(!f)return;
  if(!f.no||!validDate(f.date)){FMSG[i]='!請先填航班號與日期。';renderFlights();return}
  FLBUSY[i]=true;FMSG[i]='';renderFlights();
  try{
    var r=await sb.functions.invoke('trip-tools',{body:{action:'flight',no:f.no,date:f.date}}),d=r.data;
    if(r.error||!d)FMSG[i]='!查詢失敗，請手動填入。';
    else if(d.error==='not_configured')FMSG[i]='!尚未啟用自動查詢（需先設定航班資料服務金鑰），請手動選擇城市並填入起降時間。';
    else if(d.error)FMSG[i]='!'+d.error+'，請手動填入。';
    else{
      var before2=planSig(),warn=applyLookup(i,d);
      FMSG[i]=(warn.length?'!':'')+'已取得：'+(d.from||'')+' '+(d.dep||'')+' → '+(d.to||'')+' '+(d.arr||'')+(f.plus>0?' '+plusTxt(f):'')+'。'+warn.join('')+'時間為預定時刻，請以航空公司為準。';
      FLBUSY[i]=false;afterFlightChange(before2);return;
    }
  }catch(err){FMSG[i]='!查詢失敗，請手動填入。'}
  FLBUSY[i]=false;renderFlights();
});
on('expandBtn','click',function(){
  var p=flightPlan();
  if(!p.ok){renderExpand();return}
  st.expanded=true;
  normalize();buildCities();renderOrder();syncDays();renderExpand();render();
});
