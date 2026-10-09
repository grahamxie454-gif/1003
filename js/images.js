// ================= 景點圖片：小縮圖與放大檢視 =================
// 景點的「圖片連結」欄位可以放多個連結（以逗號分隔），畫面上會接續顯示成小縮圖，點一下就彈出放大檢視。
function imgList(s){
  return String(s||'').split(/[,，\s]+/).filter(function(u){return /^https?:\/\//i.test(u)});
}
// 一排縮圖；title 是景點名稱（給螢幕閱讀器與放大檢視的標題用）
function thumbsHtml(s,title,cls){
  var l=imgList(s);
  if(!l.length)return '';
  var all=esc(l.join(' '));
  return '<div class="ithumbs'+(cls?' '+cls:'')+'">'+l.map(function(u,i){
    return '<img class="ithumb" loading="lazy" referrerpolicy="no-referrer" src="'+esc(u)+'" alt="'+esc(title||'景點圖片')+'" title="點擊放大" data-imgs="'+all+'" data-i="'+i+'" data-t="'+esc(title||'')+'" onerror="this.remove()">';
  }).join('')+'</div>';
}
var LB={list:[],i:0,title:''};
function lbClose(){var m=document.getElementById('lightbox');if(m)m.parentNode.removeChild(m);document.removeEventListener('keydown',lbKey)}
function lbKey(e){
  if(e.key==='Escape')lbClose();
  else if(e.key==='ArrowLeft')lbStep(-1);
  else if(e.key==='ArrowRight')lbStep(1);
}
function lbStep(d){
  if(LB.list.length<2)return;
  LB.i=(LB.i+d+LB.list.length)%LB.list.length;lbPaint();
}
function lbPaint(){
  var im=document.getElementById('lbImg'),cap=document.getElementById('lbCap');
  if(im)im.src=LB.list[LB.i];
  if(cap)cap.textContent=(LB.title?LB.title+'　':'')+(LB.list.length>1?(LB.i+1)+' / '+LB.list.length:'');
}
function lbOpen(list,i,title){
  lbClose();
  LB={list:list,i:i||0,title:title||''};
  var X='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var L='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var R='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var multi=list.length>1;
  document.body.insertAdjacentHTML('beforeend','<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="放大檢視圖片">'+
    '<button type="button" class="ib lbx" id="lbClose" title="關閉" aria-label="關閉">'+X+'</button>'+
    (multi?'<button type="button" class="ib lbn lbp" id="lbPrev" title="上一張" aria-label="上一張">'+L+'</button><button type="button" class="ib lbn lbnx" id="lbNext" title="下一張" aria-label="下一張">'+R+'</button>':'')+
    '<img id="lbImg" alt="" referrerpolicy="no-referrer"><div class="lbcap" id="lbCap"></div></div>');
  lbPaint();
  document.addEventListener('keydown',lbKey);
}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.classList&&t.classList.contains('ithumb')){
    e.preventDefault();
    lbOpen((t.dataset.imgs||'').split(' ').filter(Boolean),+t.dataset.i||0,t.dataset.t||'');
    return;
  }
  if(t.id==='lightbox'||t.id==='lbImg'&&LB.list.length<2||t.closest&&t.closest('#lbClose'))lbClose();
  else if(t.closest&&t.closest('#lbPrev'))lbStep(-1);
  else if(t.closest&&t.closest('#lbNext')||t.id==='lbImg')lbStep(1);
});
