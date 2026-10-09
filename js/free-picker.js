// ================= 自行安排的空檔：從同地區挑選景點／餐廳 =================
// 「自行安排行程」：先選風格（不含美食），再選子分類，列出同地區的景點清單可直接加入。
// 「自行安排用餐」：只列同地區的美食，可再選子分類。
var PKR=null;   // {no,idx,mode:'sight'|'food',city,dn,sty,tag,q}
var PK_ICON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h8M3 6h.01M3 12h.01M3 18h.01"/><path d="M19 15v6M16 18h6"/></svg>';
function openFreePicker(no,idx,mode){
  var p=plan(),d=p.days.filter(function(x){return x.no===no})[0];
  if(!d||!d.city)return;
  var ds=[];
  d.rows.forEach(function(r){if(r.type==='sight'&&r.s&&ds.indexOf(r.s.dist)<0)ds.push(r.s.dist)});
  var s=ensureSel(d.city),all=Object.keys(C[d.city].d).concat(s.cd);
  PKR={no:no,idx:idx,mode:mode,city:d.city,dn:ds[0]||s.d[0]||all[0]||'',sty:'',tag:'',q:''};
  renderPicker();
}
function closePicker(){var m=document.getElementById('freePick');if(m)m.parentNode.removeChild(m);PKR=null}
function pickerPlaced(){
  var placed={};
  plan().days.forEach(function(d){d.rows.forEach(function(r){if((r.type==='sight'||r.type==='meal')&&r.s)placed[r.s.id]=1})});
  return placed;
}
// 目前地區的候選清單（排除已排入行程的）
function pickerBase(){
  var placed=pickerPlaced(),k=PKR.city;
  return distSpots(k,PKR.dn).filter(function(x){
    return !placed[x.id]&&(PKR.mode==='food'?x.s==='f':x.s!=='f');
  });
}
function renderPicker(){
  if(!PKR)return;
  var k=PKR.city,s=ensureSel(k),all=Object.keys(C[k].d).concat(s.cd),base=pickerBase();
  var styles=Object.keys(STYLE).filter(function(t){return t!=='f'&&base.some(function(x){return x.s===t})});
  if(PKR.sty&&styles.indexOf(PKR.sty)<0)PKR.sty='';
  var byStyle=base.filter(function(x){return PKR.mode==='food'||!PKR.sty||x.s===PKR.sty});
  var tags=[];byStyle.forEach(function(x){if(x.tag&&tags.indexOf(x.tag)<0)tags.push(x.tag)});
  if(PKR.tag&&tags.indexOf(PKR.tag)<0)PKR.tag='';
  var toks=(PKR.q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  var list=byStyle.filter(function(x){return (!PKR.tag||x.tag===PKR.tag)&&(!toks.length||spotMatch(x,toks))});
  var chip=function(attr,val,label,on){return '<button type="button" class="tab'+(on?' on':'')+'" '+attr+'="'+esc(val)+'">'+esc(label)+'</button>'};
  var h='<div class="modal-back" id="freePick"><div class="modal fpm" role="dialog" aria-modal="true" aria-label="挑選景點">'+
    '<div class="modalhead"><b>第 '+PKR.no+' 天・'+(PKR.mode==='food'?'選擇餐廳':'選擇景點')+'</b><button type="button" class="ib" data-fp="close" title="關閉" aria-label="關閉">'+CLOSE_ICON_FP+'</button></div>'+
    '<div class="fprow"><label class="rf"><span>地區</span><select data-fp-dn aria-label="地區">'+all.map(function(dn){return '<option value="'+esc(dn)+'"'+(dn===PKR.dn?' selected':'')+'>'+esc(dn)+'</option>'}).join('')+'</select></label>'+
    '<label class="rf fpq"><span>關鍵字</span><input type="search" data-fp-q value="'+esc(PKR.q)+'" placeholder="名稱、子分類" autocomplete="off"></label></div>';
  if(PKR.mode==='sight'){
    h+='<div class="fprow tabs"><span class="muted">風格</span>'+chip('data-fp-sty','','全部',!PKR.sty)+styles.map(function(t){return chip('data-fp-sty',t,STYLE[t],PKR.sty===t)}).join('')+'</div>';
  }
  if(tags.length)h+='<div class="fprow tabs"><span class="muted">子分類</span>'+chip('data-fp-tag','','全部',!PKR.tag)+tags.map(function(t){return chip('data-fp-tag',t,t,PKR.tag===t)}).join('')+'</div>';
  h+='<p class="muted">同地區「'+esc(PKR.dn)+'」尚未排入行程的'+(PKR.mode==='food'?'餐廳':'景點')+'，共 '+list.length+' 個。</p><div class="fplist">';
  if(!list.length)h+='<p class="muted">沒有符合的項目。可以換個地區、風格或子分類。</p>';
  list.forEach(function(x){
    var im=imgList(x.images)[0];
    h+='<div class="fpitem">'+(im?'<img class="fpimg" loading="lazy" referrerpolicy="no-referrer" src="'+esc(im)+'" alt="" onerror="this.remove()">':'<span class="fpimg"></span>')+
      '<div class="fpinfo"><b>'+esc(x.name)+'</b>'+(x.tag?' <span class="tag">'+esc(x.tag)+'</span>':'')+' '+rateTxt(x)+
      '<div class="meta">'+esc(STYLE[x.s]||'')+'・'+costTxt(x)+'・'+hoursTag(x,PKR.no)+'・停留 '+(x.stay||stayOf(x))+' 分</div></div>'+
      '<button type="button" class="ib" data-fp-add="'+esc(x.id)+'" title="加入第 '+PKR.no+' 天" aria-label="加入 '+esc(x.name)+'">'+AICON_PLUS_FP+'</button></div>';
  });
  h+='</div></div></div>';
  var old=document.getElementById('freePick'),qHad=document.activeElement&&document.activeElement.hasAttribute&&document.activeElement.hasAttribute('data-fp-q');
  if(old)old.outerHTML=h;else document.body.insertAdjacentHTML('beforeend',h);
  if(qHad){var q=document.querySelector('[data-fp-q]');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}}
}
var CLOSE_ICON_FP='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var AICON_PLUS_FP='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
function pickerAdd(id){
  var k=PKR.city,s=ensureSel(k),dn=PKR.dn,no=PKR.no,idx=PKR.idx;
  if(s.d.indexOf(dn)<0){
    s.d.push(dn);
    var all=Object.keys(C[k].d).concat(s.cd);
    s.d.sort(function(a,b){return all.indexOf(a)-all.indexOf(b)});
  }
  delete s.off[id];
  moveSpot(id,no,idx);
  var placed=curLayout().L[no]||[];
  if(placed.indexOf(id)>-1)closePicker();
  else render();   // 同一天已有兩個地區：moveSpot 會顯示原因，視窗保留讓你換一個
}
document.addEventListener('click',function(e){
  if(!PKR)return;
  var t=e.target;
  if(t.id==='freePick'||t.closest('[data-fp=close]')){closePicker();return}
  var a=t.closest('[data-fp-add]');if(a){pickerAdd(a.dataset.fpAdd);return}
  var sty=t.closest('[data-fp-sty]');if(sty){PKR.sty=sty.dataset.fpSty;PKR.tag='';renderPicker();return}
  var tg=t.closest('[data-fp-tag]');if(tg){PKR.tag=tg.dataset.fpTag;renderPicker()}
});
document.addEventListener('change',function(e){
  if(PKR&&e.target.matches&&e.target.matches('[data-fp-dn]')){PKR.dn=e.target.value;PKR.sty='';PKR.tag='';renderPicker()}
});
var fpTimer=null;
document.addEventListener('input',function(e){
  if(PKR&&e.target.matches&&e.target.matches('[data-fp-q]')){PKR.q=e.target.value;clearTimeout(fpTimer);fpTimer=setTimeout(renderPicker,150)}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&PKR)closePicker()});
