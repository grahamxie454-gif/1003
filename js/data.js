var SAVE_BLOCK=false;
// ================= 資料庫 =================
async function loadBuiltin(){
  var r=await Promise.all(['countries','cities','districts','spots'].map(function(t){return sb.from(t).select('*').order('sort',{ascending:true}).order('id',{ascending:true})}));
  for(var i=0;i<r.length;i++)if(r[i].error)throw r[i].error;
  DB={countries:r[0].data,cities:r[1].data,districts:r[2].data,spots:r[3].data};
}
function buildBuiltin(){
  CO={};C={};
  DB.countries.forEach(function(c){CO[c.id]={n:c.name,flight:c.flight,fh:c.fh,season:c.season,drive:c.drive,tips:c.tips||[],rail:c.rail}});
  DB.cities.forEach(function(c){if(CO[c.country_id])C[c.id]={n:c.name,co:c.country_id,code:c.code,lat:c.lat,lng:c.lng,hotel:c.hotel,food:c.food,season:c.season||'請自行查詢',d:{},pos:{}}});
  var dm={};
  DB.districts.forEach(function(d){if(C[d.city_id]){C[d.city_id].d[d.name]=[];C[d.city_id].pos[d.name]=[d.lat,d.lng];dm[d.id]=[d.city_id,d.name]}});
  DB.spots.forEach(function(s){var p=dm[s.district_id];if(p)C[p[0]].d[p[1]].push([s.name,s.style,s.cost,s.descr,s.id,s.rating==null?null:+s.rating,s.maps_url||'',s.stay||0,s.lat==null?null:+s.lat,s.lng==null?null:+s.lng,s.tag||''])});
}
function packTrip(){
  var cc={},cx={};
  Object.keys(CO).forEach(function(k){if(CO[k].custom)cc[k]=CO[k]});
  Object.keys(C).forEach(function(k){if(C[k].custom)cx[k]=C[k]});
  return {st:st,sel:sel,uid:uid,cuid:cuid,days:DAYS,cc:cc,cx:cx};
}
function openTrip(row){
  SAVE_BLOCK=false;
  TRIP=row;
  var d=row.data||{},s=d.st||{};
  buildBuiltin();
  Object.keys(d.cc||{}).forEach(function(k){CO[k]=d.cc[k]});
  Object.keys(d.cx||{}).forEach(function(k){C[k]=d.cx[k]});
  st=DEF();
  st.co=(s.co||st.co).filter(function(k){return CO[k]});
  st.ci=(s.ci||st.ci).filter(function(k){return C[k]});
  if(s.days>=2&&s.days<=14)st.days=s.days;
  if(s.stay&&typeof s.stay==='object')st.stay=s.stay;
  if(Array.isArray(s.styles))st.styles=s.styles.filter(function(k){return 'fcns'.indexOf(k)>-1});
  if(Array.isArray(s.modes))st.modes=s.modes.filter(function(k){return MODES[k]});
  if(s.tier>=0&&s.tier<=2)st.tier=s.tier;
  if(s.pace==='full'||s.pace==='relax')st.pace=s.pace;
  st.auto=false;
  if(s.lay&&typeof s.lay==='object')st.lay=s.lay;
  if(s.fix&&typeof s.fix==='object')st.fix=s.fix;
  if(s.checkin==='direct')st.checkin='direct';
  if(s.fixSeq&&typeof s.fixSeq==='object')st.fixSeq=s.fixSeq;
  sel=d.sel||{};uid=d.uid||0;cuid=d.cuid||0;DAYS=d.days||{};OPEN={};
  ['out','ret'].forEach(function(k){st.fl[k]=Object.assign({},s.fl&&s.fl[k])});
  st.fl.mid=(s.fl&&Array.isArray(s.fl.mid)?s.fl.mid:[]).map(function(m){return Object.assign({},m)});
  // 舊版每日航班 → 去程／回程
  var d1=DAYS[1]&&DAYS[1].flights,dN=DAYS[st.days]&&DAYS[st.days].flights;
  var oa=(d1||[]).filter(function(f){return f.kind==='arrive'})[0],rd=(dN||[]).filter(function(f){return f.kind==='depart'})[0];
  if(oa&&!st.fl.out.arr)st.fl.out={no:oa.no,from:oa.from,to:oa.to,arr:oa.time};
  if(rd&&!st.fl.ret.dep)st.fl.ret={no:rd.no,from:rd.from,to:rd.to,dep:rd.time};
  Object.keys(DAYS).forEach(function(n){if(DAYS[n])delete DAYS[n].flights});
  $('tripName').value=row.name;
  rebuildAll(true);
  if(typeof refreshLegacyHotels==='function')refreshLegacyHotels();
  if(TRIP.share_enabled&&(!TRIP.share_data||TRIP.share_data.v!==4))save();
}
function buildTripSel(){
  $('tripSel').innerHTML=TRIPS.map(function(t){return '<option value="'+esc(t.id)+'"'+(TRIP&&t.id===TRIP.id?' selected':'')+'>'+esc(t.name)+'</option>'}).join('');
}
function setSave(t){$('saveSt').textContent=t}
function save(){
  if(!TRIP)return;
  dirty=true;setSave('儲存中…');
  clearTimeout(saveTimer);saveTimer=setTimeout(doSave,700);
}
// 儲存一律排隊執行：前一次還沒完成時，下一次會等它完成再送出（避免用舊的更新時間造成誤判衝突）
var saveChain=Promise.resolve();
function doSave(){saveChain=saveChain.then(doSaveNow,doSaveNow);return saveChain}
async function doSaveNow(){
  if(!TRIP||!dirty||SAVE_BLOCK)return;
  dirty=false;clearTimeout(saveTimer);
  var data=packTrip(),id=TRIP.id;
  var upd={data:data,updated_at:new Date().toISOString()};
  if(TRIP.share_enabled&&typeof buildSnapshot==='function'){upd.share_data=buildSnapshot(plan());upd.share_updated_at=upd.updated_at}
  // 樂觀鎖：若行程在別處被更新（例如管理員核准收錄後已替你換成內建資料），就不要覆蓋
  var r=await sb.from('trips').update(upd).eq('id',id).eq('updated_at',TRIP.updated_at).select('id');
  if(!r.error&&(!r.data||!r.data.length)){
    SAVE_BLOCK=true;
    setSave('這份行程已在別處更新（例如管理員核准了你的收錄申請），請重新整理頁面後再編輯，避免覆蓋。');
    return;
  }
  if(TRIP&&TRIP.id===id){TRIP.data=data;if(!r.error)TRIP.updated_at=upd.updated_at}
  setSave(r.error?'儲存失敗：'+r.error.message:'已儲存');
}
async function flush(){if(dirty)await doSave()}
async function loadTrips(){
  var r=await sb.from('trips').select('*').eq('user_id',ME.id).order('updated_at',{ascending:false});
  if(r.error)throw r.error;
  TRIPS=r.data;
  if(!TRIPS.length){
    var n=await sb.from('trips').insert({user_id:ME.id,name:'我的行程',data:{}}).select().single();
    if(n.error)throw n.error;
    TRIPS=[n.data];
  }
}
onSel('.tripbar','click',async function(e){
  var b=e.target.closest('button[data-trip]');if(!b)return;
  var a=b.dataset.trip,name=$('tripName').value.trim();
  try{
    await flush();
    if(a==='new'){
      var r=await sb.from('trips').insert({user_id:ME.id,name:name||'行程 '+(TRIPS.length+1),data:{}}).select().single();
      if(r.error)throw r.error;
      TRIPS.unshift(r.data);buildTripSel();openTrip(r.data);
    }else if(a==='rename'){
      if(!name)return;
      var u=await sb.from('trips').update({name:name}).eq('id',TRIP.id);
      if(u.error)throw u.error;
      TRIP.name=name;buildTripSel();setSave('已重新命名');
    }else if(a==='del'){
      if(TRIPS.length<2){setSave('至少要保留一份行程。');return}
      if(!b.dataset.sure){b.dataset.sure='1';b.textContent='再按一次確認刪除';setTimeout(function(){delete b.dataset.sure;b.textContent='刪除'},4000);return}
      var d=await sb.from('trips').delete().eq('id',TRIP.id);
      if(d.error)throw d.error;
      TRIPS=TRIPS.filter(function(t){return t.id!==TRIP.id});
      delete b.dataset.sure;b.textContent='刪除';buildTripSel();openTrip(TRIPS[0]);
    }
  }catch(err){setSave('操作失敗：'+err.message)}
});
on('tripSel','change',async function(){
  await flush();
  var t=TRIPS.filter(function(x){return x.id===$('tripSel').value})[0];
  if(t)openTrip(t);
});

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  try{
    var step='讀取帳號資料';
    var pr=await sb.from('profiles').select('*').eq('id',user.id);
    if(pr.error)throw pr.error;
    if(!pr.data||pr.data.length!==1)throw new Error('找不到帳號資料（登入狀態可能尚未生效，請重新整理頁面後再登入）');
    var p={data:pr.data[0]};
    if(p.data.disabled){await sb.auth.signOut();showAuth('這個帳號已被停用，請聯絡管理員。');return}
    ME=p.data;
    step='讀取行程與景點資料';
    await Promise.all([loadBuiltin(),loadTrips(),loadRoutes()]);
    await loadRequests();
    showWho();$('whoRole').textContent=ME.role==='admin'?'管理員':'一般使用者';
    $('adminTab').hidden=ME.role!=='admin';
    $('boot').hidden=true;$('app').hidden=false;
    step='顯示行程';
    showView('plan');
    buildTripSel();openTrip(TRIPS[0]);
  }catch(err){
    $('boot').hidden=true;$('auth').hidden=false;setMsg($('authMsg'),'載入失敗（'+(typeof step==='string'?step:'登入後')+'）：'+(err.message||err),true);
  }
}

