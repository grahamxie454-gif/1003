// ================= 管理後台：機場與離島渡船（在「內建資料」頁籤中，版面與景點相同）=================
// 資料表 airports（機場與接駁車站）、ferry_routes（離島渡船與季節班次）。儲存後規劃頁會立刻使用新資料。
// 機場用 admin.js 的通用表格處理（欄位定義在 AIR_COLS）；渡船的季節班次比較複雜，這裡自己處理。
var AIR_COLS=[
  ['code','代碼','id'],['name','機場名稱','text'],['lat','航廈緯度','num'],['lng','航廈經度','num'],
  ['hub_name','接駁車站','text'],['hub_lat','車站緯度','num'],['hub_lng','車站經度','num'],
  ['mode','方式','sel',[['train','火車'],['metro','地鐵'],['bus','巴士／叫車']]],['via','搭乘說明','text'],
  ['minutes','單程分鐘','int'],['fare_twd','費用 NT$','int'],['km','公里','num'],['default_cities','預設城市（代碼，逗號分隔）','csv']
];
// 葉子圖示：新增季節（和其他「＋」新增區分）
var LEAF_ICON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6.5C9.7 13.6 12 12 13 10"/></svg>';
var FERRY_EDIT=[],FERRY_NEW=null;
function emptyFerry(){
  return {id:'',name:'',source:'',main_name:'',main_lat:'',main_lng:'',isle_name:'',isle_lat:'',isle_lng:'',isle_center_lat:'',isle_center_lng:'',
    isle_radius_km:2.5,duration_min:20,board_min:5,fare_jpy:0,note:'',seasons:[{label:'全年班次',months:[1,2,3,4,5,6,7,8,9,10,11,12],toIsle:[],toMain:[]}]};
}
function fIn(name,label,val,type,extra){return '<label class="rf"><span>'+esc(label)+'</span><input type="'+(type||'text')+'"'+(type==='number'?' step="any"':'')+' data-fc="'+name+'" value="'+esc(val==null?'':val)+'"'+(extra||'')+'></label>'}
function fbtn(act,title,svg,cls,extra){return '<button type="button" class="ib'+(cls?' '+cls:'')+'" data-fer-act="'+act+'"'+(extra||'')+' title="'+esc(title)+'" aria-label="'+esc(title)+'">'+svg+'</button>'}
// 一條航線 = 一張卡片：左邊是圖示功能列，右邊的欄位依視窗寬度自動分成多列
function ferryCard(f,idx){
  var isNew=idx==='new',acts=isNew?'':'<div class="recact">'+fbtn('save','儲存',AICON.save,'',' data-id="'+esc(f.id)+'"')+fbtn('del','刪除航線',AICON.del,'danger',' data-id="'+esc(f.id)+'"')+'</div>';
  var h='<div class="rec ferrycard'+(isNew?' new':'')+'" data-fidx="'+idx+'">'+acts+'<div class="recf">'+
    (isNew?fIn('id','航線代碼（小寫英文）',f.id,'text',' maxlength="20"'):'<div class="rf wide"><b>'+esc(f.name||f.id)+'</b><span>代碼 '+esc(f.id)+'</span></div>')+
    fIn('name','航線名稱',f.name)+fIn('source','資料來源',f.source)+
    fIn('main_name','本島碼頭名稱',f.main_name)+fIn('main_lat','本島碼頭緯度',f.main_lat,'number')+fIn('main_lng','本島碼頭經度',f.main_lng,'number')+
    fIn('isle_name','離島碼頭名稱',f.isle_name)+fIn('isle_lat','離島碼頭緯度',f.isle_lat,'number')+fIn('isle_lng','離島碼頭經度',f.isle_lng,'number')+
    fIn('isle_center_lat','離島中心緯度',f.isle_center_lat,'number')+fIn('isle_center_lng','離島中心經度',f.isle_center_lng,'number')+fIn('isle_radius_km','離島範圍半徑（公里）',f.isle_radius_km,'number')+
    fIn('duration_min','航行分鐘',f.duration_min,'number')+fIn('board_min','提前登船分鐘',f.board_min,'number')+fIn('fare_jpy','單程票價（日圓）',f.fare_jpy,'number')+
    '<label class="rf wide"><span>注意事項</span><input type="text" data-fc="note" value="'+esc(f.note||'')+'"></label>';
  (f.seasons||[]).forEach(function(s,si){
    h+='<div class="seas wide" data-si="'+si+'"><label class="rf"><span>季節名稱</span><input type="text" data-sf="label" value="'+esc(s.label||'')+'"></label>'+
      '<label class="rf"><span>適用月份（逗號分隔，如 3,4,5）</span><input type="text" data-sf="months" value="'+esc((s.months||[]).join(','))+'"></label>'+
      '<label class="rf"><span>本島 → 離島 發船時間（如 07:50,09:20）</span><input type="text" data-sf="toIsle" value="'+esc((s.toIsle||[]).join(','))+'"></label>'+
      '<label class="rf"><span>離島 → 本島 發船時間</span><input type="text" data-sf="toMain" value="'+esc((s.toMain||[]).join(','))+'"></label>'+
      fbtn('delseason','刪除這個季節',CLOSE_ICON,'',' data-si="'+si+'"')+'</div>';
  });
  return h+'<div class="rf wide">'+fbtn('addseason','新增季節',LEAF_ICON,'leaf')+'</div></div></div>';
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
on('adminBody','click',async function(e){
  var b=e.target.closest('button[data-fer-act]');
  if(!b||ASUB!=='data'||DSUB!=='ferries')return;
  try{
    var fa=b.dataset.ferAct,card=b.closest('.ferrycard')||document.querySelector('#addModal .ferrycard'),idx=card?card.dataset.fidx:'new';
    if(fa==='addseason'||fa==='delseason'){
      // 先把畫面上已輸入的內容存起來，再調整季節數量，只重畫這一張卡片
      var cur;
      try{cur=readFerryCard(card)}catch(err){cur=null}
      var tgt=idx==='new'?(FERRY_NEW||(FERRY_NEW=emptyFerry())):FERRY_EDIT[+idx];
      if(cur){Object.keys(cur).forEach(function(k){if(k!=='id'||idx==='new')tgt[k]=cur[k]})}
      if(fa==='addseason')tgt.seasons.push({label:'新季節',months:[],toIsle:[],toMain:[]});
      else tgt.seasons.splice(+b.dataset.si,1);
      card.outerHTML=ferryCard(tgt,idx==='new'?'new':+idx);
      return;
    }
    if(fa==='del'){
      if(!b.dataset.sure){b.dataset.sure='1';b.classList.add('armed');b.title='再按一次確認刪除';aMsg('再按一次刪除圖示，確認刪除。',true);setTimeout(function(){delete b.dataset.sure;b.classList.remove('armed');b.title='刪除航線'},4000);return}
      var dd=await sb.from('ferry_routes').delete().eq('id',b.dataset.id);if(dd.error)throw dd.error;
    }else{
      var fo=readFerryCard(card);
      checkFerry(fo,fa==='add');
      if(fa==='add'){var fi=await sb.from('ferry_routes').insert(fo);if(fi.error)throw fi.error;FERRY_NEW=null}
      else{delete fo.id;fo.updated_at=new Date().toISOString();var fu=await sb.from('ferry_routes').update(fo).eq('id',b.dataset.id);if(fu.error)throw fu.error}
    }
    await loadBuiltin();aMsg('已儲存');adminData();
  }catch(err){aMsg('操作失敗：'+(err.message||err),true)}
});
