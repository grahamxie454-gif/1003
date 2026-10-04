// 分享頁／幻燈片頁共用：載入登入片段、建立 Supabase 連線、檢查登入狀態
// 各頁需自行定義 enter(user)（登入成功後要做的事）
function flush(){return Promise.resolve()}
async function bootPage(){
  try{await loadView($('auth'),'views/auth.html')}catch(err){$('boot').textContent='無法載入頁面：'+err.message;return}
  if(!window.supabase){$('boot').textContent='無法載入登入元件，請檢查網路連線。';return}
  sb=window.supabase.createClient(SB_URL,SB_KEY);
  setAuthMode('login');
  sb.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')showAuth()});
  var s=await sb.auth.getSession();
  if(s.data&&s.data.session&&s.data.session.user.email_confirmed_at)await enter(s.data.session.user);
  else{$('boot').hidden=true;$('auth').hidden=false}
}
function tripIdParam(){
  var id=new URLSearchParams(location.search).get('trip')||'';
  return /^[0-9a-f-]{36}$/i.test(id)?id:'';
}
var fmtDT=function(s){var d=new Date(s);return isNaN(d)?'':d.toLocaleString('zh-TW',{hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})};
// 依拍照時間排序（沒有拍照時間時用上傳時間）
function photoTime(p){return Date.parse(p.taken_at||p.created_at)||0}
async function loadPhotos(tripId){
  var r=await sb.from('trip_photos').select('*').eq('trip_id',tripId);
  if(r.error)throw r.error;
  var rows=r.data.sort(function(a,b){return photoTime(a)-photoTime(b)});
  if(rows.length){
    var u=await sb.storage.from('trip-photos').createSignedUrls(rows.map(function(x){return x.path}),3600);
    var map={};
    (u.data||[]).forEach(function(x){if(x.signedUrl)map[x.path]=x.signedUrl});
    rows.forEach(function(x){x.url=map[x.path]||''});
  }
  return rows;
}
