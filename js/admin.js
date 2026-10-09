// ================= 管理後台 =================
var AV='plan',ASUB='users',AF={country:'',city:'',district:'',style:'',q:''};
var VIEW_TITLE={plan:'行程規劃',shared:'共享行程'},SUB_TITLE={users:'使用者與權限',data:'內建資料',trips:'所有使用者的行程',requests:'收錄申請'};
function markMenu(){
  [].forEach.call(document.querySelectorAll('#menuPop .mi'),function(b){
    var on_=b.dataset.view===AV&&(AV!=='admin'||b.dataset.sub===ASUB);
    b.classList.toggle('on',on_);
    if(on_)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  $('curView').textContent=AV==='admin'?'管理後台・'+SUB_TITLE[ASUB]:VIEW_TITLE[AV];
}
function showView(v){
  AV=v;
  $('viewPlan').hidden=v!=='plan';$('viewAdmin').hidden=v!=='admin';$('viewShared').hidden=v!=='shared';
  markMenu();
  if(v==='shared')renderSharedList();
  if(v==='admin')renderAdmin();
}
function menuOpen(open){
  $('menuPop').hidden=!open;
  $('menuBtn').setAttribute('aria-expanded',open?'true':'false');
}
on('menuBtn','click',function(e){e.stopPropagation();menuOpen($('menuPop').hidden)});
document.addEventListener('click',function(e){if(!$('menuPop').hidden&&!e.target.closest('.menuwrap'))menuOpen(false)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('menuPop').hidden){menuOpen(false);$('menuBtn').focus()}});
onSel('.topbar','click',async function(e){
  var b=e.target.closest('#menuPop button[data-view]');if(!b)return;
  menuOpen(false);
  if(b.dataset.view==='plan'&&AV==='admin'){
    // 管理員可能改過內建資料，回到規劃頁時重新載入
    try{await flush();await loadBuiltin();openTrip(TRIP)}catch(err){}
  }
  if(b.dataset.sub)ASUB=b.dataset.sub;
  showView(b.dataset.view);
});
function aMsg(t,err){setMsg($('adminMsg'),t,err)}
async function renderAdmin(){
  aMsg('');
  var body=$('adminBody');body.innerHTML='<p class="muted">載入中…</p>';
  try{
    if(ASUB==='users')await adminUsers();
    else if(ASUB==='trips')await adminTrips();
    else if(ASUB==='requests')await adminRequests();
    else adminData();
  }catch(err){body.innerHTML='';aMsg('載入失敗：'+(err.message||err),true)}
}
var fmtDate=function(s){var d=new Date(s);return isNaN(d)?'':d.toLocaleString('zh-TW',{hour12:false})};
async function adminUsers(){
  var r=await sb.from('profiles').select('*').order('created_at',{ascending:true});
  if(r.error)throw r.error;
  var h='<p class="muted">共 '+r.data.length+' 位使用者。管理員可進入後台；停用的帳號無法使用系統。至少要保留一位啟用中的管理員。</p><div class="tblwrap"><table class="t"><thead><tr><th>暱稱</th><th>電子郵件</th><th>角色</th><th>狀態</th><th>註冊時間</th></tr></thead><tbody>';
  r.data.forEach(function(u){
    var me=u.id===ME.id;
    h+='<tr><td>'+esc(u.nickname||emailName(u.email))+'</td><td>'+esc(u.email)+(me?'（你）':'')+'</td><td><select data-uid="'+esc(u.id)+'" data-u="role"'+(me?' disabled':'')+'><option value="user"'+(u.role==='user'?' selected':'')+'>一般使用者</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>管理員</option></select></td>'+
      '<td><select data-uid="'+esc(u.id)+'" data-u="disabled"'+(me?' disabled':'')+'><option value="0"'+(!u.disabled?' selected':'')+'>啟用</option><option value="1"'+(u.disabled?' selected':'')+'>停用</option></select></td><td>'+esc(fmtDate(u.created_at))+'</td></tr>';
  });
  $('adminBody').innerHTML=h+'</tbody></table></div>';
}
async function adminTrips(){
  var r=await sb.from('trips').select('id,name,data,updated_at,user_id,profiles(email,nickname)').order('updated_at',{ascending:false});
  if(r.error)throw r.error;
  var h='<p class="muted">共 '+r.data.length+' 份行程。</p><div class="tblwrap"><table class="t"><thead><tr><th>使用者</th><th>行程名稱</th><th>天數</th><th>城市</th><th>更新時間</th><th></th></tr></thead><tbody>';
  r.data.forEach(function(t){
    var d=t.data||{},s=d.st||{},cx=d.cx||{};
    var names=(s.ci||[]).map(function(k){return cx[k]?cx[k].n:(C[k]?C[k].n:k)}).join('、');
    h+='<tr><td>'+esc(t.profiles?(t.profiles.nickname||emailName(t.profiles.email))+'（'+t.profiles.email+'）':'')+'</td><td>'+esc(t.name)+'</td><td>'+esc(s.days||'')+'</td><td>'+esc(names)+'</td><td>'+esc(fmtDate(t.updated_at))+'</td><td><button type="button" class="ghost danger" data-del-trip="'+esc(t.id)+'">刪除</button></td></tr>';
  });
  $('adminBody').innerHTML=h+'</tbody></table></div>';
}
on('adminBody','change',async function(e){
  var el=e.target;
  if(el.dataset.u){
    var patch={};
    if(el.dataset.u==='role')patch.role=el.value;else patch.disabled=el.value==='1';
    var r=await sb.from('profiles').update(patch).eq('id',el.dataset.uid);
    if(r.error){aMsg('更新失敗：'+r.error.message,true);renderAdmin()}else aMsg('已更新');
  }else if(el.dataset.af){
    AF[el.dataset.af]=el.value;
    if(el.dataset.af==='country'){AF.city='';AF.district=''}
    if(el.dataset.af==='city')AF.district='';
    adminData();
  }
});
on('adminBody','click',async function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.dataset.delTrip){
    if(!b.dataset.sure){b.dataset.sure='1';b.textContent='再按一次確認';setTimeout(function(){delete b.dataset.sure;b.textContent='刪除'},4000);return}
    var r=await sb.from('trips').delete().eq('id',b.dataset.delTrip);
    if(r.error)aMsg('刪除失敗：'+r.error.message,true);else{aMsg('已刪除');adminTrips()}
  }else if(b.dataset.rowAct)rowAction(b);
});

// 內建資料編輯：以通用表格處理國家、城市、地區、景點
var DSUB='countries';
var DT=['countries','cities','districts','spots','airports','ferries'],DTL={countries:'國家',cities:'城市',districts:'地區',spots:'景點',airports:'機場',ferries:'渡船'};
var DTBL={ferries:'ferry_routes'},DPK={airports:'code'};
var tblOf=function(t){return DTBL[t]||t},pkOf=function(t){return DPK[t]||'id'};
function colsFor(t){
  if(t==='airports')return AIR_COLS;
  var cn=DB.countries.map(function(c){return [c.id,c.name]}),ct=DB.cities.map(function(c){return [c.id,c.name]}),dt=DB.districts.map(function(d){return [d.id,d.name]});
  if(t==='countries')return [['id','代碼','id'],['name','名稱','text'],['flight','機票 NT$','int'],['fh','飛行時間','text'],['drive','自駕提醒','text'],['tips','小提醒（一行一則）','lines'],['rail','鐵路時速','int'],['sort','排序','int']];
  if(t==='cities')return [['id','代碼','id'],['country_id','國家','sel',cn],['name','名稱','text'],['code','機場代碼','text'],['lat','緯度','num'],['lng','經度','num'],['hotel','住宿（節省,適中,舒適）','ints3'],['food','餐飲（節省,適中,舒適）','ints3'],['season','最佳季節說明','text'],['sort','排序','int']];
  if(t==='districts')return [['id','編號','auto'],['city_id','城市','sel',ct],['name','名稱','text'],['lat','緯度','num'],['lng','經度','num'],['sort','排序','int']];
  return [['id','編號','auto'],['district_id','地區','sel',dt],['name','名稱','text'],['style','風格','sel',[['f','美食'],['c','文化'],['n','自然'],['s','購物']]],['tag','子分類','text'],['cost','每人概估費用 NT$（門票／餐費）','int'],['hours','營業時間（一-五 10:00-18:00;六日 10:00-20:00;二休）','text'],['stay','建議停留（分鐘）','int'],['rating','Google 評分','numopt'],['lat','緯度','numopt'],['lng','經度','numopt'],['maps_url','地圖連結（選填）','text'],['descr','說明','text'],['sort','排序','int']];
}
function cellHtml(col,val,rid,isNew){
  var k=col[0],type=col[2],a=' data-c="'+k+'" data-r="'+esc(rid)+'" aria-label="'+esc(col[1])+'"';
  if(type==='auto')return isNew?'<span class="muted">自動</span>':esc(val);
  if(type==='id')return isNew?'<input type="text"'+a+' placeholder="英文代碼">':esc(val);
  if(type==='sel')return '<select'+a+'>'+col[3].map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>';
  if(type==='lines')return '<textarea'+a+'>'+esc((val||[]).join('\n'))+'</textarea>';
  if(type==='csv')return '<input type="text"'+a+' value="'+esc((val||[]).join(','))+'">';
  if(type==='ints3')return '<input type="text"'+a+' value="'+esc((val||[]).join(','))+'">';
  return '<input type="'+(type==='text'?'text':'number')+'"'+(type==='num'||type==='numopt'?' step="any"':'')+a+' value="'+esc(val==null?'':val)+'">';
}
// 目前篩選條件下的資料列
var MATCH_FIELDS={
  countries:['id','name','fh','drive','season'],cities:['id','name','code','season'],districts:['name'],
  spots:['name','tag','descr','hours'],airports:['code','name','hub_name','via'],ferries:['id','name','main_name','isle_name','note']
};
function adminMatch(r,toks,t){
  var hay=(MATCH_FIELDS[t]||['name']).map(function(k){return r[k]||''}).concat(t==='spots'?[STYLE[r.style]||'']:[]).join(' ').toLowerCase(),
    nm=((r.name||'')+(r.tag||'')).toLowerCase();
  return toks.every(function(x){
    if(hay.indexOf(x)>-1)return true;
    if(x.length<2)return false;
    var i=0;                                   // 模糊比對：名稱或子分類的字依序出現（中間可夾別的字）
    for(var j=0;j<nm.length&&i<x.length;j++)if(nm.charAt(j)===x.charAt(i))i++;
    return i===x.length;
  });
}
function adminRows(){
  var t=DSUB,rows=(DB[tblOf(t)]||[]).slice();
  if(t==='cities'&&AF.country)rows=rows.filter(function(r){return r.country_id===AF.country});
  if(t==='districts')rows=rows.filter(function(r){return r.city_id===AF.city});
  if(t==='spots'){
    var dids=DB.districts.filter(function(d){return d.city_id===AF.city&&(AF.district===''||String(d.id)===String(AF.district))}).map(function(d){return d.id});
    rows=rows.filter(function(r){return dids.indexOf(r.district_id)>-1});
    if(AF.style)rows=rows.filter(function(r){return r.style===AF.style});
  }
  var toks=(AF.q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(toks.length)rows=rows.filter(function(r){return adminMatch(r,toks,t)});
  return rows;
}
function recsHtml(){
  var t=DSUB,rows=adminRows();
  if(!rows.length)return '<p class="muted">沒有符合的資料。</p>';
  if(t==='ferries'){
    FERRY_EDIT=rows.map(function(x){return JSON.parse(JSON.stringify(x))});
    return FERRY_EDIT.map(function(f,i){return ferryCard(f,i)}).join('');
  }
  var cols=colsFor(t);
  return rows.map(function(r){return recHtml(cols,r,t,false)}).join('');
}
function fillRecs(){
  var el=$('recs');if(!el)return;
  el.innerHTML=recsHtml();
  var c=$('recCount');if(c)c.textContent='共 '+adminRows().length+' 筆';
}
function adminData(){
  var t=DSUB,filt='',opt=function(v,txt,cur){return '<option value="'+esc(v)+'"'+(String(cur)===String(v)?' selected':'')+'>'+esc(txt)+'</option>'};
  if(t==='cities'){
    filt='<select data-af="country" aria-label="國家篩選"><option value="">全部國家</option>'+DB.countries.map(function(c){return opt(c.id,c.name,AF.country)}).join('')+'</select>';
  }
  if(t==='districts'||t==='spots'){
    if(!DB.cities.some(function(c){return c.id===AF.city}))AF.city=DB.cities.length?DB.cities[0].id:'';
    filt='<select data-af="city" aria-label="城市篩選">'+DB.cities.map(function(c){return opt(c.id,c.name,AF.city)}).join('')+'</select>';
  }
  if(t==='spots'){
    var ds=DB.districts.filter(function(d){return d.city_id===AF.city});
    if(AF.district!==''&&!ds.some(function(d){return String(d.id)===String(AF.district)}))AF.district='';
    filt+='<select data-af="district" aria-label="地區篩選"><option value="">全部地區</option>'+ds.map(function(d){return opt(d.id,d.name,AF.district)}).join('')+'</select>'+
      '<select data-af="style" aria-label="風格篩選"><option value="">全部風格</option>'+Object.keys(STYLE).filter(function(k){return k!=='x'}).map(function(k){return opt(k,STYLE[k],AF.style)}).join('')+'</select>';
  }
  var ph={countries:'搜尋國家：代碼、名稱、說明',cities:'搜尋城市：代碼、名稱、機場代碼',districts:'搜尋地區名稱',spots:'搜尋景點：名稱、子分類、說明、營業時間',airports:'搜尋機場：代碼、名稱、接駁車站、說明',ferries:'搜尋渡船：代碼、航線名稱、碼頭'}[t];
  filt+='<input type="search" class="afq" data-afq="1" value="'+esc(AF.q||'')+'" placeholder="'+ph+'" aria-label="關鍵字查詢" autocomplete="off">';
  var note=t==='airports'?'從機場出發（或前往機場）的路線，會改成「機場 ⇄ 接駁車站」加上「車站 ⇄ 目的地」。這裡填的是機場到車站的單程時間與費用（新台幣）；規劃頁按「更新」時會改查實際班次與票價。「預設城市」是沒填機場代碼時，該城市預設使用的機場。':
    t==='ferries'?'離島範圍以「中心點＋半徑」判斷：景點落在範圍內就視為在島上，往返會自動改成「前往碼頭 → 等下一班船 → 搭船 → 碼頭到景點」，並依行程當天所在月份選用對應季節的班次。每個月份都要剛好有一個季節。':
    '修改後按該筆左邊的儲存圖示。刪除國家、城市或地區會一併刪除底下的內容。';
  var h='<div class="tabs" id="dsubs">'+DT.map(function(x){return '<button type="button" class="tab'+(x===t?' on':'')+'" data-dsub="'+x+'">'+DTL[x]+'</button>'}).join('')+'</div>'+
    '<div class="adminbar" style="margin:12px 0"><button type="button" class="ib addbtn" data-row-act="open" title="新增'+DTL[t]+'" aria-label="新增'+DTL[t]+'">'+AICON.add+'</button>'+filt+
    (t==='spots'?'<button type="button" class="ib" id="updRatings" title="批次更新：向 Google 更新景點的評價、座標與營業時間（每次最多 30 筆，可重複按直到全部更新完）" aria-label="批次更新景點的評價、座標與營業時間">'+AICON.batch+'</button>':'')+
    '<span class="muted" id="recCount"></span></div><p class="muted">'+note+'</p><div class="recs" id="recs"></div>';
  $('adminBody').innerHTML=h;
  fillRecs();
}
// ===== 新增：按「＋」才跳出視窗 =====
var CLOSE_ICON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function openAddModal(){
  var t=DSUB,defaults={},body='',foot='',hint='';
  if(t==='ferries'){
    FERRY_NEW=emptyFerry();
    body=ferryCard(FERRY_NEW,'new');
    foot=iconBtn('add','new','新增',AICON.add).replace('data-row-act="add"','data-fer-act="add"')+iconBtn('cancel','new','取消',CLOSE_ICON);
  }else{
    var cols=colsFor(t).filter(function(c){return c[2]!=='auto'});
    if(t==='cities')defaults.country_id=AF.country||(DB.countries[0]&&DB.countries[0].id);
    if(t==='districts')defaults.city_id=AF.city;
    if(t==='airports')defaults.mode='train';
    if(t==='spots'){
      var ds=DB.districts.filter(function(d){return d.city_id===AF.city});
      defaults.district_id=AF.district!==''?AF.district:(ds[0]?String(ds[0].id):'');
      // 景點：Google 地圖連結放最上面，貼上後自動帶入其他欄位
      cols=cols.filter(function(c){return c[0]==='maps_url'}).concat(cols.filter(function(c){return c[0]!=='maps_url'}));
      hint='<p class="muted">先貼上 Google 地圖的分享連結，離開欄位後會自動查詢，並帶入名稱、類型、子分類、說明、座標、評分、營業時間、每人費用、建議停留時間與地區。</p>';
    }
    body='<div class="rec new"><div class="recf">'+cols.map(function(c){
      return '<label class="rf'+(WIDE_COLS[c[0]]||c[2]==='lines'?' wide':'')+'"><span>'+esc(c[1])+'</span>'+cellHtml(c,defaults[c[0]],'new',true)+'</label>';
    }).join('')+'</div></div>';
    foot=iconBtn('add','new','新增',AICON.add)+iconBtn('cancel','new','取消',CLOSE_ICON);
  }
  closeAddModal();
  $('adminBody').insertAdjacentHTML('beforeend','<div class="modal-back" id="addModal"><div class="modal" role="dialog" aria-modal="true" aria-label="新增'+DTL[t]+'">'+
    '<div class="modalhead"><b>新增'+DTL[t]+'</b>'+iconBtn('cancel','new','關閉',CLOSE_ICON)+'</div>'+hint+body+'<div class="modalfoot">'+foot+'</div></div></div>');
  var first=document.querySelector('#addModal input,#addModal select');if(first)first.focus();
}
function closeAddModal(){var m=$('addModal');if(m)m.parentNode.removeChild(m)}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('addModal'))closeAddModal()});
document.addEventListener('mousedown',function(e){if(e.target&&e.target.id==='addModal')closeAddModal()});
var afqTimer=null;
on('adminBody','input',function(e){
  if(!e.target.dataset||!e.target.dataset.afq)return;
  AF.q=e.target.value;clearTimeout(afqTimer);afqTimer=setTimeout(fillRecs,150);
});
// 圖示按鈕（左邊的功能列）
var AICON={
  save:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  del:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
  batch:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/><path d="M9 10h6M9 13h6M9 16h4"/></svg>',
  add:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
};
function iconBtn(act,rid,title,svg,cls){return '<button type="button" class="ib'+(cls?' '+cls:'')+'" data-row-act="'+act+'" data-r="'+esc(rid)+'" title="'+esc(title)+'" aria-label="'+esc(title)+'">'+svg+'</button>'}
var WIDE_COLS={descr:1,maps_url:1,hours:1,tips:1,drive:1,season:1,fh:1};
// 一筆資料 = 一張卡片：左邊是圖示功能列，右邊的欄位依視窗寬度自動分成多列；視窗太窄時，圖示在最左邊垂直排列
function recHtml(cols,r,t,isNew){
  var rid=isNew?'new':r[pkOf(t)],acts=isNew?iconBtn('add','new','新增',AICON.add):
    iconBtn('save',rid,'儲存',AICON.save)+(t==='spots'?iconBtn('refresh',rid,'向 Google 更新這一筆的評分、座標與營業時間（若「地圖連結」欄貼了 Google 地圖連結，會以該連結的地點為準）',ICON_REFRESH):'')+iconBtn('del',rid,'刪除',AICON.del,'danger');
  var f=cols.map(function(c){
    if(c[2]==='auto'&&isNew)return '';
    return '<label class="rf'+(WIDE_COLS[c[0]]||c[2]==='lines'?' wide':'')+'"><span>'+esc(c[1])+'</span>'+cellHtml(c,r[c[0]],rid,isNew)+'</label>';
  }).join('');
  return '<div class="rec'+(isNew?' new':'')+'" data-rec="'+esc(rid)+'"><div class="recact">'+acts+'</div><div class="recf">'+f+'</div></div>';
}
document.addEventListener('click',async function(e){
  var ub=e.target.closest('#updRatings');
  if(ub){
    ub.disabled=true;aMsg('更新中，請稍候…');
    try{
      var r=await sb.functions.invoke('update-ratings',{body:{}});
      var d=r.data||{};
      if(r.error)throw new Error(r.error.message||'呼叫失敗');
      if(d.error==='not_configured')aMsg('尚未設定 Google Places 金鑰（GOOGLE_PLACES_KEY）。',true);
      else if(d.error)aMsg(d.error,true);
      else{await loadBuiltin();aMsg('已更新 '+d.updated+' 筆（以 place id 精準查詢 '+(d.viaId||0)+' 筆、名稱搜尋 '+(d.viaSearch||0)+' 筆），找不到對應地點 '+d.missed+' 筆，還有 '+d.remaining+' 筆待處理。');adminData()}
    }catch(err){aMsg('更新失敗：'+(err.message||err),true)}
    return;
  }
  var b=e.target.closest('button[data-dsub]');
  if(b){DSUB=b.dataset.dsub;adminData()}
});
function readRow(t,rid,isNew){
  var cols=colsFor(t),o={};
  var root=isNew?document.querySelector('#adminBody .rec.new'):document.querySelector('#adminBody [data-r="'+(window.CSS&&CSS.escape?CSS.escape(String(rid)):rid)+'"]').closest('.rec');
  for(var i=0;i<cols.length;i++){
    var c=cols[i],el=root.querySelector('[data-c="'+c[0]+'"]');
    if(!el)continue;
    var v=el.value;
    if(c[2]==='int'){var n=parseInt(v,10);o[c[0]]=isNaN(n)?0:n}
    else if(c[2]==='num'){var f=parseFloat(v);if(isNaN(f))throw new Error('「'+c[1]+'」請填數字');o[c[0]]=f}
    else if(c[2]==='numopt'){if(v.trim()==='')o[c[0]]=null;else{var g=parseFloat(v);if(isNaN(g)||(c[0]==='rating'&&(g<0||g>5)))throw new Error('「'+c[1]+'」請填'+(c[0]==='rating'?' 0–5 的':'')+'數字');o[c[0]]=g}}
    else if(c[2]==='lines')o[c[0]]=v.split('\n').map(function(x){return x.trim()}).filter(Boolean);
    else if(c[2]==='csv')o[c[0]]=v.split(/[,，\s]+/).filter(Boolean);
    else if(c[2]==='ints3'){var a=v.split(/[,，\s]+/).filter(Boolean).map(Number);if(a.length!==3||a.some(isNaN))throw new Error('「'+c[1]+'」請填三個數字，用逗號分隔');o[c[0]]=a}
    else if(c[2]==='sel')o[c[0]]=(c[0]==='district_id')?parseInt(v,10):v;
    else o[c[0]]=v.trim();
  }
  if(!o.name)throw new Error('請填名稱');
  if(t==='airports'){
    if(isNew){o.code=(o.code||'').toUpperCase();if(!/^[A-Z]{3}$/.test(o.code))throw new Error('機場代碼請填 3 個英文字母（IATA）')}
    if(!o.hub_name)throw new Error('請填接駁車站');
    if(!(o.minutes>0))throw new Error('單程分鐘必須大於 0');
    if(Math.abs(o.hub_lat)>90||Math.abs(o.hub_lng)>180)throw new Error('車站座標超出範圍');
    (o.default_cities||[]).forEach(function(c){if(!DB.cities.some(function(x){return x.id===c}))throw new Error('預設城市「'+c+'」不是內建城市代碼')});
  }
  if(t==='spots'&&o.hours&&!parseHours(o.hours))throw new Error('「營業時間」格式不正確，請參考：一-五 10:00-18:00;六日 10:00-20:00;二休（每日 24h 表示全天）');
  if((t==='countries'||t==='cities')&&isNew&&!/^[a-z0-9_]{2,12}$/.test(o.id||''))throw new Error('代碼請用 2–12 個小寫英文字母或數字');
  if(o.lat!=null&&(o.lat<-90||o.lat>90||o.lng<-180||o.lng>180))throw new Error('座標超出範圍');
  return o;
}
async function rowAction(b){
  var t=DSUB,a=b.dataset.rowAct,rid=b.dataset.r;
  try{
    if(a==='open'){openAddModal();return}
    if(a==='cancel'){closeAddModal();return}
    if(a==='refresh'){
      // 單筆更新：向 Google 查這一筆的評分、座標與營業時間。「地圖連結」欄若貼了 Google 地圖連結，以該連結的地點為準
      b.disabled=true;aMsg('更新中…');
      var mu=document.querySelector('#adminBody [data-c="maps_url"][data-r="'+(window.CSS&&CSS.escape?CSS.escape(String(rid)):rid)+'"]'),mv=mu?mu.value.trim():'';
      var rr=await sb.functions.invoke('update-ratings',{body:{id:parseInt(rid,10),url:/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(mv)&&mv.indexOf('/maps/search/?api=1')<0?mv:''}});
      var dd=rr.data||{};
      b.disabled=false;
      if(rr.error)throw new Error(rr.error.message||'呼叫失敗');
      if(dd.error==='not_configured')throw new Error('尚未設定 Google Places 金鑰（GOOGLE_PLACES_KEY）');
      if(dd.error)throw new Error(dd.error);
      await loadBuiltin();
      if(dd.missed)aMsg('「'+dd.name+'」在 Google 找不到對應的地點。可以在「地圖連結」欄貼上該地點的 Google 地圖分享連結後再按「更新」。',true);
      else aMsg('已更新「'+dd.name+'」（比對到：'+dd.matched+'，方式：'+dd.via+'）：評分 '+(dd.rating==null?'無':dd.rating)+'，座標 '+(dd.lat==null?'未取得':dd.lat.toFixed(5)+', '+dd.lng.toFixed(5))+'，營業時間 '+(dd.hours||'Google 沒有提供（維持原內容）'));
      adminData();return;
    }
    if(a==='del'){
      if(!b.dataset.sure){b.dataset.sure='1';b.classList.add('armed');b.title='再按一次確認刪除';aMsg('再按一次刪除圖示，確認刪除。',true);setTimeout(function(){delete b.dataset.sure;b.classList.remove('armed');b.title='刪除'},4000);return}
      var d=await sb.from(tblOf(t)).delete().eq(pkOf(t),rid);if(d.error)throw d.error;
    }else{
      var o=readRow(t,rid,a==='add');
      if(a==='add'){
        // 用 Google 地圖連結自動帶入時，一併記下 place id，之後的批次或單筆更新就不會配對錯店
        var root=document.querySelector('#adminBody .rec.new');
        if(t==='spots'&&root&&root.dataset.pid){o.place_id=root.dataset.pid;o.rated_at=o.hours_at=new Date().toISOString()}
        var i=await sb.from(tblOf(t)).insert(o);if(i.error)throw i.error}
      else{delete o[pkOf(t)];var u=await sb.from(tblOf(t)).update(o).eq(pkOf(t),rid);if(u.error)throw u.error}
    }
    await loadBuiltin();aMsg('已儲存');adminData();
  }catch(err){aMsg('操作失敗：'+(err.message||err),true)}
}


// ===== 收錄申請審核 =====
function reqSummary(x){
  var p=x.payload||{},t='';
  if(x.kind==='spot')t='城市代碼 '+p.city_id+'・地區「'+(p.district||'（未指定）')+'」・類型 '+(STYLE[p.style]||p.style)+'・費用 '+(p.cost||0)+'・停留 '+(p.stay||60)+' 分'+(p.url?'・'+p.url:'');
  else if(x.kind==='district')t='城市代碼 '+p.city_id+'・含 '+((p.spots||[]).length)+' 個景點：'+(p.spots||[]).map(function(s){return s.name}).join('、');
  else if(x.kind==='city')t='所屬國家代碼 '+p.country_id+'・地區 '+((p.districts||[]).length)+' 個：'+(p.districts||[]).map(function(d){return d.name+'('+(d.spots||[]).length+')'}).join('、');
  else t='機票 '+(p.flight||'')+'・飛行 '+(p.fh||'')+'・最佳季節 '+(p.season||'');
  return t;
}
function reqControls(x){
  var id=esc(x.id),p=x.payload||{},h='';
  if(x.kind==='country')h+='<input type="text" data-ov="id" maxlength="12" placeholder="國家代碼（小寫英文，如 vn）" aria-label="國家代碼">';
  if(x.kind==='city')h+='<input type="text" data-ov="id" maxlength="12" placeholder="城市代碼（如 okw）" aria-label="城市代碼"><input type="text" data-ov="code" maxlength="6" placeholder="機場代碼（選填）" aria-label="機場代碼"><input type="number" step="any" data-ov="lat" placeholder="緯度" aria-label="緯度"><input type="number" step="any" data-ov="lng" placeholder="經度" aria-label="經度">';
  if(x.kind==='district')h+='<input type="number" step="any" data-ov="lat" placeholder="地區緯度（選填）" aria-label="緯度"><input type="number" step="any" data-ov="lng" placeholder="地區經度（選填）" aria-label="經度">';
  if(x.kind==='spot')h+='<select data-ov="style" aria-label="景點類型"><option value="">類型…</option>'+['f','c','n','s'].map(function(s){return '<option value="'+s+'"'+(p.style===s?' selected':'')+'>'+STYLE[s]+'</option>'}).join('')+'</select><input type="text" data-ov="descr" maxlength="80" placeholder="簡短說明（選填）" aria-label="說明">';
  return h+'<input type="text" data-note maxlength="100" placeholder="退回原因（退回時填）" aria-label="退回原因"><button type="button" data-req-ok="'+id+'">核准並收錄</button><button type="button" class="ghost danger" data-req-no="'+id+'">退回</button>';
}
async function adminRequests(){
  var r=await sb.from('builtin_requests').select('*,profiles(email,nickname)').order('created_at',{ascending:false}).limit(200);
  if(r.error)throw r.error;
  var pend=r.data.filter(function(x){return x.status==='pending'}),done=r.data.filter(function(x){return x.status!=='pending'}).slice(0,30);
  var who=function(x){return x.profiles?(x.profiles.nickname||emailName(x.profiles.email))+'（'+x.profiles.email+'）':''};
  var h='<p class="muted">待審核 '+pend.length+' 件。核准後會直接寫入內建資料庫，所有使用者都看得到；國家與城市需要填代碼，城市還要填經緯度。</p>';
  if(!pend.length)h+='<p class="muted">目前沒有待審核的申請。</p>';
  pend.forEach(function(x){
    h+='<div class="reqcard" data-rid="'+esc(x.id)+'"><b>'+KIND_TXT[x.kind]+'：'+esc((x.payload&&x.payload.name)||'')+'</b> <span class="muted">申請人 '+esc(who(x))+'・'+esc(fmtDate(x.created_at))+'</span><pre>'+esc(reqSummary(x))+'</pre><div class="row">'+reqControls(x)+'</div></div>';
  });
  if(done.length)h+='<h3>最近處理過的申請</h3><div class="tblwrap"><table class="t"><thead><tr><th>類型</th><th>名稱</th><th>申請人</th><th>結果</th><th>說明</th><th>時間</th></tr></thead><tbody>'+
    done.map(function(x){return '<tr><td>'+KIND_TXT[x.kind]+'</td><td>'+esc((x.payload&&x.payload.name)||'')+'</td><td>'+esc(who(x))+'</td><td>'+(x.status==='approved'?'已核准':'已退回')+'</td><td>'+esc(x.admin_note||'')+'</td><td>'+esc(fmtDate(x.decided_at))+'</td></tr>'}).join('')+'</tbody></table></div>';
  $('adminBody').innerHTML=h;
}
on('adminBody','click',async function(e){
  var ok=e.target.closest('button[data-req-ok]'),no=e.target.closest('button[data-req-no]');
  if(!ok&&!no)return;
  var card=e.target.closest('.reqcard'),id=card.dataset.rid,btn=ok||no;
  var ov={};
  [].forEach.call(card.querySelectorAll('[data-ov]'),function(el){
    var v=el.value.trim();if(v==='')return;
    ov[el.dataset.ov]=(el.type==='number')?parseFloat(v):v;
  });
  btn.disabled=true;
  try{
    if(ok){
      var r=await sb.rpc('approve_builtin_request',{p_id:id,p_ov:ov});
      if(r.error)throw r.error;
      await loadBuiltin();
      aMsg(r.data||'已核准');
    }else{
      var note=card.querySelector('[data-note]').value.trim();
      var r2=await sb.rpc('reject_builtin_request',{p_id:id,p_note:note});
      if(r2.error)throw r2.error;
      aMsg('已退回');
    }
    await adminRequests();
  }catch(err){aMsg('操作失敗：'+(err.message||err),true);btn.disabled=false}
});

// ===== 內建資料新增景點：貼上 Google 地圖連結後，自動查詢並填入完整資料 =====
// 名稱、類型、子分類、說明、座標、評分、營業時間、每人概估費用、建議停留時間與最接近的地區
on('adminBody','change',async function(e){
  var el=e.target;
  if(ASUB!=='data'||DSUB!=='spots'||!el.dataset||el.dataset.c!=='maps_url'||el.dataset.r!=='new')return;
  var url=el.value.trim(),root=el.closest('.rec');
  if(!url||!root)return;
  if(!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(url)){aMsg('請貼上 Google 地圖的分享連結。',true);return}
  aMsg('正在向 Google 查詢景點資訊…');
  try{
    var r=await sb.functions.invoke('trip-tools',{body:{action:'place',url:url}});
    var info=r.data&&!r.data.error?r.data:null;
    if(!info||!info.name){aMsg('讀取連結失敗，請確認連結，或手動輸入。',true);return}
    var sp=placeToSpot(info,AF.city,[]);
    var put=function(c,v){var x=root.querySelector('[data-c="'+c+'"]');if(x)x.value=(v==null?'':v)};
    put('name',sp.name.slice(0,60));
    if(sp.s!=='x')put('style',sp.s);
    put('tag',sp.tag);put('cost',sp.cost>0?sp.cost:0);put('stay',sp.stay);
    put('rating',sp.rating);put('hours',sp.hours);
    put('descr',(info.summary||'').slice(0,80));
    if(sp.lat!=null){put('lat',sp.lat);put('lng',sp.lng)}
    // 最接近的地區（同一個城市、30 公里內）
    var best='',bd=30;
    if(sp.lat!=null)DB.districts.filter(function(d){return d.city_id===AF.city&&typeof d.lat==='number'}).forEach(function(d){var k=hav([sp.lat,sp.lng],[d.lat,d.lng]);if(k<bd){bd=k;best=d.id}});
    if(best!==''){put('district_id',best);AF.district=String(best)}
    root.dataset.pid=info.placeId||'';
    var got=['名稱'];
    if(sp.s!=='x')got.push('類型「'+STYLE[sp.s]+'」'+(sp.tag?'・'+sp.tag:''));
    if(best!=='')got.push('地區「'+(DB.districts.filter(function(d){return d.id===best})[0]||{}).name+'」');
    if(sp.lat!=null)got.push('座標');
    if(sp.rating)got.push('評分 ★'+sp.rating);
    if(sp.hours)got.push('營業時間');
    if(info.summary)got.push('說明');
    if(sp.cost>0)got.push('每人約 NT$ '+sp.cost+'（估計）');
    got.push('建議停留 '+sp.stay+' 分');
    var miss=[];
    if(sp.s==='x')miss.push('類型');
    if(!sp.hours)miss.push('營業時間');
    if(!(sp.cost>0))miss.push('每人費用（門票或餐費）');
    if(!info.summary)miss.push('說明');
    aMsg('已自動帶入：'+got.join('、')+'。'+(miss.length?'Google 沒有提供：'+miss.join('、')+'，可自行補填。':'')+'確認後按左邊的「＋」新增。');
  }catch(err){aMsg('查詢失敗：'+(err.message||err),true)}
});
