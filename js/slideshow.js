// ================= 照片幻燈片（依拍照時間排序） =================
var SL=[],SLI=0,slTimer=null,SLTID='',SLITEMS={};

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  SLTID=tripIdParam();
  if(!SLTID){$('boot').textContent='連結不正確。';return}
  try{
    var t=await sb.rpc('get_shared_trip',{p_id:SLTID});
    if(t.error)throw t.error;
    if(!t.data){$('boot').textContent='找不到這份行程，或擁有者尚未開啟分享。';return}
    ME={id:user.id,email:user.email};
    ((t.data.share_data&&t.data.share_data.days)||[]).forEach(function(d){d.rows.forEach(function(r){if(r.k)SLITEMS[r.k]={name:r.n,day:d.no}})});
    document.title=t.data.name+'・照片幻燈片';
    $('backLink').href='share.html?trip='+SLTID;
    await loadPeople(SLTID);
    SL=await loadPhotos(SLTID);
    SL=SL.filter(function(p){return p.url});
    if(!SL.length){$('boot').textContent='還沒有照片。';return}
    var want=new URLSearchParams(location.search).get('p');
    SLI=Math.max(0,SL.findIndex(function(p){return p.id===want}));
    $('loginWrap').hidden=true;$('app').hidden=false;
    $('strip').innerHTML=SL.map(function(p,i){return '<img loading="lazy" data-i="'+i+'" src="'+esc(p.url)+'" alt="第 '+(i+1)+' 張">'}).join('');
    show(SLI);
  }catch(err){$('boot').hidden=false;$('boot').textContent='載入失敗：'+(err.message||err)}
}
function show(i){
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
  if(on_)slTimer=setInterval(function(){show(SLI+1)},4000);
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
  if($('app').hidden)return;
  if(e.key==='ArrowLeft')show(SLI-1);
  else if(e.key==='ArrowRight')show(SLI+1);
  else if(e.key===' '){e.preventDefault();play(!slTimer)}
});
bootPage();
