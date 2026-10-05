// ================= 事件：規劃頁 =================
on('f','change',function(e){
  if(e.target.closest('.adder,.flt'))return;
  var f=new FormData($('f')),nm=e.target.name,sig=JSON.stringify(st.ci);
  if(nm==='co'){var co=f.getAll('co');if(co.length)st.co=co}
  if(nm==='ci')st.ci=f.getAll('ci');
  st.days=autoDays()>0?autoDays():+$('days').value;
  st.styles=f.getAll('styles');
  st.modes=f.getAll('modes');
  st.tier=+f.get('tier');
  st.pace=f.get('pace');
  st.auto=f.get('auto')!==null;
  $('daysOut').textContent=st.days+' 天';
  normalize();
  if(JSON.stringify(st.ci)!==sig){delete st.lay;delete st.fix}
  if(nm==='co'||nm==='ci'){buildStatic();buildCities()}
  render();
});
on('f','click',async function(e){
  var b=e.target.closest('button[data-act]');
  if(!b)return;
  var a=b.dataset.act,k=b.dataset.k;
  if(a==='req'){b.disabled=true;await submitRequest(b.dataset.kind,k);rebuildAll(true);return}
  if(a==='addco'){
    var nm=$('nco').value.trim();if(!nm)return;
    var fl=parseInt($('nfl').value,10);
    CO['u'+(++cuid)]={n:nm,flight:fl>=0?fl:18000,fh:'請自行查詢',season:'請自行查詢',drive:'請自行查詢當地駕駛方向與駕照承認方式。',tips:['請自行查詢簽證、入境與匯率資訊。'],rail:100,custom:true};
  }else if(a==='addci'){
    var cn=$('nci').value.trim();if(!cn)return;
    var km=parseInt($('nkm').value,10),co=$('ncc').value,ck='v'+(++cuid);
    C[ck]={n:cn,co:co,code:'',custom:true,km:km>0?km:150,hotel:[2000,3500,6500],food:[1200,2000,3500],d:{},lat:0,lng:0,pos:{}};
    if(st.co.indexOf(co)<0)st.co.push(co);
    st.ci.push(ck);
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
  if(['delcs','delcd','req','reqcancel'].indexOf(b.dataset.act)>-1){await handleCustomAct(b,k,s);return}
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
    var cost=parseInt($('cc_'+k).value,10),gv=$('cg_'+k).value.trim(),ll=gv?parseLL(gv):null;
    if(gv&&!ll){$('cg_'+k).setCustomValidity('座標格式錯誤');$('cg_'+k).reportValidity();$('cg_'+k).setCustomValidity('');return}
    var spot={id:'x'+(++uid),name:nm,d:$('cl_'+k).value,cost:cost>0?cost:0,s:$('ct_'+k).value||'x'};
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

// 去程與回程航班
var FMSG={out:'',ret:''},FLBUSY={};
function renderFlights(){
  var h='';
  [['out','去程（台灣 → 目的地）','抵達時間決定第 1 天何時開始'],['ret','回程（目的地 → 台灣）','起飛時間決定最後一天何時結束']].forEach(function(L){
    var k=L[0],f=st.fl[k];
    h+='<div class="fl"><b>'+L[1]+'</b>'+
      '<div class="row"><input type="text" data-fk="'+k+'" data-ff="no" value="'+esc(f.no||'')+'" placeholder="航班 例：CI100" maxlength="8" aria-label="'+L[1]+'航班編號">'+
      '<input type="date" data-fk="'+k+'" data-ff="date" value="'+esc(f.date||'')+'" aria-label="'+L[1]+'日期">'+
      '<button type="button" class="ghost" data-fk="'+k+'" data-fact="lookup"'+(FLBUSY[k]?' disabled':'')+'>'+(FLBUSY[k]?'查詢中…':'自動查詢')+'</button></div>'+
      '<div class="row"><input type="text" data-fk="'+k+'" data-ff="from" value="'+esc(f.from||'')+'" placeholder="出發機場" maxlength="20" aria-label="出發機場"><input type="text" data-fk="'+k+'" data-ff="to" value="'+esc(f.to||'')+'" placeholder="抵達機場" maxlength="20" aria-label="抵達機場"></div>'+
      '<div class="row"><label>起飛時間<input type="time" data-fk="'+k+'" data-ff="dep" value="'+esc(f.dep||'')+'"></label><label>降落時間<input type="time" data-fk="'+k+'" data-ff="arr" value="'+esc(f.arr||'')+'"></label></div>'+
      '<p class="fmsg'+(FMSG[k]&&FMSG[k][0]==='!'?' err':'')+'">'+esc((FMSG[k]||'').replace(/^!/,'')||L[2]+'。')+'</p>'+(k==='out'?checkinHtml():'')+'</div>';
  });
  $('flights').innerHTML=h;
}
function checkinHtml(){
  return '<label class="checkin">抵達機場後<select id="checkin" aria-label="第一天的入住方式"><option value="hotel"'+(st.checkin!=='direct'?' selected':'')+'>先到住宿點入住，再從住宿點出發</option><option value="direct"'+(st.checkin==='direct'?' selected':'')+'>從機場直接去第一個行程，晚上再回住宿點</option></select></label>';
}
on('flights','change',function(e){
  if(e.target.id==='checkin'){if(e.target.value==='direct')st.checkin='direct';else delete st.checkin;render();return}
  var el=e.target,k=el.dataset.fk,ff=el.dataset.ff;
  if(!k||!ff)return;
  var v=el.value.trim();
  if(ff==='no')v=v.replace(/\s+/g,'').toUpperCase();
  if(v)st.fl[k][ff]=v;else delete st.fl[k][ff];
  el.value=v;if(ff==='date')syncDays();render();
});
on('flights','click',async function(e){
  var b=e.target.closest('button[data-fact]');
  if(!b)return;
  e.stopPropagation();
  var k=b.dataset.fk,f=st.fl[k];
  if(!f.no||!f.date){FMSG[k]='!請先填航班編號與日期。';renderFlights();return}
  FLBUSY[k]=true;FMSG[k]='';renderFlights();
  try{
    var r=await sb.functions.invoke('trip-tools',{body:{action:'flight',no:f.no,date:f.date}});
    var d=r.data;
    if(r.error||!d)FMSG[k]='!查詢失敗，請手動填入時間。';
    else if(d.error==='not_configured')FMSG[k]='!尚未啟用自動查詢（需先設定航班資料服務金鑰），請手動填入起降時間。';
    else if(d.error)FMSG[k]='!'+d.error+'，請手動填入。';
    else{
      ['from','to','dep','arr'].forEach(function(x){if(d[x])f[x]=d[x]});
      FMSG[k]='已取得：'+(d.from||'')+' '+(d.dep||'')+' → '+(d.to||'')+' '+(d.arr||'')+(d.nextDay?'（跨日抵達，請自行確認第 1 天的安排）':'')+'。時間為預定時刻，請以航空公司為準。';
    }
  }catch(err){FMSG[k]='!查詢失敗，請手動填入時間。'}
  FLBUSY[k]=false;renderFlights();render();
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
on('res','click',function(e){
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

// ===== 新增景點：貼上 Google 地圖連結後，自動帶入名稱（與座標、評分） =====
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
    if(!info||!info.name){setSave(local?'已帶入名稱（無法取得評分與座標）':'讀取連結失敗，請手動輸入名稱。');return}
    PLACEINFO[k]={url:url,info:info};
    if(!nameEl.value.trim()||nameEl.value.trim()===local)nameEl.value=info.name;
    var g=$('cg_'+k);
    if(g&&!g.value.trim()&&typeof info.lat==='number')g.value=info.lat+', '+info.lng;
    setSave('已帶入名稱：'+info.name+(info.rating?'・評分 ★'+info.rating:''));
  }catch(err){setSave(local?'已帶入名稱（無法取得評分與座標）':'讀取連結失敗，請手動輸入名稱。')}
}
on('pick','change',function(e){
  if(e.target.id&&e.target.id.indexOf('cu_')===0)fillFromMapLink(e.target);
});
