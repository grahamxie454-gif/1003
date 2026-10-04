// ================= 暱稱 =================
// 暱稱預設為電子郵件 @ 之前的名稱；每位使用者都能自己修改（透過資料庫函式 set_nickname，只能改自己的）。
var NICK={}; // user_id → 暱稱（分享頁與幻燈片使用）
function emailName(email){return String(email||'').split('@')[0]||'使用者'}
function myNick(){return (ME&&ME.nickname&&String(ME.nickname).trim())||emailName(ME&&ME.email)}
function nameOf(userId,email){return NICK[userId]||emailName(email)}
function showWho(){
  var el=$('whoEmail');
  if(el){el.textContent=myNick();el.title=ME.email||''}
}
async function loadPeople(tripId){
  NICK={};
  try{
    var r=await sb.rpc('trip_people',{p_trip:tripId});
    (r.data||[]).forEach(function(x){NICK[x.user_id]=x.nickname});
  }catch(e){}
  if(ME&&ME.id&&ME.nickname)NICK[ME.id]=ME.nickname;
}
function nickEditOpen(open){
  $('nickForm').hidden=!open;$('nickEdit').hidden=open;$('nickMsg').textContent='';
  if(open){$('nickIn').value=myNick();$('nickIn').focus();$('nickIn').select()}
}
async function nickSave(){
  var v=$('nickIn').value.trim();
  if(!v||v.length>20){$('nickMsg').textContent='請輸入 1–20 個字的暱稱。';return}
  $('nickSave').disabled=true;
  var r=await sb.rpc('set_nickname',{p_name:v});
  $('nickSave').disabled=false;
  if(r.error){$('nickMsg').textContent='儲存失敗：'+r.error.message;return}
  ME.nickname=r.data;NICK[ME.id]=r.data;
  showWho();nickEditOpen(false);
  if(typeof onNickChanged==='function')onNickChanged();
}
on('nickEdit','click',function(){nickEditOpen(true)});
on('nickCancel','click',function(){nickEditOpen(false)});
on('nickSave','click',nickSave);
on('nickIn','keydown',function(e){if(e.key==='Enter'){e.preventDefault();nickSave()}else if(e.key==='Escape')nickEditOpen(false)});
