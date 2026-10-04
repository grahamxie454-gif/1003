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
var DEF=function(){return {co:['jp'],ci:['tyo'],days:5,styles:['f','c'],modes:['metro','train'],tier:1,pace:'full',auto:true,fl:{out:{},ret:{}},stay:{}}};
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
var APP_VER='20261004';
