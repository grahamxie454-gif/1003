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
var APP_VER='20261007';

// ===== Google 地圖：圖示與連結 =====
// Maps JavaScript API 的瀏覽器金鑰（只用來顯示「當日所有地點」的地圖頁 map.html）。
// 請在 Google Cloud 建立金鑰，限制為「HTTP 參照網址」（你的網站網址），並只允許 Maps JavaScript API 與 Places API (New)。
// 這種金鑰本來就會出現在網頁中，靠參照網址限制來保護。
var GMAPS_KEY='AIzaSyAtXgb-DvkObH-kRRYeEnGE1-XN02BS_NU';
var ICON_PIN='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#ea4335" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>';
var ICON_ROUTE='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>';
var ICON_REFRESH='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
function iconLink(href,svg,label){
  return '<a class="iconlink" href="'+esc(href)+'" target="_blank" rel="noopener" title="'+esc(label)+'" aria-label="'+esc(label)+'">'+svg+'</a>';
}
// 兩點之間的路徑。epoch（秒）有值時帶入出發時間（大眾運輸／開車）；步行不需要時間。
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
