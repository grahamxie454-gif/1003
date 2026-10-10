var SITE_URL='https://grahamxie454-gif.github.io/1003/';
var SB_URL='https://fgwbcbfuicvfhhfmrsmv.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnd2JjYmZ1aWN2ZmhoZm1yc212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODU5NzAsImV4cCI6MjEwNjU2MTk3MH0.qg3I0n0zh1W6TaVS3QfVzQNwmOM-cg_mLrVF5i1_B58';
var $=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var fmt=function(n){return 'NT$ '+(Math.round(n/100)*100).toLocaleString('zh-TW')};
var fmtMin=function(m){return m<60?m+' 分鐘':Math.floor(m/60)+' 小時'+(m%60?' '+(m%60)+' 分':'')};
var fmtKm=function(k){return k<10?(Math.round(k*10)/10)+' 公里':Math.round(k)+' 公里'};

var STYLE={f:'美食',c:'文化',n:'自然',s:'購物',x:'自訂'};
var ORD={c:0,n:0,x:1,s:1,f:2};
var SLOT={a:['上午','09:00'],p:['下午','13:30'],e:['晚上','18:30']};
function slotWin(b){return {a:[b,b+210],p:[b+270,b+510],e:[b+570,b+750]}}
function minStr(m){m=Math.max(0,Math.min(1439,Math.round(m)));return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+m%60).slice(-2)}
var TIERS=[['節省',0.9],['適中',1],['舒適',1.3]];
var MODES={metro:'地鐵',bus:'公車',train:'火車',ferry:'渡輪',drive:'自駕'};
var LOCAL={metro:150,bus:100,train:120,ferry:0,drive:1500};
var MODE_TXT={ferry:'城際移動用，目前內建航線為釜山與福岡之間，自訂城市也可使用；請先查詢班次與天候停航。',metro:'市區主力，買儲值卡或一日券最划算。',bus:'補足地鐵到不了的區域，留意末班車時間。',train:'城際移動首選，熱門路線建議先訂位。',drive:'需國際駕照或當地認可的駕照譯本，租車前確認保險與停車。'};
var MNAME={metro:'地鐵',bus:'公車',train:'火車',drive:'自駕',walk:'步行',flight:'飛機',ferry:'渡輪'};

var HMSG={},sb=null,ME=null,DB=null,CO={},C={},TRIPS=[],TRIP=null,saveTimer=null,dirty=false;
var DEF=function(){return {co:[],ci:[],days:5,styles:['f','c'],modes:['metro','train'],tier:1,pace:'full',auto:true,flights:[],expanded:false,stay:{}}};
var st=DEF(),sel={},uid=0,cuid=0,DAYS={},OPEN={};


// 事件委派：版面片段是動態載入的，所以把事件掛在 document 上，再判斷是否發生在指定元素內
function on(id,type,fn){
  document.addEventListener(type,function(e){
    var host=document.getElementById(id);
    if(host&&e.target&&e.target.nodeType===1&&host.contains(e.target))fn.call(host,e);
  },type==='toggle');
}
function onSel(sel,type,fn){
  document.addEventListener(type,function(e){
    var host=e.target&&e.target.closest&&e.target.closest(sel);
    if(host)fn.call(host,e);
  });
}
// 載入版面片段（views/*.html）
async function loadView(host,url){
  var r=await fetch(url+'?v='+APP_VER);
  if(!r.ok)throw new Error('無法載入 '+url);
  host.innerHTML=await r.text();
}
var APP_VER='20261043';

// ===== Google 地圖：圖示與連結 =====
// Maps JavaScript API 的瀏覽器金鑰（只用來顯示「當日所有地點」的地圖頁 map.html）。
// 請在 Google Cloud 建立金鑰，限制為「HTTP 參照網址」（你的網站網址），並只允許 Maps JavaScript API 與 Places API (New)。
// 這種金鑰本來就會出現在網頁中，靠參照網址限制來保護。
var GMAPS_KEY='AIzaSyAtXgb-DvkObH-kRRYeEnGE1-XN02BS_NU';
var ICON_PIN='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#ea4335" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
var ICON_ROUTE='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>';
var ICON_NAVI='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="3" fill="none" stroke="#00a0a0" stroke-width="2"/><path d="M5 11h14M9 21l2-4M15 21l-2-4" fill="none" stroke="#00a0a0" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="14" r="1.2" fill="#00a0a0"/><circle cx="15" cy="14" r="1.2" fill="#00a0a0"/></svg>';
var ICON_REFRESH='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
function iconLink(href,svg,label){
  return '<a class="iconlink" href="'+esc(href)+'" target="_blank" rel="noopener" title="'+esc(label)+'" aria-label="'+esc(label)+'">'+svg+'</a>';
}
// 兩點之間的路徑。epoch（秒）有值時帶入出發時間（大眾運輸／開車）；步行不需要時間。
// !7e2＝時間以「當地時間」從 1970/1/1 0:00 起算，所以 epoch 要用「旅遊當地的時鐘時間當成 UTC」換算，不可再扣時差。
function dirLink(o,dst,mode,epoch){
  var seg=function(s){return encodeURIComponent(s).replace(/%20/g,'+')};
  var m=({walk:'!3e2',drive:'!3e0'})[mode]||'!3e3';
  var data=(epoch&&mode!=='walk')?'/data=!4m6!4m5!2m3!6e0!7e2!8j'+epoch+m:'/data=!4m2!4m1'+m;
  return 'https://www.google.com/maps/dir/'+seg(o)+'/'+seg(dst)+data;
}
// 當日所有地點（只標位置、不規劃路線）的地圖頁
function pinsUrl(stops,title){
  var s=JSON.stringify({t:title||'',s:stops.slice(0,30)});
  var b=btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return new URL('map.html#'+b,location.href).href;
}

// ===== 交通工具彩色圖示 =====
var MI_C={metro:'#1a73e8',bus:'#2e9e4f',train:'#d93025',tram:'#f29900',ferry:'#00897b',drive:'#5f6368',walk:'#8d6e63',flight:'#0288d1'};
var MI_P={
  metro:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  bus:'<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16M7 17v3M17 17v3"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/>',
  train:'<path d="M7 3h10a2 2 0 0 1 2 2v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2z"/><path d="M5 10h14M9 18l-2 3M15 18l2 3"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  tram:'<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 3l2 3M16 3l-2 3M5 12h14M8 21l1.5-3M16 21l-1.5-3"/>',
  ferry:'<path d="M4 15l2-6h12l2 6M12 9V4h3M2 19c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1"/>',
  drive:'<path d="M5 11l2-5h10l2 5M3 11h18v6H3zM6 17v2M18 17v2"/><circle cx="7" cy="14" r="1" fill="currentColor"/><circle cx="17" cy="14" r="1" fill="currentColor"/>',
  walk:'<circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-7-3-3 2-5 3 3h3M12 14l3 3v4"/>',
  flight:'<path d="M2 14l8-3-3-7 2-1 6 6 6-2c1 0 2 1 1 2l-5 4 1 7-2 1-3-6-5 3z"/>'
};
function modeIcon(m,sz,bare){
  var p=MI_P[m]||MI_P.train,s='<svg viewBox="0 0 24 24" width="'+(sz||18)+'" height="'+(sz||18)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  if(bare)return s;
  var nm=(typeof MNAME!=='undefined'&&MNAME[m])||({tram:'電車'}[m])||m;
  return '<span class="modeico" style="color:'+(MI_C[m]||'#5f6368')+'" title="'+nm+'" role="img" aria-label="'+nm+'">'+s+'</span>';
}
// 路線分段（轉乘）：步行 › 地鐵 › 公車…，每一段各自的彩色圖示、路線名稱與分鐘
function segsHtml(lg){
  var s=lg&&lg.segs;
  if(!s||!s.length||(s.length<2&&s[0].m==='walk'))return '';
  return '<div class="segs" aria-label="路線分段">'+s.map(function(x){
    var tip=(x.f&&x.t)?x.f+' → '+x.t:'';
    return '<span class="seg"'+(tip?' title="'+esc(tip)+'"':'')+'>'+modeIcon(x.m,16)+(x.n?'<b>'+esc(x.n)+'</b>':'')+'<em>'+x.min+' 分</em></span>';
  }).join('<span class="segsep">›</span>')+'</div>';
}

// ===== 吐司訊息：儲存、刪除、更新與錯誤等訊息，一律從畫面下方彈出，過一會兒自動消失 =====
// toast(文字, 類型 ok|info|warn|err, {key, html, ms})：同一個 key 會取代前一則（例如「儲存中…」→「已儲存」）；沒填類型時依文字判斷。
function toastType(t){
  t=String(t||'');
  if(/失敗|錯誤|無法|拒絕|衝突|沒有權限|不正確|過期|找不到|超出|不支援|不允許/.test(t))return 'err';
  if(/請先|請輸入|請貼|請重新|請再|至少|尚未|不能|已固定|已經安排|格式|請確認|請選擇|請填/.test(t))return 'warn';
  if(/已(儲存|刪除|更新|複製|新增|重新命名|取消|收錄|核准|退回|上傳|送出|寄)|完成|成功|儲存了/.test(t))return 'ok';
  return 'info';
}
var TOAST_ICO={ok:'✓',info:'ℹ',warn:'!',err:'✕'};
function toast(text,type,opt){
  opt=opt||{};
  if(!text)return;
  type=type||toastType(text);
  var box=document.getElementById('toasts');
  if(!box){box=document.createElement('div');box.id='toasts';box.setAttribute('aria-live','polite');document.body.appendChild(box)}
  var key=opt.key||'',el=key?box.querySelector('[data-tkey="'+key+'"]'):null;
  if(!el){
    el=document.createElement('div');
    if(key)el.setAttribute('data-tkey',key);
    el.innerHTML='<span class="ticon" aria-hidden="true"></span><span class="ttext"></span><button type="button" class="tclose" aria-label="關閉訊息">✕</button>';
    el.querySelector('.tclose').onclick=function(){el.classList.add('out');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},200)};
    box.appendChild(el);
    while(box.children.length>4)box.removeChild(box.firstChild);
  }
  el.className='toast '+type;
  el.setAttribute('role',type==='err'?'alert':'status');
  el.querySelector('.ticon').textContent=TOAST_ICO[type];
  var tx=el.querySelector('.ttext');
  if(opt.html)tx.innerHTML=text;else tx.textContent=text;
  clearTimeout(el._t);
  var ms=opt.ms||(type==='err'?9000:(type==='warn'?6500:(type==='ok'?3000:Math.min(9000,3500+String(text).length*60))));
  if(opt.sticky)return el;
  el._t=setTimeout(function(){if(el.parentNode){el.classList.add('out');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},200)}},ms);
  return el;
}
function toastClear(key){
  var el=document.querySelector('#toasts [data-tkey="'+key+'"]');
  if(el&&el.parentNode)el.parentNode.removeChild(el);
}
