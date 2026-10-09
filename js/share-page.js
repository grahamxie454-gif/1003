// ================= 行程分享頁 =================
// 照片依「行程項目」上傳：每個景點／餐廳／當地自由行旁邊都有照片按鈕，
// 打開後可新增照片（每張各自填註解）、逐張修改註解或刪除照片。
var TID='',SHARE=null,PHOTOS=[],NOTES=[],ITEMS={},pollTimer=null;
var MOD=null; // {k, name, day, pending:[{file,url,caption}]}

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  TID=tripIdParam();
  if(!TID){$('boot').textContent='連結不正確。';return}
  try{
    var r=await sb.rpc('get_shared_trip',{p_id:TID});
    if(r.error)throw r.error;
    if(!r.data){$('boot').textContent='找不到這份行程，或擁有者尚未開啟分享。';return}
    SHARE=r.data;ME={id:user.id,email:user.email};
    var pf=await sb.from('profiles').select('nickname').eq('id',user.id);
    ME.nickname=pf.data&&pf.data[0]?pf.data[0].nickname:'';
    showWho();
    $('sTitle').textContent=SHARE.name;
    $('sSub').textContent='擁有者：'+(SHARE.owner||'')+'　行程更新：'+fmtDT(SHARE.updated_at);
    $('goSlides').href='slideshow.html?trip='+TID;
    buildItems();
    if(!SHARE.is_owner)sb.rpc('record_shared_visit',{p_trip:TID}).then(function(){},function(){});
    await refresh();
    $('boot').hidden=true;$('app').hidden=false;
    clearInterval(pollTimer);
    pollTimer=setInterval(function(){
      var a=document.activeElement;
      if(!$('modal').hidden)return;
      if(a&&a.closest&&a.closest('#itin'))return;
      refresh().catch(function(){});
    },60000);
  }catch(err){
    $('boot').hidden=false;$('boot').textContent='載入失敗：'+(err.message||err);
  }
}
function buildItems(){
  ITEMS={};
  ((SHARE.share_data&&SHARE.share_data.days)||[]).forEach(function(d){
    d.rows.forEach(function(r){if(r.k)ITEMS[r.k]={name:r.n,day:d.no}});
  });
}

// 景點圖片以資料庫目前的內容為準（分享快照只是行程儲存當下的複本，之後才補的圖片不會在裡面）；自訂景點沒有資料庫紀錄，用快照裡的連結
var IMGMAP={};
async function loadSpotImages(){
  var ids=[],keys={};
  ((SHARE.share_data&&SHARE.share_data.days)||[]).forEach(function(d){d.rows.forEach(function(r){
    var m=r.k&&/^s:[a-z0-9_]+\|(\d+)$/.exec(r.k);
    if(m){ids.push(+m[1]);keys[r.k]=+m[1]}
  })});
  if(!ids.length)return;
  try{
    var q=await sb.from('spots').select('id,images').in('id',ids.filter(function(v,i,a){return a.indexOf(v)===i}));
    if(q.error||!q.data)return;
    var byId={};q.data.forEach(function(x){byId[x.id]=x.images||''});
    Object.keys(keys).forEach(function(k){IMGMAP[k]=byId[keys[k]]||''});
  }catch(e){}
}
async function refresh(){
  await loadSpotImages();
  var res=await Promise.all([loadPhotos(TID),sb.from('trip_notes').select('*').eq('trip_id',TID).order('created_at',{ascending:true})]);
  await loadPeople(TID);
  PHOTOS=res[0];
  if(res[1].error)throw res[1].error;
  NOTES=res[1].data;
  renderShare();
  if(MOD&&!$('modal').hidden)renderModal(true);
}

var SH_S='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var SH_ICON={
  cam:SH_S+'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  up:SH_S+'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>',
  edit:SH_S+'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  save:SH_S+'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  del:SH_S+'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
  x:SH_S+'<path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function money(c){return c>0?'約 NT$ '+(Math.round(c/10)*10).toLocaleString('zh-TW'):''}
function itemPhotos(k){return PHOTOS.filter(function(p){return p.item_key===k})}
function renderShare(){
  var days=(SHARE.share_data&&SHARE.share_data.days)||[],h='';
  if(!days.length)h='<p class="muted">擁有者尚未發佈行程內容。</p>';
  days.forEach(function(d){
    var notes=NOTES.filter(function(n){return n.day_no===d.no});
    h+='<article class="day"><h3>第 '+d.no+' 天'+(d.date?'<em class="date">'+esc(d.date)+'</em>':'')+'<em class="city">'+esc(d.city)+'</em>'+(d.stops&&d.stops.length?' '+iconLink(pinsUrl(d.stops,'第 '+d.no+' 天・'+d.city),ICON_PIN,'在 Google 地圖查看當日所有地點的位置（不規劃路線）'):'')+'</h3>';
    if(d.hotel)h+='<p class="note">住宿：'+(d.hotel.url?'<a class="maplink" href="'+esc(d.hotel.url)+'" target="_blank" rel="noopener">'+esc(d.hotel.name)+'</a>':esc(d.hotel.name))+'</p>';
    if(d.off)h+='<p class="note">今天休息，不安排行程。</p>';
    h+='<ol class="tl">'+d.rows.map(function(r){
      var cls=r.t==='move'||r.t==='hop'?'mv':(r.t==='free'||r.t==='buffer'?'fr':(r.t==='meal'?'ml':''));
      var link=/^https?:\/\//i.test(r.l||'')?r.l:'';
      var ph=r.k?itemPhotos(r.k):[];
      // 第一排：景點圖片（點擊放大）；第二排：上傳的照片（相機圖示旁顯示張數）
      var spotImgs=(r.t==='sight'||r.t==='meal')?thumbsHtml(IMGMAP[r.k]||r.im,r.n):'';
      var tools=r.k?'<div class="mvbar phbar"><button type="button" class="ib phcam" data-ph-open="'+esc(r.k)+'" title="照片（'+ph.length+' 張）：查看'+(ph.length?'與編輯':'')+'" aria-label="照片 '+ph.length+' 張">'+SH_ICON.cam+'<span class="phn">'+ph.length+'</span></button>'+
        '<button type="button" class="ib" data-ph-open="'+esc(r.k)+'" data-ph-up="1" title="上傳照片" aria-label="上傳照片">'+SH_ICON.up+'</button>'+
        (ph.length?'<button type="button" class="ib" data-ph-open="'+esc(r.k)+'" title="編輯照片與註解" aria-label="編輯照片與註解">'+SH_ICON.edit+'</button>':'')+
        ph.slice(0,4).map(function(p){return p.url?'<img class="thumb" data-ph-open="'+esc(r.k)+'" loading="lazy" src="'+esc(p.url)+'" alt="">':''}).join('')+'</div>':'';
      return '<li class="tr '+cls+(r.o?' over':'')+'"><div class="tt">'+minStr(r.s)+(r.e>r.s?'<small>–'+minStr(r.e)+'</small>':'')+'</div><div class="tb">'+
        ((r.t==='move'||r.t==='hop')?'<span class="soft">'+esc(r.n)+'</span>'+(link?' '+iconLink(link,ICON_ROUTE,'路徑（Google 地圖，帶入出發時間）'):''):(link&&r.t!=='move'?'<a class="maplink" href="'+esc(link)+'" target="_blank" rel="noopener"><b>'+esc(r.n)+'</b></a>':(cls==='mv'||cls==='fr'?'<span class="soft">'+esc(r.n)+'</span>':'<b>'+esc(r.n)+'</b>')))+
        (r.r?' <span class="rate">★ '+Number(r.r).toFixed(1)+'</span>':'')+(r.c?' <span class="muted">'+money(r.c)+'</span>':'')+spotImgs+tools+'</div></li>';
    }).join('')+'</ol>';
    h+='<div class="notes"><h4>留言</h4>'+(notes.length?notes.map(function(n){
      return '<p class="note2"><b>'+esc(nameOf(n.user_id,n.user_email))+'</b> <span class="muted">'+esc(fmtDT(n.created_at))+'</span><br>'+esc(n.body)+
        ((n.user_id===ME.id||SHARE.is_owner)?' <button type="button" class="ghost sm x" data-del-note="'+esc(n.id)+'" aria-label="刪除留言">刪除</button>':'')+'</p>';
    }).join(''):'<p class="muted">還沒有留言。</p>')+
      '<div class="noterow"><input type="text" maxlength="500" data-note-in="'+d.no+'" placeholder="寫下這一天的註解或心得" aria-label="第 '+d.no+' 天留言"><button type="button" data-note-add="'+d.no+'">送出</button></div></div></article>';
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

// ---- 行程項目的照片視窗：新增、逐張改註解、刪除 ----
function openModal(k){
  var it=ITEMS[k];if(!it)return;
  if(MOD)MOD.pending.forEach(function(p){URL.revokeObjectURL(p.url)});
  MOD={k:k,name:it.name,day:it.day,pending:[]};
  $('modal').hidden=false;
  renderModal();
  var c=$('mClose');if(c)c.focus();
}
function closeModal(){
  if(MOD)MOD.pending.forEach(function(p){URL.revokeObjectURL(p.url)});
  MOD=null;$('modal').hidden=true;
}
function renderModal(keepPending){
  if(!MOD)return;
  var ph=itemPhotos(MOD.k).sort(function(a,b){return photoTime(a)-photoTime(b)});
  $('mTitle').textContent='第 '+MOD.day+' 天・'+MOD.name;
  var h='<h3>已上傳的照片（'+ph.length+'）</h3>';
  if(!ph.length)h+='<p class="muted">這個行程還沒有照片。</p>';
  ph.forEach(function(p){
    var mine=p.user_id===ME.id;
    h+='<div class="mrow"><a href="slideshow.html?trip='+TID+'&p='+p.id+'" target="_blank" rel="noopener">'+(p.url?'<img src="'+esc(p.url)+'" alt="">':'')+'</a><div class="mcol">'+
      '<input type="text" maxlength="100" data-cap-id="'+esc(p.id)+'" value="'+esc(p.caption||'')+'" placeholder="註解"'+(mine?'':' disabled')+' aria-label="照片註解">'+
      '<span class="muted">'+esc(nameOf(p.user_id,p.user_email))+'・上傳 '+esc(fmtDT(p.created_at))+(p.taken_at?'・拍攝 '+esc(fmtDT(p.taken_at)):'')+'</span>'+
      '<div class="mvbar">'+(mine?'<button type="button" class="ib" data-cap-save="'+esc(p.id)+'" title="儲存註解" aria-label="儲存註解">'+SH_ICON.save+'</button>':'')+
      (mine?'<button type="button" class="ib danger" data-del-photo="'+esc(p.id)+'" title="刪除照片（再按一次確認）" aria-label="刪除照片">'+SH_ICON.del+'</button>':'<span class="muted">只有上傳者能修改或刪除</span>')+'</div></div></div>';
  });
  h+='<h3>新增照片</h3><input type="file" id="mFiles" accept="image/jpeg,image/png,image/webp" multiple aria-label="選擇照片">';
  MOD.pending.forEach(function(p,i){
    h+='<div class="mrow"><img src="'+esc(p.url)+'" alt=""><div class="mcol"><input type="text" maxlength="100" data-pend-cap="'+i+'" value="'+esc(p.caption)+'" placeholder="這張的註解（選填）" aria-label="新照片註解">'+
      '<div class="mvbar"><button type="button" class="ib" data-pend-del="'+i+'" title="移除這張" aria-label="移除這張">'+SH_ICON.x+'</button></div></div></div>';
  });
  if(MOD.pending.length)h+='<div class="mvbar"><button type="button" class="ib phcam" id="mUpload" title="上傳 '+MOD.pending.length+' 張" aria-label="上傳 '+MOD.pending.length+' 張">'+SH_ICON.up+'<span class="phn">'+MOD.pending.length+'</span></button></div>';
  h+='<p class="status" id="mSt"></p>';
  $('mBody').innerHTML=h;
}
on('itin','click',async function(e){
  var o=e.target.closest('[data-ph-open]');
  if(o){openModal(o.dataset.phOpen);if(o.dataset.phUp)setTimeout(function(){var fi=$('mFiles');if(fi)fi.click()},60);return}
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
  }
});
on('mClose','click',closeModal);
on('modal','click',function(e){if(e.target===$('modal'))closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').hidden)closeModal()});
on('mBody','change',function(e){
  var el=e.target;
  if(el.id==='mFiles'){
    [].slice.call(el.files||[]).forEach(function(f){MOD.pending.push({file:f,url:URL.createObjectURL(f),caption:''})});
    renderModal();
  }else if(el.dataset.pendCap!==undefined){
    MOD.pending[+el.dataset.pendCap].caption=el.value.trim();
  }
});
on('mBody','input',function(e){
  if(e.target.dataset.pendCap!==undefined)MOD.pending[+e.target.dataset.pendCap].caption=e.target.value.trim();
});
on('mBody','click',async function(e){
  var b=e.target.closest('button');
  if(!b||!MOD)return;
  var st_=$('mSt');
  if(b.dataset.pendDel!==undefined){
    var gone=MOD.pending.splice(+b.dataset.pendDel,1)[0];
    URL.revokeObjectURL(gone.url);renderModal();
  }else if(b.dataset.capSave){
    var inp=document.querySelector('input[data-cap-id="'+b.dataset.capSave+'"]');
    b.disabled=true;
    var r=await sb.from('trip_photos').update({caption:inp.value.trim()||null}).eq('id',b.dataset.capSave);
    b.disabled=false;
    if(r.error){st_.textContent='儲存失敗：'+r.error.message;return}
    await refresh();
    $('mSt').textContent='註解已儲存。';
  }else if(b.dataset.delPhoto){
    if(!b.dataset.sure){
      b.dataset.sure='1';b.classList.add('armed');st_.textContent='再按一次刪除圖示，確認刪除這張照片。';
      setTimeout(function(){if(b.isConnected){delete b.dataset.sure;b.classList.remove('armed')}},4000);
      return;
    }
    b.disabled=true;
    await deletePhoto(b.dataset.delPhoto,st_);
  }else if(b.id==='mUpload'){
    b.disabled=true;
    var ok=0,fail=0,list=MOD.pending.slice();
    for(var i=0;i<list.length;i++){
      st_.textContent='上傳中 '+(i+1)+' / '+list.length+'…';
      try{
        var pp=await prepPhoto(list[i].file);
        var path=(R2_PHOTO_URL?'r2:':'')+TID+'/'+crypto.randomUUID()+'.jpg';
        await uploadPhotoFile(path,pp.blob);
        var ins=await sb.from('trip_photos').insert({trip_id:TID,user_email:ME.email,path:path,caption:list[i].caption||null,day_no:MOD.day,item_key:MOD.k,taken_at:pp.taken?pp.taken.toISOString():null});
        if(ins.error){await removePhotoFile(path);throw ins.error}
        URL.revokeObjectURL(list[i].url);
        MOD.pending=MOD.pending.filter(function(x){return x!==list[i]});
        ok++;
      }catch(err){fail++;console.warn(err)}
    }
    await refresh();
    renderModal();
    $('mSt').innerHTML='已上傳 '+ok+' 張'+(fail?'，失敗 '+fail+' 張（已保留在清單中，可再試一次）':'')+'。<a class="maplink" href="slideshow.html?trip='+TID+'" target="_blank" rel="noopener">開啟照片幻燈片（依拍照時間排序）</a>';
  }
});
async function deletePhoto(id,msgEl){
  var say=function(t){var el=document.getElementById('mSt')||msgEl;if(el)el.textContent=t};
  var p=PHOTOS.filter(function(x){return x.id===id})[0];
  if(!p){say('找不到這張照片，請重新整理頁面。');return}
  if(p.user_id!==ME.id){say('只有上傳者能刪除這張照片。');return}
  try{
    var r=await sb.from('trip_photos').delete().eq('id',id).select('id');
    if(r.error)throw r.error;
    if(!r.data||!r.data.length)throw new Error('沒有權限刪除，或照片已被刪除');
    var cleanupError=null;
    try{await removePhotoFile(p.path)}catch(err){cleanupError=err}
    await refresh();
    say(cleanupError?'照片已從清單刪除（檔案清除失敗：'+cleanupError.message+'）':'照片已刪除。');
  }catch(err){say('刪除失敗：'+(err.message||err))}
}
bootPage();
function onNickChanged(){renderShare();if(MOD&&!$('modal').hidden)renderModal(true)}
