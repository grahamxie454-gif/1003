// ================= 管理後台：機場與離島渡船 =================
// 資料表 airports（機場與接駁車站）、ferry_routes（離島渡船與季節班次）。儲存後規劃頁會立刻使用新資料。
var AIR_COLS=[
  ['code','代碼','id'],['name','機場名稱','text'],['lat','航廈緯度','num'],['lng','航廈經度','num'],
  ['hub_name','接駁車站','text'],['hub_lat','車站緯度','num'],['hub_lng','車站經度','num'],
  ['mode','方式','sel',[['train','火車'],['metro','地鐵'],['bus','巴士／叫車']]],['via','搭乘說明','text'],
  ['minutes','單程分鐘','int'],['fare_twd','費用 NT$','int'],['km','公里','num'],['default_cities','預設城市（代碼，逗號分隔）','csv']
];
var FERRY_EDIT=[],FERRY_NEW=null;
function emptyFerry(){
  return {id:'',name:'',source:'',main_name:'',main_lat:'',main_lng:'',isle_name:'',isle_lat:'',isle_lng:'',isle_center_lat:'',isle_center_lng:'',
    isle_radius_km:2.5,duration_min:20,board_min:5,fare_jpy:0,note:'',seasons:[{label:'全年班次',months:[1,2,3,4,5,6,7,8,9,10,11,12],toIsle:[],toMain:[]}]};
}
function aCell(col,val,key,isNew){
  var a=' data-ac="'+col[0]+'" data-ar="'+esc(key)+'" aria-label="'+esc(col[1])+'"',t=col[2];
  if(t==='id')return isNew?'<input type="text"'+a+' maxlength="3" placeholder="IATA 3 碼">':'<b>'+esc(val)+'</b>';
  if(t==='sel')return '<select'+a+'>'+col[3].map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===val?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>';
  if(t==='csv')return '<input type="text"'+a+' value="'+esc((val||[]).join(','))+'">';
  return '<input type="'+(t==='text'?'text':'number')+'"'+(t==='num'?' step="any"':'')+a+' value="'+esc(val==null?'':val)+'">';
}
async function adminTransport(){
  var r=await Promise.all([sb.from('airports').select('*').order('code'),sb.from('ferry_routes').select('*').order('id')]);
  if(r[0].error)throw r[0].error;if(r[1].error)throw r[1].error;
  DB.airports=r[0].data;DB.ferry_routes=r[1].data;
  FERRY_EDIT=r[1].data.map(function(x){return JSON.parse(JSON.stringify(x))});
  renderTransport();
}
function renderTransport(){
  var h=ASUB==='airports'?airportsHtml():ferriesHtml();
  $('adminBody').innerHTML=h;
}
function airportsHtml(){
  var h='<h3>機場與接駁車站</h3><p class="muted">從機場出發（或前往機場）的路線，會改成「機場 ⇄ 接駁車站」加上「車站 ⇄ 目的地」。這裡填的是機場到車站的單程時間與費用（新台幣）；規劃頁按「更新」時會改查實際班次與票價。「預設城市」是沒填機場代碼時，該城市預設使用的機場。</p>'+
    '<div class="tblwrap"><table class="t"><thead><tr>'+AIR_COLS.map(function(c){return '<th>'+esc(c[1])+'</th>'}).join('')+'<th></th></tr></thead><tbody>';
  h+='<tr class="new" data-arow="new">'+AIR_COLS.map(function(c){return '<td>'+aCell(c,c[0]==='mode'?'train':'','new',true)+'</td>'}).join('')+'<td class="cell-actions"><button type="button" data-air-act="add">新增</button></td></tr>';
  DB.airports.forEach(function(a){
    h+='<tr data-arow="'+esc(a.code)+'">'+AIR_COLS.map(function(c){return '<td>'+aCell(c,a[c[0]],a.code,false)+'</td>'}).join('')+
      '<td class="cell-actions"><button type="button" data-air-act="save" data-code="'+esc(a.code)+'">儲存</button><button type="button" class="ghost danger" data-air-act="del" data-code="'+esc(a.code)+'">刪除</button></td></tr>';
  });
  return h+'</tbody></table></div>';
}
function ferriesHtml(){
  var h='<h3>離島渡船與季節班次</h3><p class="muted">離島範圍以「中心點＋半徑」判斷：景點落在範圍內就視為在島上，往返會自動改成「前往碼頭 → 等下一班船 → 搭船 → 碼頭到景點」，並依行程當天所在月份選用對應季節的班次。每個月份都要有對應的季節（不要漏掉或重複）。</p>';
  FERRY_EDIT.forEach(function(f,i){h+=ferryCard(f,i)});
  return h+'<div class="reqcard"><b>新增航線</b>'+ferryCard(FERRY_NEW||emptyFerry(),'new')+'</div>';
}
function fIn(name,label,val,type,extra){return '<label class="fcell"><span>'+esc(label)+'</span><input type="'+(type||'text')+'"'+(type==='number'?' step="any"':'')+' data-fc="'+name+'" value="'+esc(val==null?'':val)+'"'+(extra||'')+'></label>'}
function ferryCard(f,idx){
  var isNew=idx==='new',h='<div class="'+(isNew?'':'reqcard ')+'ferrycard" data-fidx="'+idx+'">';
  if(!isNew)h+='<b>'+esc(f.name||f.id)+'</b> <span class="muted">代碼 '+esc(f.id)+'</span>';
  h+='<div class="ferrygrid">'+
    (isNew?fIn('id','航線代碼（小寫英文）',f.id,'text',' maxlength="20"'):'')+
    fIn('name','航線名稱',f.name)+fIn('source','資料來源',f.source)+
    fIn('main_name','本島碼頭名稱',f.main_name)+fIn('main_lat','本島碼頭緯度',f.main_lat,'number')+fIn('main_lng','本島碼頭經度',f.main_lng,'number')+
    fIn('isle_name','離島碼頭名稱',f.isle_name)+fIn('isle_lat','離島碼頭緯度',f.isle_lat,'number')+fIn('isle_lng','離島碼頭經度',f.isle_lng,'number')+
    fIn('isle_center_lat','離島中心緯度',f.isle_center_lat,'number')+fIn('isle_center_lng','離島中心經度',f.isle_center_lng,'number')+fIn('isle_radius_km','離島範圍半徑（公里）',f.isle_radius_km,'number')+
    fIn('duration_min','航行分鐘',f.duration_min,'number')+fIn('board_min','提前登船分鐘',f.board_min,'number')+fIn('fare_jpy','單程票價（日圓）',f.fare_jpy,'number')+
    '<label class="fcell wide"><span>注意事項</span><input type="text" data-fc="note" value="'+esc(f.note||'')+'"></label></div>';
  (f.seasons||[]).forEach(function(s,si){
    h+='<div class="seas" data-si="'+si+'"><label class="fcell"><span>季節名稱</span><input type="text" data-sf="label" value="'+esc(s.label||'')+'"></label>'+
      '<label class="fcell"><span>適用月份（逗號分隔，如 3,4,5）</span><input type="text" data-sf="months" value="'+esc((s.months||[]).join(','))+'"></label>'+
      '<label class="fcell"><span>本島 → 離島 發船時間（如 07:50,09:20）</span><input type="text" data-sf="toIsle" value="'+esc((s.toIsle||[]).join(','))+'"></label>'+
      '<label class="fcell"><span>離島 → 本島 發船時間</span><input type="text" data-sf="toMain" value="'+esc((s.toMain||[]).join(','))+'"></label>'+
      '<button type="button" class="ghost sm x" data-fer-act="delseason" data-si="'+si+'" aria-label="刪除這個季節">✕</button></div>';
  });
  h+='<div class="adminbar"><button type="button" class="ghost" data-fer-act="addseason">＋ 新增季節</button>'+
    (isNew?'<button type="button" data-fer-act="add">新增航線</button>':'<button type="button" data-fer-act="save" data-id="'+esc(f.id)+'">儲存</button><button type="button" class="ghost danger" data-fer-act="del" data-id="'+esc(f.id)+'">刪除航線</button>')+'</div></div>';
  return h;
}
function readFerryCard(card){
  var o={},num=function(k,n){var v=parseFloat(card.querySelector('[data-fc="'+k+'"]').value);if(isNaN(v))throw new Error('「'+n+'」請填數字');return v};
  var el=function(k){var e=card.querySelector('[data-fc="'+k+'"]');return e?e.value.trim():''};
  o.id=el('id');o.name=el('name');o.source=el('source');o.note=el('note');
  o.main_name=el('main_name');o.isle_name=el('isle_name');
  [['main_lat','本島碼頭緯度'],['main_lng','本島碼頭經度'],['isle_lat','離島碼頭緯度'],['isle_lng','離島碼頭經度'],['isle_center_lat','離島中心緯度'],['isle_center_lng','離島中心經度'],['isle_radius_km','離島範圍半徑'],['duration_min','航行分鐘'],['board_min','提前登船分鐘'],['fare_jpy','票價']].forEach(function(p){o[p[0]]=num(p[0],p[1])});
  o.seasons=[].map.call(card.querySelectorAll('.seas'),function(s){
    var g=function(k){return s.querySelector('[data-sf="'+k+'"]').value.trim()},times=function(k,n){
      var a=g(k).split(/[,，\s]+/).filter(Boolean);
      a.forEach(function(t){if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))throw new Error('「'+n+'」的時間格式錯誤：'+t+'（請用 07:50 這種格式）')});
      return a.map(function(t){return (t.length<5?'0':'')+t}).sort();
    };
    var months=g('months').split(/[,，\s]+/).filter(Boolean).map(Number);
    if(!months.length||months.some(function(m){return !(m>=1&&m<=12)}))throw new Error('「適用月份」請填 1–12 的數字，用逗號分隔');
    return {label:g('label')||'班次',months:months,toIsle:times('toIsle','本島 → 離島'),toMain:times('toMain','離島 → 本島')};
  });
  return o;
}
function checkFerry(o,isNew){
  if(isNew&&!/^[a-z0-9_]{2,20}$/.test(o.id))throw new Error('航線代碼請用 2–20 個小寫英文字母或數字');
  if(!o.name||!o.main_name||!o.isle_name)throw new Error('請填航線名稱與兩個碼頭名稱');
  if(!(o.duration_min>0))throw new Error('航行分鐘必須大於 0');
  if(!o.seasons.length)throw new Error('至少要有一個季節');
  var cnt={};
  o.seasons.forEach(function(s){
    s.months.forEach(function(m){cnt[m]=(cnt[m]||0)+1});
    if(!s.toIsle.length||!s.toMain.length)throw new Error('「'+s.label+'」兩個方向都要填發船時間');
  });
  var dup=Object.keys(cnt).filter(function(m){return cnt[m]>1}),miss=[];
  for(var m=1;m<=12;m++)if(!cnt[m])miss.push(m);
  if(dup.length)throw new Error('月份重複出現在多個季節：'+dup.join('、')+' 月');
  if(miss.length)throw new Error('這些月份沒有對應的季節班次：'+miss.join('、')+' 月（每個月都要有班次，否則該月份會誤用第一個季節）');
}
function readAirRow(code,isNew){
  var root=document.querySelector('#adminBody tr[data-arow="'+(isNew?'new':(window.CSS&&CSS.escape?CSS.escape(code):code))+'"]'),o={};
  AIR_COLS.forEach(function(c){
    var el=root.querySelector('[data-ac="'+c[0]+'"]');
    if(!el)return;
    var v=el.value.trim();
    if(c[2]==='num'){var f=parseFloat(v);if(isNaN(f))throw new Error('「'+c[1]+'」請填數字');o[c[0]]=f}
    else if(c[2]==='int'){var n=parseInt(v,10);if(isNaN(n)||n<0)throw new Error('「'+c[1]+'」請填整數');o[c[0]]=n}
    else if(c[2]==='csv')o[c[0]]=v.split(/[,，\s]+/).filter(Boolean);
    else o[c[0]]=v;
  });
  if(isNew){o.code=(o.code||'').toUpperCase();if(!/^[A-Z]{3}$/.test(o.code))throw new Error('機場代碼請填 3 個英文字母（IATA）')}
  if(!o.name||!o.hub_name)throw new Error('請填機場名稱與接駁車站');
  if(!(o.minutes>0))throw new Error('單程分鐘必須大於 0');
  if(Math.abs(o.lat)>90||Math.abs(o.hub_lat)>90||Math.abs(o.lng)>180||Math.abs(o.hub_lng)>180)throw new Error('座標超出範圍');
  (o.default_cities||[]).forEach(function(c){if(!DB.cities.some(function(x){return x.id===c}))throw new Error('預設城市「'+c+'」不是內建城市代碼')});
  return o;
}
async function afterTransportSave(msg){
  await loadBuiltin();
  aMsg(msg);
  await adminTransport();
}
on('adminBody','click',async function(e){
  var b=e.target.closest('button[data-air-act],button[data-fer-act]');
  if(!b||(ASUB!=='airports'&&ASUB!=='ferries'))return;
  try{
    if(b.dataset.airAct){
      var a=b.dataset.airAct,code=b.dataset.code;
      if(a==='del'){
        if(!b.dataset.sure){b.dataset.sure='1';b.textContent='確定刪除？';setTimeout(function(){delete b.dataset.sure;b.textContent='刪除'},4000);return}
        var d=await sb.from('airports').delete().eq('code',code);if(d.error)throw d.error;
        await afterTransportSave('已刪除');return;
      }
      var o=readAirRow(code,a==='add');
      if(a==='add'){var i=await sb.from('airports').insert(o);if(i.error)throw i.error}
      else{delete o.code;o.updated_at=new Date().toISOString();var u=await sb.from('airports').update(o).eq('code',code);if(u.error)throw u.error}
      await afterTransportSave('已儲存');return;
    }
    var fa=b.dataset.ferAct,card=b.closest('.ferrycard'),idx=card.dataset.fidx;
    if(fa==='addseason'||fa==='delseason'){
      // 先把畫面上已輸入的內容存起來，再調整季節數量
      var cur;
      try{cur=readFerryCard(card)}catch(err){cur=null}
      var tgt=idx==='new'?(FERRY_NEW||emptyFerry()):FERRY_EDIT[+idx];
      if(cur){Object.keys(cur).forEach(function(k){if(k!=='id'||idx==='new')tgt[k]=cur[k]})}
      if(fa==='addseason')tgt.seasons.push({label:'新季節',months:[],toIsle:[],toMain:[]});
      else tgt.seasons.splice(+b.dataset.si,1);
      if(idx==='new')FERRY_NEW=tgt;
      renderTransport();return;
    }
    if(fa==='del'){
      if(!b.dataset.sure){b.dataset.sure='1';b.textContent='再按一次確認刪除';setTimeout(function(){delete b.dataset.sure;b.textContent='刪除航線'},4000);return}
      var dd=await sb.from('ferry_routes').delete().eq('id',b.dataset.id);if(dd.error)throw dd.error;
      await afterTransportSave('已刪除');return;
    }
    var fo=readFerryCard(card);
    checkFerry(fo,fa==='add');
    if(fa==='add'){var fi=await sb.from('ferry_routes').insert(fo);if(fi.error)throw fi.error;FERRY_NEW=null}
    else{var id=fo.id||b.dataset.id;delete fo.id;fo.updated_at=new Date().toISOString();var fu=await sb.from('ferry_routes').update(fo).eq('id',b.dataset.id);if(fu.error)throw fu.error}
    await afterTransportSave('已儲存');
  }catch(err){aMsg('操作失敗：'+(err.message||err),true)}
});
