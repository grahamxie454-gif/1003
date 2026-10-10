// ================= 照片幻燈片（依拍照時間排序） =================
var SL=[],SLALL=[],SLDAY=0,SLTOTAL=0,SLI=0,slTimer=null,SLTID='',SLITEMS={};

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  SLTID=tripIdParam();
  if(!SLTID){$('boot').textContent='連結不正確。';return}
  try{
    var t=await sb.rpc('get_shared_trip',{p_id:SLTID});
    if(t.error)throw t.error;
    if(!t.data){$('boot').textContent='找不到這份行程，或擁有者尚未開啟分享。';return}
    ME={id:user.id,email:user.email};
    SLTOTAL=((t.data.share_data&&t.data.share_data.days)||[]).length;
    ((t.data.share_data&&t.data.share_data.days)||[]).forEach(function(d){d.rows.forEach(function(r){if(r.k)SLITEMS[r.k]={name:r.n,day:d.no}})});
    document.title=t.data.name+'・照片幻燈片';
    $('backLink').href='share.html?trip='+SLTID;
    await loadPeople(SLTID);
    SLALL=(await loadPhotos(SLTID)).filter(function(p){return p.url});
    if(!SLALL.length){$('boot').textContent='還沒有照片。';return}
    SLALL.forEach(function(p){var d=photoDay(p);if(d>SLTOTAL)SLTOTAL=d});
    var want=new URLSearchParams(location.search).get('p');
    $('loginWrap').hidden=true;$('app').hidden=false;
    slRender(want);
  }catch(err){$('boot').hidden=false;$('boot').textContent='載入失敗：'+(err.message||err)}
}
function show(i){
  if(!SL.length)return;
  SLI=(i+SL.length)%SL.length;
  var p=SL[SLI];
  $('slideImg').src=p.url;
  $('slideImg').alt=p.caption||'旅遊照片';
  $('slideInfo').textContent=(SLI+1)+' / '+SL.length;
  $('slideCap').innerHTML=(p.caption?'<b>'+esc(p.caption)+'</b><br>':'')+
    '<span class="muted">'+(SLITEMS[p.item_key]?'第 '+SLITEMS[p.item_key].day+' 天・'+esc(SLITEMS[p.item_key].name)+'・':'')+(p.taken_at?'拍攝 '+esc(fmtDT(p.taken_at))+'・':'')+'上傳者 '+esc(nameOf(p.user_id,p.user_email))+'・上傳 '+esc(fmtDT(p.created_at))+(!SLITEMS[p.item_key]&&p.day_no?'・第 '+p.day_no+' 天':'')+'</span>';
  [].forEach.call($('strip').children,function(el,k){el.classList.toggle('on',k===SLI)});
  var cur=$('strip').children[SLI];
  if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest',inline:'center'});
}
function play(on_){
  clearInterval(slTimer);slTimer=null;
  $('slPlay').textContent=on_?'⏸ 暫停':'▶ 播放';
  if(on_&&SL.length)slTimer=setInterval(function(){show(SLI+1)},4000);
}
on('slPrev','click',function(){show(SLI-1)});
on('slNext','click',function(){show(SLI+1)});
on('slPlay','click',function(){play(!slTimer)});
on('slFull','click',function(){
  var el=document.documentElement;
  if(document.fullscreenElement)document.exitFullscreen();else if(el.requestFullscreen)el.requestFullscreen();
});
on('strip','click',function(e){var im=e.target.closest('img[data-i]');if(im)show(+im.dataset.i)});
document.addEventListener('keydown',function(e){
  if($('app').hidden||!SL.length)return;
  if(e.key==='ArrowLeft')show(SLI-1);
  else if(e.key==='ArrowRight')show(SLI+1);
  else if(e.key===' '){e.preventDefault();play(!slTimer)}
});
bootPage();

// ===== 選某一天的照片來播放（沒選＝全部播放）=====
function photoDay(p){return +p.day_no||(SLITEMS[p.item_key]&&SLITEMS[p.item_key].day)||0}
function slRender(preferId){
  play(false);
  SL=SLDAY?SLALL.filter(function(p){return photoDay(p)===SLDAY}):SLALL.slice();
  $('daySel').innerHTML=daySelHtml(SLTOTAL,SLDAY);
  $('strip').innerHTML=SL.map(function(p,i){return '<img loading="lazy" data-i="'+i+'" src="'+esc(p.url)+'" alt="第 '+(i+1)+' 張">'}).join('');
  if(!SL.length){
    $('slideImg').removeAttribute('src');$('slideImg').hidden=true;
    $('slideInfo').textContent='0 / 0';
    $('slideCap').innerHTML='<span class="muted">第 '+SLDAY+' 天還沒有照片。</span>';
    return;
  }
  $('slideImg').hidden=false;
  var i=SL.findIndex(function(p){return p.id===preferId});
  show(i<0?0:i);
}
on('daySel','click',function(e){
  var b=e.target.closest('button[data-daysel]');if(!b)return;
  var n=+b.dataset.daysel;SLDAY=(SLDAY===n?0:n);slRender();
});
on('daySel','change',function(e){
  if(e.target.matches&&e.target.matches('select[data-daysel-sel]')){SLDAY=+e.target.value||0;slRender()}
});
// 左上角選單
function slMenu(open){$('menuPop').hidden=!open;$('menuBtn').setAttribute('aria-expanded',open?'true':'false')}
on('menuBtn','click',function(e){e.stopPropagation();slMenu($('menuPop').hidden)});
document.addEventListener('click',function(e){if(!$('menuPop').hidden&&!e.target.closest('.menuwrap'))slMenu(false)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('menuPop').hidden)slMenu(false)});
