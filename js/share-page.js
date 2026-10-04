// ================= 行程分享頁 =================
var TID='',SHARE=null,PHOTOS=[],NOTES=[],pollTimer=null;

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  TID=tripIdParam();
  if(!TID){$('boot').textContent='連結不正確。';return}
  try{
    var r=await sb.rpc('get_shared_trip',{p_id:TID});
    if(r.error)throw r.error;
    if(!r.data){$('boot').textContent='找不到這份行程，或擁有者尚未開啟分享。';return}
    SHARE=r.data;ME={id:user.id,email:user.email};
    $('whoEmail').textContent=user.email;
    $('sTitle').textContent=SHARE.name;
    $('sSub').textContent='擁有者：'+(SHARE.owner||'')+'　行程更新：'+fmtDT(SHARE.updated_at);
    $('goSlides').href='slideshow.html?trip='+TID;
    var days=(SHARE.share_data&&SHARE.share_data.days)||[];
    $('upDay').innerHTML='<option value="">不指定哪一天</option>'+days.map(function(d){return '<option value="'+d.no+'">第 '+d.no+' 天 '+esc(d.date||'')+' '+esc(d.city)+'</option>'}).join('');
    await refresh();
    $('boot').hidden=true;$('app').hidden=false;
    clearInterval(pollTimer);
    pollTimer=setInterval(function(){
      var a=document.activeElement;
      if(a&&a.closest&&a.closest('#itin'))return;
      refresh().catch(function(){});
    },60000);
  }catch(err){
    $('boot').hidden=false;$('boot').textContent='載入失敗：'+(err.message||err);
  }
}

async function refresh(){
  var res=await Promise.all([loadPhotos(TID),sb.from('trip_notes').select('*').eq('trip_id',TID).order('created_at',{ascending:true})]);
  PHOTOS=res[0];
  if(res[1].error)throw res[1].error;
  NOTES=res[1].data;
  renderShare();
}

function money(c){return c>0?'約 NT$ '+(Math.round(c/10)*10).toLocaleString('zh-TW'):''}
function photoCard(p){
  var mine=p.user_id===ME.id||SHARE.is_owner;
  return '<figure class="ph"><a href="slideshow.html?trip='+TID+'&p='+p.id+'" target="_blank" rel="noopener">'+(p.url?'<img loading="lazy" src="'+esc(p.url)+'" alt="'+esc(p.caption||'旅遊照片')+'">':'<span class="muted">無法載入</span>')+'</a>'+
    '<figcaption>'+(p.caption?'<b>'+esc(p.caption)+'</b><br>':'')+'<span class="muted">'+esc(p.user_email)+'・上傳 '+esc(fmtDT(p.created_at))+(p.taken_at?'・拍攝 '+esc(fmtDT(p.taken_at)):'')+(p.day_no?'・第 '+p.day_no+' 天':'')+'</span>'+
    (mine?' <button type="button" class="ghost sm x" data-del-photo="'+esc(p.id)+'" aria-label="刪除照片">刪除</button>':'')+'</figcaption></figure>';
}
function renderShare(){
  $('photoCnt').textContent='（'+PHOTOS.length+' 張）';
  $('photos').innerHTML=PHOTOS.length?PHOTOS.map(photoCard).join(''):'<p class="muted">還沒有照片，上傳第一張吧。</p>';
  var days=(SHARE.share_data&&SHARE.share_data.days)||[],h='';
  if(!days.length)h='<p class="muted">擁有者尚未發佈行程內容。</p>';
  days.forEach(function(d){
    var notes=NOTES.filter(function(n){return n.day_no===d.no});
    h+='<article class="day"><h3>第 '+d.no+' 天'+(d.date?'<em class="date">'+esc(d.date)+'</em>':'')+'<em class="city">'+esc(d.city)+'</em></h3>';
    if(d.hotel)h+='<p class="note">住宿：'+(d.hotel.url?'<a class="maplink" href="'+esc(d.hotel.url)+'" target="_blank" rel="noopener">'+esc(d.hotel.name)+'</a>':esc(d.hotel.name))+'</p>';
    if(d.off)h+='<p class="note">今天休息，不安排行程。</p>';
    h+='<ol class="tl">'+d.rows.map(function(r){
      var cls=r.t==='move'||r.t==='hop'?'mv':(r.t==='free'||r.t==='buffer'?'fr':(r.t==='meal'?'ml':''));
      var link=/^https?:\/\//i.test(r.l||'')?r.l:'';
      return '<li class="tr '+cls+(r.o?' over':'')+'"><div class="tt">'+minStr(r.s)+(r.e>r.s?'<small>–'+minStr(r.e)+'</small>':'')+'</div><div class="tb">'+
        (link&&r.t!=='move'?'<a class="maplink" href="'+esc(link)+'" target="_blank" rel="noopener"><b>'+esc(r.n)+'</b></a>':(cls==='mv'||cls==='fr'?'<span class="soft">'+esc(r.n)+'</span>':'<b>'+esc(r.n)+'</b>'))+
        (r.r?' <span class="rate">★ '+Number(r.r).toFixed(1)+'</span>':'')+(r.c?' <span class="muted">'+money(r.c)+'</span>':'')+'</div></li>';
    }).join('')+'</ol>';
    var dph=PHOTOS.filter(function(p){return p.day_no===d.no});
    if(dph.length)h+='<div class="photos small">'+dph.map(photoCard).join('')+'</div>';
    h+='<div class="notes"><h4>留言</h4>'+(notes.length?notes.map(function(n){
      return '<p class="note2"><b>'+esc(n.user_email)+'</b> <span class="muted">'+esc(fmtDT(n.created_at))+'</span><br>'+esc(n.body)+
        ((n.user_id===ME.id||SHARE.is_owner)?' <button type="button" class="ghost sm x" data-del-note="'+esc(n.id)+'" aria-label="刪除留言">刪除</button>':'')+'</p>';
    }).join(''):'<p class="muted">還沒有留言。</p>')+
      '<div class="noterow"><input type="text" maxlength="500" data-note-in="'+d.no+'" placeholder="寫下註解或心得" aria-label="第 '+d.no+' 天留言"><button type="button" data-note-add="'+d.no+'">送出</button></div></div></article>';
  });
  $('itin').innerHTML=h;
}

// ---- 照片處理：讀取拍攝時間、縮圖、移除定位資訊 ----
async function prepPhoto(file){
  var taken=null;
  try{
    var ex=await exifr.parse(file,['DateTimeOriginal','CreateDate']);
    var d=ex&&(ex.DateTimeOriginal||ex.CreateDate);
    if(d instanceof Date&&!isNaN(d))taken=d;
  }catch(e){}
  if(!taken&&file.lastModified)taken=new Date(file.lastModified);
  var bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
  var sc=Math.min(1,2000/Math.max(bmp.width,bmp.height)),cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(bmp.width*sc));cv.height=Math.max(1,Math.round(bmp.height*sc));
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  var blob=await new Promise(function(res){cv.toBlob(res,'image/jpeg',0.85)});
  if(!blob)throw new Error('無法處理這張照片');
  return {blob:blob,taken:taken};
}
on('upGo','click',async function(){
  var files=[].slice.call($('upFiles').files||[]);
  if(!files.length){$('upSt').textContent='請先選擇照片。';return}
  var btn=$('upGo'),day=parseInt($('upDay').value,10)||null,cap=$('upCap').value.trim(),ok=0,fail=0;
  btn.disabled=true;
  for(var i=0;i<files.length;i++){
    $('upSt').textContent='上傳中 '+(i+1)+' / '+files.length+'…';
    try{
      var pp=await prepPhoto(files[i]);
      var path=TID+'/'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+i)+'.jpg';
      var up=await sb.storage.from('trip-photos').upload(path,pp.blob,{contentType:'image/jpeg'});
      if(up.error)throw up.error;
      var ins=await sb.from('trip_photos').insert({trip_id:TID,user_email:ME.email,path:path,caption:cap||null,day_no:day,taken_at:pp.taken?pp.taken.toISOString():null});
      if(ins.error){await sb.storage.from('trip-photos').remove([path]);throw ins.error}
      ok++;
    }catch(err){fail++;console.warn(err)}
  }
  btn.disabled=false;
  $('upFiles').value='';$('upCap').value='';
  try{await refresh()}catch(e){}
  $('upSt').innerHTML='已上傳 '+ok+' 張'+(fail?'，失敗 '+fail+' 張':'')+'。照片連結已更新：<a class="maplink" href="slideshow.html?trip='+TID+'" target="_blank" rel="noopener">開啟幻燈片（依拍照時間排序）</a>';
});
on('photos','click',delPhoto);
on('itin','click',async function(e){
  var b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.delNote){
    var r=await sb.from('trip_notes').delete().eq('id',b.dataset.delNote);
    if(!r.error)await refresh();
  }else if(b.dataset.noteAdd){
    var inp=document.querySelector('input[data-note-in="'+b.dataset.noteAdd+'"]'),v=inp.value.trim();
    if(!v)return;
    b.disabled=true;
    var ins=await sb.from('trip_notes').insert({trip_id:TID,user_email:ME.email,day_no:+b.dataset.noteAdd,body:v});
    b.disabled=false;
    if(!ins.error)await refresh();else alert('送出失敗：'+ins.error.message);
  }else delPhoto(e);
});
async function delPhoto(e){
  var b=e.target.closest('button[data-del-photo]');
  if(!b)return;
  var id=b.dataset.delPhoto,p=PHOTOS.filter(function(x){return x.id===id})[0];
  if(!p||!confirm('確定刪除這張照片？'))return;
  var r=await sb.from('trip_photos').delete().eq('id',id);
  if(r.error){alert('刪除失敗：'+r.error.message);return}
  if(p.user_id===ME.id)await sb.storage.from('trip-photos').remove([p.path]);
  await refresh();
}
bootPage();
