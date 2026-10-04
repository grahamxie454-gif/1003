// ================= 管理後台 =================
var AV='plan',ASUB='users',AF={country:'',city:'',district:''};
function showView(v){
  AV=v;
  document.querySelectorAll('[data-view]').forEach(function(b){b.classList.toggle('on',b.dataset.view===v)});
  $('viewPlan').hidden=v!=='plan';$('viewAdmin').hidden=v!=='admin';$('viewShared').hidden=v!=='shared';
  if(v==='shared')renderSharedList();
  if(v==='admin')renderAdmin();
}
onSel('.topbar','click',async function(e){
  var b=e.target.closest('button[data-view]');if(!b)return;
  if(b.dataset.view==='plan'&&AV==='admin'){
    // 管理員可能改過內建資料，回到規劃頁時重新載入
    try{await flush();await loadBuiltin();openTrip(TRIP)}catch(err){}
  }
  showView(b.dataset.view);
});
on('adminTabs','click',function(e){
  var b=e.target.closest('button[data-sub]');if(!b)return;
  ASUB=b.dataset.sub;
  document.querySelectorAll('[data-sub]').forEach(function(x){x.classList.toggle('on',x===b)});
  renderAdmin();
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
var DT=['countries','cities','districts','spots'],DTL={countries:'國家',cities:'城市',districts:'地區',spots:'景點'};
var DSUB='countries';
function colsFor(t){
  var cn=DB.countries.map(function(c){return [c.id,c.name]}),ct=DB.cities.map(function(c){return [c.id,c.name]}),dt=DB.districts.map(function(d){return [d.id,d.name]});
  if(t==='countries')return [['id','代碼','id'],['name','名稱','text'],['flight','機票 NT$','int'],['fh','飛行時間','text'],['season','最佳季節','text'],['drive','自駕提醒','text'],['tips','小提醒（一行一則）','lines'],['rail','鐵路時速','int'],['sort','排序','int']];
  if(t==='cities')return [['id','代碼','id'],['country_id','國家','sel',cn],['name','名稱','text'],['code','機場代碼','text'],['lat','緯度','num'],['lng','經度','num'],['hotel','住宿（節省,適中,舒適）','ints3'],['food','餐飲（節省,適中,舒適）','ints3'],['sort','排序','int']];
  if(t==='districts')return [['id','編號','auto'],['city_id','城市','sel',ct],['name','名稱','text'],['lat','緯度','num'],['lng','經度','num'],['sort','排序','int']];
  return [['id','編號','auto'],['district_id','地區','sel',dt],['name','名稱','text'],['style','風格','sel',[['f','美食'],['c','文化'],['n','自然'],['s','購物']]],['cost','費用 NT$','int'],['stay','建議停留（分鐘）','int'],['rating','Google 評分','numopt'],['maps_url','地圖連結（選填）','text'],['descr','說明','text'],['sort','排序','int']];
}
function cellHtml(col,val,rid,isNew){
  var k=col[0],type=col[2],a=' data-c="'+k+'" data-r="'+esc(rid)+'" aria-label="'+esc(col[1])+'"';
  if(type==='auto')return isNew?'<span class="muted">自動</span>':esc(val);
  if(type==='id')return isNew?'<input type="text"'+a+' placeholder="英文代碼">':esc(val);
  if(type==='sel')return '<select'+a+'>'+col[3].map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>';
  if(type==='lines')return '<textarea'+a+'>'+esc((val||[]).join('\n'))+'</textarea>';
  if(type==='ints3')return '<input type="text"'+a+' value="'+esc((val||[]).join(','))+'">';
  return '<input type="'+(type==='text'?'text':'number')+'"'+(type==='num'||type==='numopt'?' step="any"':'')+a+' value="'+esc(val==null?'':val)+'">';
}
function adminData(){
  var t=DSUB,cols=colsFor(t),rows=DB[t].slice();
  var filt='';
  if(t==='cities'){
    filt='<select data-af="country" aria-label="國家篩選"><option value="">全部國家</option>'+DB.countries.map(function(c){return '<option value="'+esc(c.id)+'"'+(AF.country===c.id?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')+'</select>';
    if(AF.country)rows=rows.filter(function(r){return r.country_id===AF.country});
  }
  if(t==='districts'||t==='spots'){
    if(!DB.cities.some(function(c){return c.id===AF.city}))AF.city=DB.cities.length?DB.cities[0].id:'';
    filt='<select data-af="city" aria-label="城市篩選">'+DB.cities.map(function(c){return '<option value="'+esc(c.id)+'"'+(AF.city===c.id?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')+'</select>';
    rows=t==='districts'?rows.filter(function(r){return r.city_id===AF.city}):rows;
  }
  if(t==='spots'){
    var ds=DB.districts.filter(function(d){return d.city_id===AF.city});
    if(!ds.some(function(d){return String(d.id)===String(AF.district)}))AF.district=ds.length?String(ds[0].id):'';
    filt='<select data-af="city" aria-label="城市篩選">'+DB.cities.map(function(c){return '<option value="'+esc(c.id)+'"'+(AF.city===c.id?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')+'</select>'+
      '<select data-af="district" aria-label="地區篩選">'+ds.map(function(d){return '<option value="'+d.id+'"'+(String(AF.district)===String(d.id)?' selected':'')+'>'+esc(d.name)+'</option>'}).join('')+'</select>';
    rows=rows.filter(function(r){return String(r.district_id)===String(AF.district)});
  }
  var h='<div class="tabs" id="dsubs">'+DT.map(function(x){return '<button type="button" class="tab'+(x===t?' on':'')+'" data-dsub="'+x+'">'+DTL[x]+'</button>'}).join('')+'</div>'+
    '<div class="adminbar" style="margin:12px 0">'+filt+(t==='spots'?'<button type="button" class="ghost" id="updRatings">更新 Google 評價（每次最多 30 筆）</button>':'')+'<span class="muted">修改後按該列的「儲存」。刪除國家、城市或地區會一併刪除底下的內容。</span></div>'+
    '<div class="tblwrap"><table class="t"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c[1])+'</th>'}).join('')+'<th></th></tr></thead><tbody>';
  // 新增列
  var defaults={};
  if(t==='cities'){defaults.country_id=AF.country||(DB.countries[0]&&DB.countries[0].id)}
  if(t==='districts')defaults.city_id=AF.city;
  if(t==='spots')defaults.district_id=AF.district;
  h+='<tr class="new">'+cols.map(function(c){return '<td>'+cellHtml(c,defaults[c[0]],'new',true)+'</td>'}).join('')+'<td class="cell-actions"><button type="button" data-row-act="add">新增</button></td></tr>';
  rows.forEach(function(r){
    h+='<tr>'+cols.map(function(c){return '<td>'+cellHtml(c,r[c[0]],r.id,false)+'</td>'}).join('')+'<td class="cell-actions"><button type="button" data-row-act="save" data-r="'+esc(r.id)+'">儲存</button><button type="button" class="ghost danger" data-row-act="del" data-r="'+esc(r.id)+'">刪除</button></td></tr>';
  });
  $('adminBody').innerHTML=h+'</tbody></table></div>';
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
      else{await loadBuiltin();aMsg('已更新 '+d.updated+' 筆，找不到對應地點 '+d.missed+' 筆，還有 '+d.remaining+' 筆待更新（距上次更新超過 30 天者）。');adminData()}
    }catch(err){aMsg('更新失敗：'+(err.message||err),true)}
    return;
  }
  var b=e.target.closest('button[data-dsub]');
  if(b){DSUB=b.dataset.dsub;adminData()}
});
function readRow(t,rid,isNew){
  var cols=colsFor(t),o={};
  var root=isNew?document.querySelector('#adminBody tr.new'):document.querySelector('#adminBody [data-r="'+(window.CSS&&CSS.escape?CSS.escape(String(rid)):rid)+'"]').closest('tr');
  for(var i=0;i<cols.length;i++){
    var c=cols[i],el=root.querySelector('[data-c="'+c[0]+'"]');
    if(!el)continue;
    var v=el.value;
    if(c[2]==='int'){var n=parseInt(v,10);o[c[0]]=isNaN(n)?0:n}
    else if(c[2]==='num'){var f=parseFloat(v);if(isNaN(f))throw new Error('「'+c[1]+'」請填數字');o[c[0]]=f}
    else if(c[2]==='numopt'){if(v.trim()==='')o[c[0]]=null;else{var g=parseFloat(v);if(isNaN(g)||g<0||g>5)throw new Error('「'+c[1]+'」請填 0–5 的數字');o[c[0]]=g}}
    else if(c[2]==='lines')o[c[0]]=v.split('\n').map(function(x){return x.trim()}).filter(Boolean);
    else if(c[2]==='ints3'){var a=v.split(/[,，\s]+/).filter(Boolean).map(Number);if(a.length!==3||a.some(isNaN))throw new Error('「'+c[1]+'」請填三個數字，用逗號分隔');o[c[0]]=a}
    else if(c[2]==='sel')o[c[0]]=(c[0]==='district_id')?parseInt(v,10):v;
    else o[c[0]]=v.trim();
  }
  if(!o.name)throw new Error('請填名稱');
  if((t==='countries'||t==='cities')&&isNew&&!/^[a-z0-9_]{2,12}$/.test(o.id||''))throw new Error('代碼請用 2–12 個小寫英文字母或數字');
  if(o.lat!=null&&(o.lat<-90||o.lat>90||o.lng<-180||o.lng>180))throw new Error('座標超出範圍');
  return o;
}
async function rowAction(b){
  var t=DSUB,a=b.dataset.rowAct,rid=b.dataset.r;
  try{
    if(a==='del'){
      if(!b.dataset.sure){b.dataset.sure='1';b.textContent='確定刪除？';setTimeout(function(){delete b.dataset.sure;b.textContent='刪除'},4000);return}
      var d=await sb.from(t).delete().eq('id',rid);if(d.error)throw d.error;
    }else{
      var o=readRow(t,rid,a==='add');
      if(a==='add'){var i=await sb.from(t).insert(o);if(i.error)throw i.error}
      else{delete o.id;var u=await sb.from(t).update(o).eq('id',rid);if(u.error)throw u.error}
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
