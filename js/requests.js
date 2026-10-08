// ================= 自訂資料：刪除、申請收錄到內建資料庫（需管理員核准） =================
var REQMINE=[],REQS={},REQOPEN=false;
function reqCountTxt(){var n=REQMINE.filter(function(x){return x.status==='pending'}).length;return REQMINE.length?'（'+REQMINE.length+(n?'・審核中 '+n:'')+'）':''}
var KIND_TXT={country:'國家',city:'城市',district:'地區',spot:'景點'};
function refOf(id){return (TRIP?TRIP.id:'')+':'+id}
async function loadRequests(){
  REQMINE=[];REQS={};
  try{
    var r=await sb.from('builtin_requests').select('id,kind,ref,payload,status,admin_note,created_at').order('created_at',{ascending:false});
    if(r.error)return;
    REQMINE=r.data||[];
    REQMINE.forEach(function(x){if(!REQS[x.ref])REQS[x.ref]=x});
  }catch(e){}
}
// 目前狀態標籤與按鈕（custom 項目旁邊使用）
function reqUi(ref,kind,attrs){
  var q=REQS[refOf(ref)],h='';
  if(q&&q.status==='pending')return '<span class="reqtag wait">審核中</span>';
  if(q&&q.status==='approved')return '<span class="reqtag ok">已收錄</span>';
  if(q&&q.status==='rejected')h='<span class="reqtag no" title="'+esc(q.admin_note||'')+'">未通過'+(q.admin_note?'：'+esc(q.admin_note):'')+'</span>';
  return h+'<button type="button" class="ghost sm" data-act="req" data-kind="'+kind+'" '+attrs+'>申請收錄</button>';
}
function spotPayload(k,c){
  return {name:c.name,tag:c.tag||'',district:c.d||'',style:c.s||'x',cost:c.cost||0,hours:c.hours||'',stay:(st.stay&&st.stay[c.id])||(c.s==='f'?75:60),url:c.url||'',rating:c.rating||null,
    lat:typeof c.lat==='number'?c.lat:null,lng:typeof c.lng==='number'?c.lng:null,descr:''};
}
// 回傳 {kind,ref,payload} 或 {err}
function buildRequest(kind,k,extra){
  var s=sel[k]||{cs:[],cd:[]};
  if(kind==='spot'){
    if(C[k].custom)return {err:'這個景點屬於自訂城市，請改申請整個城市。'};
    var c=s.cs.filter(function(x){return x.id===extra})[0];if(!c)return {err:'找不到這個景點'};
    var p=spotPayload(k,c);p.city_id=k;
    return {kind:'spot',ref:refOf(c.id),payload:p};
  }
  if(kind==='district'){
    if(C[k].custom)return {err:'這個地區屬於自訂城市，請改申請整個城市。'};
    var spots=s.cs.filter(function(x){return x.d===extra}).map(function(c){return spotPayload(k,c)});
    return {kind:'district',ref:refOf('dist|'+k+'|'+extra),payload:{city_id:k,name:extra,spots:spots}};
  }
  if(kind==='city'){
    var co=C[k].co;
    if(CO[co].custom)return {err:'所屬的國家是自訂的，請先申請收錄國家。'};
    var dn=(s.cd||[]).slice(),ds=dn.map(function(d){return {name:d,spots:s.cs.filter(function(x){return x.d===d}).map(function(c){return spotPayload(k,c)})}});
    var loose=s.cs.filter(function(x){return !x.d}).map(function(c){return spotPayload(k,c)});
    if(loose.length)ds.push({name:'其他',spots:loose});
    return {kind:'city',ref:refOf(k),payload:{country_id:co,name:C[k].n,code:C[k].code||'',hotel:C[k].hotel,food:C[k].food,km:C[k].km||null,districts:ds}};
  }
  if(kind==='country'){
    var o=CO[k];
    return {kind:'country',ref:refOf(k),payload:{name:o.n,flight:o.flight,fh:o.fh,season:o.season,drive:o.drive,tips:o.tips||[],rail:o.rail}};
  }
  return {err:'不支援的類型'};
}
async function submitRequest(kind,k,extra){
  var q=buildRequest(kind,k,extra);
  if(q.err){setSave(q.err);return}
  var r=await sb.from('builtin_requests').insert({kind:q.kind,ref:q.ref,payload:q.payload});
  if(r.error){setSave('送出申請失敗：'+(r.error.code==='23505'?'這個項目已經在審核中':r.error.message));return}
  setSave('已送出「'+KIND_TXT[kind]+'」收錄申請，等待管理員審核。');
  await loadRequests();
}
function purgeSpot(id){
  if(st.lay)Object.keys(st.lay).forEach(function(n){st.lay[n]=st.lay[n].filter(function(x){return x!==id})});
  if(st.fix)delete st.fix[id];
  if(st.stay)delete st.stay[id];
}
// 樹狀清單裡的自訂項目動作（刪除、申請、取消申請）
async function handleCustomAct(b,k,s){
  var act=b.dataset.act;
  if(act==='reqtoggle'){REQOPEN=!REQOPEN;renderPick();return}
  if(act==='req'){
    b.disabled=true;
    await submitRequest(b.dataset.kind,k,b.dataset.id||b.dataset.dn);
    render(true);return;
  }
  if(act==='reqcancel'){
    var d=await sb.from('builtin_requests').delete().eq('id',b.dataset.id);
    if(d.error)setSave('取消失敗：'+d.error.message);else await loadRequests();
    render(true);return;
  }
  // 刪除需要再按一次確認
  if(!b.dataset.sure){
    b.dataset.sure='1';var old=b.textContent;b.textContent='確定刪除？';
    setTimeout(function(){if(b.isConnected){delete b.dataset.sure;b.textContent=old}},4000);
    return;
  }
  if(act==='delcs'){
    var id=b.dataset.id;
    s.cs=s.cs.filter(function(x){return x.id!==id});
    delete s.off[id];purgeSpot(id);
  }else if(act==='delcd'){
    var dn=b.dataset.dn;
    s.cs.filter(function(x){return x.d===dn}).forEach(function(x){delete s.off[x.id];purgeSpot(x.id)});
    s.cs=s.cs.filter(function(x){return x.d!==dn});
    s.cd=s.cd.filter(function(x){return x!==dn});
    s.d=s.d.filter(function(x){return x!==dn});
    if(s.dord)s.dord=s.dord.filter(function(x){return x!==dn});
  }
  render();
}
// 「我的收錄申請」清單（顯示在樹狀清單下方）
function myRequestsHtml(){
  if(!REQOPEN||!REQMINE.length)return REQOPEN&&!REQMINE.length?'<section class="pick"><h3>我的收錄申請<small>目前沒有申請紀錄</small></h3></section>':'';
  return '<section class="pick"><h3>我的收錄申請<small>管理員核准後會加入內建資料庫</small></h3><ul class="reqlist">'+
    REQMINE.slice(0,30).map(function(x){
      var st_=x.status==='pending'?'<span class="reqtag wait">審核中</span>':(x.status==='approved'?'<span class="reqtag ok">已收錄</span>':'<span class="reqtag no">未通過</span>');
      return '<li>'+st_+' '+KIND_TXT[x.kind]+'：<b>'+esc(x.payload&&x.payload.name||'')+'</b>'+(x.admin_note?'<span class="muted">（'+esc(x.admin_note)+'）</span>':'')+
        (x.status==='pending'?' <button type="button" class="ghost sm" data-act="reqcancel" data-id="'+esc(x.id)+'" data-k="'+esc(st.ci[0]||'')+'">取消申請</button>':'')+'</li>';
    }).join('')+'</ul></section>';
}
