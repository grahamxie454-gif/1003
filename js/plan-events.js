// ================= 事件：規劃頁 =================
on('f','change',function(e){
  if(e.target.closest('.adder,.flt'))return;
  var f=new FormData($('f')),nm=e.target.name,sig=JSON.stringify(st.ci);
  if(nm==='ci'){
    // 只更新「目前列出的國家」的城市，其餘（航班尚未設好時暫存的）保持不動
    var now=f.getAll('ci').concat(arrivalCities(),departureCities()),listed=Object.keys(C).filter(function(k){return st.co.indexOf(C[k].co)>-1});
    st.ci=mergeOrder(st.ci.filter(function(k){return listed.indexOf(k)<0||now.indexOf(k)>-1}),now);
  }
  st.days=autoDays()>0?autoDays():(st.days||5);
  st.styles=f.getAll('styles');
  st.modes=f.getAll('modes');
  st.tier=+f.get('tier');
  st.pace=f.get('pace');

  normalize();
  if(JSON.stringify(st.ci)!==sig){delete st.lay;delete st.fix;delete st.fixSeq}
  if(nm==='ci'){buildStatic();buildCities();renderOrder()}
  render();
});
on('f','click',async function(e){
  var b=e.target.closest('button[data-act]');
  if(!b)return;
  var a=b.dataset.act,k=b.dataset.k;
  if(a==='req'){b.disabled=true;await submitRequest(b.dataset.kind,k);rebuildAll(true);return}
  if(a==='addco'){
    var nm=$('nco').value.trim();if(!nm)return;

    CO['u'+(++cuid)]={n:nm,fh:'請自行查詢',season:'請自行查詢',drive:'請自行查詢當地駕駛方向與駕照承認方式。',tips:['請自行查詢簽證、入境與匯率資訊。'],rail:100,custom:true};
  }else if(a==='addci'){
    var cn=$('nci').value.trim();if(!cn)return;
    var km=parseInt($('nkm').value,10),co=$('ncc').value,ck='v'+(++cuid);
    C[ck]={n:cn,co:co,code:'',season:'請自行查詢',custom:true,km:km>0?km:150,hotel:[2000,3500,6500],food:[1200,2000,3500],d:{},lat:0,lng:0,pos:{}};
    if(st.co.indexOf(co)>-1)st.ci.push(ck);
  }else if(a==='delco'){
    Object.keys(C).forEach(function(x){if(C[x].co===k)delete C[x]});
    delete CO[k];
  }else if(a==='delci'){
    delete C[k];
  }else if(a==='reset'){
    Object.keys(CO).forEach(function(x){if(CO[x].custom)delete CO[x]});
    Object.keys(C).forEach(function(x){if(C[x].custom)delete C[x]});
    st=DEF();sel={};DAYS={};OPEN={};
  }
  rebuildAll();
});
on('pick','change',function(e){
  var el=e.target,k=el.dataset.k;
  if(!k)return;
  var s=ensureSel(k);
  if(el.dataset.t){
    distSpots(k,el.dataset.d).filter(function(x){return x.s===el.dataset.t}).forEach(function(x){
      if(el.checked)delete s.off[x.id];else s.off[x.id]=1;
    });
    if(el.checked&&s.d.indexOf(el.dataset.d)<0&&el.dataset.d)s.d.push(el.dataset.d);
  }else if(el.dataset.d!==undefined){
    var d=el.dataset.d,i=s.d.indexOf(d);
    if(el.checked&&i<0)s.d.push(d);
    if(!el.checked&&i>-1)s.d.splice(i,1);
    var all=Object.keys(C[k].d).concat(s.cd);
    s.d.sort(function(a,b){return all.indexOf(a)-all.indexOf(b)});
  }else if(el.dataset.id){
    if(el.checked)delete s.off[el.dataset.id];else s.off[el.dataset.id]=1;
  }
  render();
});
on('pick','click',async function(e){
  var tg=e.target.closest('button[data-tk]');
  if(tg){var key=tg.dataset.tk;TOPEN[key]=!(tg.getAttribute('aria-expanded')==='true');renderPick();return}
  var b=e.target.closest('button[data-act]');
  if(!b)return;
  var k=b.dataset.k,s=ensureSel(k);
  if(['delcs','delcd','req','reqcancel','reqtoggle'].indexOf(b.dataset.act)>-1){await handleCustomAct(b,k,s);return}
  if(b.dataset.act==='addd'){
    var v=$('cd_'+k).value.trim();
    if(!v)return;
    if(Object.keys(C[k].d).concat(s.cd).indexOf(v)<0)s.cd.push(v);
    if(s.d.indexOf(v)<0)s.d.push(v);
  }else if(b.dataset.act==='adds'){
    var nm=$('cs_'+k).value.trim(),url=$('cu_'+k).value.trim(),info=null;
    if(url){
      if(!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(url)){setSave('請貼上 Google 地圖的分享連結。');return}
      if(PLACEINFO[k]&&PLACEINFO[k].url===url)info=PLACEINFO[k].info;
      else{
        b.disabled=true;setSave('正在讀取 Google 地圖連結…');
        try{
          var r=await sb.functions.invoke('trip-tools',{body:{action:'place',url:url}});
          info=r.data&&!r.data.error?r.data:null;
        }catch(err){info=null}
        b.disabled=false;
      }
    }
    if(!nm&&info&&info.name)nm=info.name;
    if(!nm){setSave('請輸入地點名稱，或貼上含名稱的 Google 地圖連結。');return}
    var sp0=info?placeToSpot(info,k,s.d):null;   // 還沒自動帶入就按新增時，用連結的資料補齊空白欄位
    var cost=parseInt($('cc_'+k).value,10),gv=$('cg_'+k).value.trim(),ll=gv?parseLL(gv):null;
    if(gv&&!ll){$('cg_'+k).setCustomValidity('座標格式錯誤');$('cg_'+k).reportValidity();$('cg_'+k).setCustomValidity('');return}
    if(isNaN(cost)&&sp0)cost=sp0.cost;
    var spot={id:'x'+(++uid),name:nm,d:$('cl_'+k).value||(sp0&&sp0.district)||'',cost:cost>0?cost:0,s:$('ct_'+k).value||'x'};
    if(spot.s==='x'&&sp0&&sp0.s!=='x')spot.s=sp0.s;
    var tg=$('ctag_'+k).value.trim()||(sp0&&sp0.tag)||'';if(tg)spot.tag=tg.slice(0,12);
    var sty=parseInt($('cst_'+k).value,10);if(isNaN(sty)&&sp0)sty=sp0.stay;if(sty>=15&&sty<=720)spot.stay=sty;
    var hr=$('chr_'+k).value.trim();
    if(!hr&&info&&info.hours)hr=info.hours;
    if(hr){if(!parseHours(hr)){setSave('營業時間格式不正確，請參考：一-五 10:00-18:00;六日 10:00-20:00;二休');return}spot.hours=hr.slice(0,300)}
    if(url)spot.url=url;
    if(!ll&&info&&typeof info.lat==='number')ll=[info.lat,info.lng];
    if(ll){spot.lat=ll[0];spot.lng=ll[1]}
    if(info&&info.rating)spot.rating=info.rating;
    s.cs.push(spot);
  }
  render();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.matches('.addrow input')){
    e.preventDefault();
    var b=e.target.parentNode.querySelector('button[data-act]');
    if(b)b.click();
  }
});
// 每日：自駕、出發與回程時間、住宿
function dayRec(no){if(!DAYS[no])DAYS[no]={};return DAYS[no]}
// 回傳 [緯度, 經度, 來源]：pin＝地點標記；view＝地圖畫面中心（可能與地點有距離）
function mapCoords(u){
  var last=null,m,re=/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g;
  while((m=re.exec(u)))last=m;
  if(last)return [+last[1],+last[2],'pin'];
  m=u.match(/[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/);
  if(m)return [+m[1],+m[2],'pin'];
  m=u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m?[+m[1],+m[2],'view']:null;
}
function mapName(u){
  var m=u.match(/\/maps\/place\/([^/@?]+)/);
  if(!m)return '';
  try{return decodeURIComponent(m[1].replace(/\+/g,' '))}catch(e){return ''}
}
var SRC_TXT={places:'已用 Google 地點資料取得住宿位置（最精準）。',pin:'已取得連結中的地點標記位置。',view:'座標只取得到地圖畫面的中心點，可能與飯店有一小段距離。建議在 Google 地圖點選飯店後再按「分享」，重新貼上連結，並按「重新取得位置」。'};
async function resolveHotel(no,url){
  HMSG[no]='正在取得住宿位置…';
  var h0=DAYS[no]&&DAYS[no].hotel;if(h0&&h0.url===url)render(true);
  var d=null,failed=false;
  try{
    var r=await sb.functions.invoke('trip-tools',{body:{action:'place',url:url}});
    d=r.data;
    if(r.error||!d||typeof d.lat!=='number'){failed=true;d=null}
  }catch(err){failed=true}
  // 同一個連結的每一天（連住同一間飯店）一起更新
  Object.keys(DAYS).forEach(function(n){
    var h=DAYS[n]&&DAYS[n].hotel;
    if(!h||h.url!==url)return;
    if(d){h.lat=d.lat;h.lng=d.lng;h.hsrc=d.src||'view';if(!h.name&&d.name)h.name=d.name}
    else if(typeof h.lat==='number'&&!h.hsrc)h.hsrc='view';
  });
  var cur=DAYS[no]&&DAYS[no].hotel;
  if(cur&&cur.url===url)HMSG[no]=d?(SRC_TXT[d.src]||''):(typeof cur.lat==='number'?SRC_TXT.view:'無法自動取得座標；地圖連結會改用飯店名稱搜尋，移動時間以估計值計算。');
  OPEN[no]=true;render();
}
// 舊行程的住宿座標可能只是地圖畫面中心（常是城市中心），開啟行程時自動用 Google 地點資料重新核對一次
var HTRIED={};
async function refreshLegacyHotels(){
  var urls={};
  Object.keys(DAYS).forEach(function(n){
    var h=DAYS[n]&&DAYS[n].hotel;
    if(h&&h.url&&!h.hsrc&&!HTRIED[h.url]&&!urls[h.url])urls[h.url]=n;
  });
  var list=Object.keys(urls).slice(0,5);
  for(var i=0;i<list.length;i++){HTRIED[list[i]]=1;await resolveHotel(urls[list[i]],list[i])}
}
on('res','toggle',function(e){
  var el=e.target;if(el.matches&&el.matches('details.dd'))OPEN[el.dataset.no]=el.open;
},true);
on('res','change',function(e){
  var el=e.target,no=el.dataset.no,f=el.dataset.f;
  if(!no||!f)return;
  var d=dayRec(no),resolveUrl=null;
  if(f==='drive')d.drive=el.checked;
  else if(f==='off'){if(el.checked)d.off=true;else delete d.off}
  else if(f==='start'||f==='end'){
    if(el.value&&toMin(el.value)===null){return}
    if(el.value)d[f]=el.value;else delete d[f];
    var tt=dayTimes(+no);
    if(tt.end-tt.start<240){delete d[f];el.value='';el.setCustomValidity('出發與回住宿時間至少相隔 4 小時');el.reportValidity();el.setCustomValidity('');return}
  }
  else if(f==='tour'){d.tour=d.tour||{};d.tour.on=el.checked}
  else if(f==='tname'){d.tour=d.tour||{};d.tour.name=el.value.trim()}
  else if(f==='tcost'){d.tour=d.tour||{};var tcv=parseInt(el.value,10);if(tcv>0)d.tour.cost=tcv;else delete d.tour.cost}
  else if(f==='turl'){
    d.tour=d.tour||{};var tu=el.value.trim();
    if(!tu)delete d.tour.url;
    else if(/^https?:\/\//i.test(tu))d.tour.url=tu;
    else{el.value='';delete d.tour.url;el.setCustomValidity('請貼上以 http 或 https 開頭的網址');el.reportValidity();el.setCustomValidity('')}
  }
  else if(f==='hname'){d.hotel=d.hotel||{};d.hotel.name=el.value.trim()}
  else if(f==='hcost'){d.hotel=d.hotel||{};var c=parseInt(el.value,10);if(c>0)d.hotel.cost=c;else delete d.hotel.cost}
  else if(f==='hurl'){
    d.hotel=d.hotel||{};var v=el.value.trim();OPEN[no]=true;
    delete d.hotel.lat;delete d.hotel.lng;delete d.hotel.hsrc;HMSG[no]='';
    if(!v)delete d.hotel.url;
    else if(!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(v)){
      delete d.hotel.url;HMSG[no]='請貼上 Google 地圖的分享連結（https://maps.app.goo.gl/… 或 google.com/maps/…）。';
    }else{
      d.hotel.url=v;
      var ll=mapCoords(v);
      if(ll){d.hotel.lat=ll[0];d.hotel.lng=ll[1];d.hotel.hsrc=ll[2];if(!d.hotel.name)d.hotel.name=mapName(v)}
      resolveUrl=v;
    }
  }
  render();
  if(resolveUrl)resolveHotel(no,resolveUrl);
});

// 時間軸：拖曳、上下移、移到其他天 → 記錄手動順序，其餘由系統重排時間
function curLayout(){
  var L={},M={},p=plan();
  p.days.forEach(function(d){L[d.no]=[];d.rows.forEach(function(r){if((r.type==='sight'||r.type==='meal')&&r.s){L[d.no].push(r.s.id);M[r.s.id]=r.s}})});
  Object.keys(p.pool).forEach(function(k){p.pool[k].forEach(function(s){M[s.id]=s})});
  return {L:L,M:M};
}
function moveSpot(id,toDay,idx){
  var c=curLayout(),L=c.L,s=c.M[id];
  if(st.fix&&st.fix[id]){setSave('這個項目已固定，請先解除固定。');return}
  Object.keys(L).forEach(function(n){L[n]=L[n].filter(function(x){return x!==id})});
  if(toDay!=='pool'){
    if(!L[toDay])return;
    if(s&&!isFood(s)){
      var ds=[];
      L[toDay].forEach(function(i){var x=c.M[i];if(x&&!isFood(x)&&ds.indexOf(x.dist)<0)ds.push(x.dist)});
      if(ds.indexOf(s.dist)<0&&ds.length>=2){setSave('這天已經安排兩個地區（'+ds.join('、')+'），不能再加入第三個地區的景點。');return}
    }
    L[toDay].splice(Math.max(0,Math.min(idx,L[toDay].length)),0,id);
  }
  st.lay=L;render();
}
var DRAG=null;
function dropIdx(ol,y){
  return [].slice.call(ol.querySelectorAll('li.sg:not(.dragging)')).filter(function(li){var r=li.getBoundingClientRect();return y>r.top+r.height/2}).length;
}
function clearMarks(){[].forEach.call(document.querySelectorAll('.dropbefore,.dropend'),function(x){x.classList.remove('dropbefore','dropend')})}
on('res','dragstart',function(e){
  var li=e.target.closest&&e.target.closest('li.sg');if(!li)return;
  DRAG={id:li.dataset.id,city:li.dataset.city};
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',li.dataset.id);
  setTimeout(function(){li.classList.add('dragging')},0);
});
on('res','dragend',function(){DRAG=null;clearMarks();[].forEach.call(document.querySelectorAll('.dragging'),function(x){x.classList.remove('dragging')})});
on('res','dragover',function(e){
  if(!DRAG)return;
  var ol=e.target.closest('ol.tl');if(!ol||ol.dataset.city!==DRAG.city||ol.dataset.off)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';
  clearMarks();
  var lis=[].slice.call(ol.querySelectorAll('li.sg:not(.dragging)')),i=dropIdx(ol,e.clientY);
  if(i<lis.length)lis[i].classList.add('dropbefore');else ol.classList.add('dropend');
});
on('res','drop',function(e){
  if(!DRAG)return;
  var ol=e.target.closest('ol.tl');if(!ol||ol.dataset.city!==DRAG.city||ol.dataset.off)return;
  e.preventDefault();
  var id=DRAG.id,i=dropIdx(ol,e.clientY);
  DRAG=null;clearMarks();
  moveSpot(id,ol.dataset.day,i);
});
on('res','click',async function(e){
  var b=e.target.closest('button[data-act]');
  if(!b)return;
  var a=b.dataset.act,id=b.dataset.id;
  if(a==='up'||a==='down'){
    if(st.fix&&st.fix[id])return;
    var c=curLayout(),L=c.L,arr=L[b.dataset.day]||[],i=arr.indexOf(id),j=a==='up'?i-1:i+1;
    if(i<0||j<0||j>=arr.length)return;
    if(st.fix&&st.fix[arr[j]]){setSave('相鄰的項目已固定，無法交換。');return}
    var t=arr[i];arr[i]=arr[j];arr[j]=t;
    st.lay=L;render();
  }else if(a==='prov'){
    // 這一段改用 Google 或 NAVITIME 估算；已查過就直接用快取，沒查過就只查這一段
    if(b.disabled||ROUTE_BUSY)return;
    st.prov=st.prov||{};
    var pk=b.dataset.fq+'>'+b.dataset.tq;
    st.prov[pk]=b.dataset.p;
    render();
    var dn=+b.dataset.no,pd=plan().days.filter(function(x){return x.no===dn})[0];
    var prow=pd&&pd.rows.filter(function(r){return r.type==='move'&&r.fromQ===b.dataset.fq&&r.toQ===b.dataset.tq})[0];
    if(prow&&!prow.lg.g&&sb){
      ROUTE_BUSY=true;ROUTE_DAY=dn;
      setRouteMsg('正在用 '+(b.dataset.p==='N'?'NAVITIME':'Google 地圖')+' 查詢這一段…');
      var pres;
      try{pres=await askRoutes([prow.lg.req])}catch(err){pres={stop:'路線查詢失敗：'+(err.message||err)}}
      ROUTE_BUSY=false;render(true);
      setRouteMsg(pres.stop||(pres.got?'已更新這一段（'+(b.dataset.p==='N'?'NAVITIME':'Google 地圖')+'）。':'這一段查不到路線，維持估算'+(pres.lastErr?'：'+pres.lastErr:'')+'。'));
    }
  }else if(a==='calcday'){
    calcDay(+b.dataset.no);
  }else if(a==='hrefresh'){
    var hd=dayRec(b.dataset.no);
    if(hd.hotel&&hd.hotel.url){delete hd.hotel.lat;delete hd.hotel.lng;delete hd.hotel.hsrc;OPEN[b.dataset.no]=true;render(true);resolveHotel(b.dataset.no,hd.hotel.url)}
  }else if(a==='gapdel'){
    var gdv=dayRec(b.dataset.no);gdv.gaps=gdv.gaps||{};
    gdv.gaps[b.dataset.key]={del:1};
    render();
  }else if(a==='gaprestore'){
    var gdr=dayRec(b.dataset.no);
    if(gdr.gaps)Object.keys(gdr.gaps).forEach(function(k){if(gdr.gaps[k].del)delete gdr.gaps[k]});
    render();
  }else if(a==='pin'){
    if(!st.lay)st.lay=curLayout().L;
    st.fix=st.fix||{};
    if(st.fix[id])delete st.fix[id];else st.fix[id]=+b.dataset.day;
    render();
  }else if(a==='rm'){
    if(st.fix&&st.fix[id])return;
    var cc=curLayout(),s=cc.M[id];
    if(!s)return;
    ensureSel(s.k).off[id]=1;
    if(st.lay)Object.keys(st.lay).forEach(function(n){st.lay[n]=st.lay[n].filter(function(x){return x!==id})});
    render();
  }
});
on('res','change',function(e){
  var el=e.target;
  if(!el.dataset)return;
  if(el.dataset.tk){
    var dd=dayRec(el.dataset.no),tv=el.value.trim();
    dd.txt=dd.txt||{};
    if(tv)dd.txt[el.dataset.tk]=tv;else delete dd.txt[el.dataset.tk];
    render();return;
  }
  if(el.dataset.gapkey){
    var gv=parseInt(el.value,10),gdd=dayRec(el.dataset.no);
    gdd.gaps=gdd.gaps||{};
    if(gv>=5&&gv<=720)gdd.gaps[el.dataset.gapkey]={m:gv};else delete gdd.gaps[el.dataset.gapkey];
    render();return;
  }
  if(el.dataset.mealmin){
    var mv_=parseInt(el.value,10),mdd=dayRec(el.dataset.no);
    mdd.mealMin=mdd.mealMin||{};
    if(mv_>=15&&mv_<=240)mdd.mealMin[el.dataset.mealmin]=mv_;else delete mdd.mealMin[el.dataset.mealmin];
    render();return;
  }
  if(el.dataset.stay){
    var v=parseInt(el.value,10);
    if(v>=15&&v<=720)st.stay[el.dataset.stay]=v;else delete st.stay[el.dataset.stay];
    render();return;
  }
  if(!el.dataset.mv||!el.value)return;
  moveSpot(el.dataset.mv,el.value,9999);
});


// ===== 地區樹狀清單：拖曳地區調整排程優先順序 =====
var PDRAG=null;
function pClear(){[].forEach.call(document.querySelectorAll('#pick .dropbefore,#pick .dropafter'),function(x){x.classList.remove('dropbefore','dropafter')})}
on('pick','dragstart',function(e){
  var r=e.target.closest&&e.target.closest('.tn.l0[data-dn]');
  if(!r)return;
  PDRAG={k:r.dataset.dk,dn:r.dataset.dn};
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',r.dataset.dn);
});
on('pick','dragend',function(){PDRAG=null;pClear()});
on('pick','dragover',function(e){
  if(!PDRAG)return;
  var r=e.target.closest('.tn.l0[data-dn]');
  if(!r||r.dataset.dk!==PDRAG.k)return;
  e.preventDefault();pClear();
  var b=r.getBoundingClientRect();
  r.classList.add(e.clientY>b.top+b.height/2?'dropafter':'dropbefore');
});
on('pick','drop',function(e){
  if(!PDRAG)return;
  var r=e.target.closest('.tn.l0[data-dn]');
  if(!r||r.dataset.dk!==PDRAG.k)return;
  e.preventDefault();
  var b=r.getBoundingClientRect(),after=e.clientY>b.top+b.height/2,k=PDRAG.k,dn=PDRAG.dn,to=r.dataset.dn;
  PDRAG=null;pClear();
  if(dn===to)return;
  var s=ensureSel(k),list=sortByDord(k,Object.keys(C[k].d).concat(s.cd));
  list=list.filter(function(x){return x!==dn});
  var i=list.indexOf(to);
  list.splice(after?i+1:i,0,dn);
  s.dord=list;
  render();
});

// ===== 新增景點：貼上 Google 地圖連結後，自動帶入名稱、類型、子分類、地區、座標、評分、營業時間、費用與停留時間 =====
var PLACEINFO={};
async function fillFromMapLink(inp){
  var k=inp.id.slice(3),url=inp.value.trim(),nameEl=$('cs_'+k);
  if(!url||!nameEl)return;
  if(!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(url)){setSave('請貼上 Google 地圖的分享連結。');return}
  var local=mapName(url);
  if(local&&!nameEl.value.trim())nameEl.value=local;
  setSave('正在讀取 Google 地圖連結…');
  try{
    var r=await sb.functions.invoke('trip-tools',{body:{action:'place',url:url}});
    var info=r.data&&!r.data.error?r.data:null;
    if(!info||!info.name){setSave(local?'已帶入名稱（無法取得其他資料，請手動填寫）':'讀取連結失敗，請手動輸入名稱。');return}
    PLACEINFO[k]={url:url,info:info};
    // 換了新連結 = 換了一個景點：整張表單的欄位都依這個地點重新帶入
    var sp=placeToSpot(info,k,ensureSel(k).d),put=function(id,v){var el=$(id+k);if(el)el.value=v==null?'':v};
    nameEl.value=sp.name;
    put('cl_',sp.district);
    if(sp.s!=='x')put('ct_',sp.s);
    put('ctag_',sp.tag);
    put('chr_',sp.hours);
    put('cst_',sp.stay);
    put('cc_',sp.cost>0?sp.cost:'');
    if(sp.lat!=null)put('cg_',sp.lat+', '+sp.lng);
    var got=['名稱'];
    if(sp.s!=='x')got.push('類型「'+STYLE[sp.s]+'」'+(sp.tag?'・'+sp.tag:''));
    if(sp.district)got.push('地區「'+sp.district+'」');
    if(sp.lat!=null)got.push('座標');
    if(sp.rating)got.push('評分 ★'+sp.rating);
    if(sp.hours)got.push('營業時間');
    if(sp.cost>0)got.push('每人約 NT$ '+sp.cost+'（估計）');
    got.push('建議停留 '+sp.stay+' 分');
    var miss=[];
    if(sp.s==='x')miss.push('類型');
    if(!sp.hours)miss.push('營業時間');
    if(!(sp.cost>0))miss.push('每人費用（門票或餐費）');
    setSave('已自動帶入：'+got.join('、')+'。'+(miss.length?'Google 沒有提供：'+miss.join('、')+'，可自行補填。':'')+'請確認後按「新增地點」。');
  }catch(err){setSave(local?'已帶入名稱（無法取得其他資料，請手動填寫）':'讀取連結失敗，請手動輸入名稱。')}
}
on('pick','change',function(e){
  if(e.target.id&&e.target.id.indexOf('cu_')===0)fillFromMapLink(e.target);
});

// ===== 國家／城市順序（點選後可自行調整，不依內建資料的排序） =====
function orderChanged(){
  delete st.lay;delete st.fix;delete st.fixSeq;
  normalize();
  buildCities();renderOrder();renderFlights();syncDays();render();
}
function moveOrd(kind,from,to){
  if(from===to||from<0||to<0)return;
  // 國家順序由航班決定，只有城市可以調整（且不能超出自己的國家）
  var a=st.ci[from],b=st.ci[to];
  if(!a||!b||C[a].co!==C[b].co)return;
  var c2=st.ci.splice(from,1)[0];st.ci.splice(to,0,c2);
  orderChanged();
}
on('order','click',function(e){
  var b=e.target.closest('button[data-ord]');
  if(!b)return;
  if(b.dataset.ord==='mv')moveOrd(b.dataset.kind,+b.dataset.i,+b.dataset.i+(+b.dataset.d));
  else if(b.dataset.ord==='auto'){
    st.ci=st.co.reduce(function(a,c){return a.concat(distOrder(st.ci.filter(function(k){return C[k].co===c})))},[]);
    orderChanged();
  }
});
var ODRAG=null;
on('order','dragstart',function(e){
  var li=e.target.closest&&e.target.closest('li[data-kind]');
  if(!li)return;
  ODRAG={kind:li.dataset.kind,i:+li.dataset.i};
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',li.dataset.i);
});
on('order','dragover',function(e){
  var li=ODRAG&&e.target.closest('li[data-kind="'+ODRAG.kind+'"]');
  if(!ODRAG||!li||li.dataset.kind!==ODRAG.kind)return;
  e.preventDefault();
});
on('order','drop',function(e){
  var li=ODRAG&&e.target.closest('li[data-kind="'+ODRAG.kind+'"]');
  if(!ODRAG||!li||li.dataset.kind!==ODRAG.kind)return;
  e.preventDefault();
  var from=ODRAG.i,to=+li.dataset.i,kind=ODRAG.kind;
  ODRAG=null;
  moveOrd(kind,from,to);
});
on('order','dragend',function(){ODRAG=null});

// ===== 景點搜尋 =====
var pickQTimer=null;
on('pickQ','input',function(e){
  PICKQ=e.target.value;
  clearTimeout(pickQTimer);
  pickQTimer=setTimeout(function(){renderPick()},120);
});

// 清除這份行程的自訂內容並重設（按鈕在行程列，圖示）
function resetTrip(){
  Object.keys(CO).forEach(function(x){if(CO[x].custom)delete CO[x]});
  Object.keys(C).forEach(function(x){if(C[x].custom)delete C[x]});
  st=DEF();sel={};DAYS={};OPEN={};
  rebuildAll();
}
