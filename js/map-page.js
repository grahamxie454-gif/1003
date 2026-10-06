// ================= 當日地點位置（只標位置，不規劃路線） =================
// 資料放在網址 # 後面（不會送到伺服器）。有設定 GMAPS_KEY 時用 Google 地圖顯示所有標記；
// 沒有金鑰時，只列出每個地點，並提供各自的 Google 地圖連結。
(function(){
  var data={t:'',s:[]};
  try{
    var h=location.hash.slice(1).replace(/-/g,'+').replace(/_/g,'/');
    while(h.length%4)h+='=';
    data=JSON.parse(decodeURIComponent(escape(atob(h))));
  }catch(e){}
  var stops=(data.s||[]).filter(function(x){return x&&x.n});
  if(data.t)$('mTitleH').textContent=data.t+'・所有地點';
  document.title=(data.t||'當日')+'・地點位置';
  function plainLink(s){
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(typeof s.la==='number'?s.la+','+s.lo:(s.q||s.n));
  }
  $('stops').innerHTML=stops.map(function(s){
    return '<li><span class="no'+(s.k==='H'?' h':'')+'">'+(s.k==='H'?'H':s.i)+'</span><span>'+esc(s.n)+'</span> '+iconLink(plainLink(s),ICON_PIN,'在 Google 地圖開啟 '+s.n)+'</li>';
  }).join('')||'<li class="muted">沒有可顯示的地點。</li>';
  if(!stops.length)return;
  if(!GMAPS_KEY){
    $('mHint').textContent='尚未設定 Google 地圖金鑰（js/core.js 的 GMAPS_KEY），所以無法在同一張地圖上顯示所有標記。可以點下方每個地點旁的圖示，在 Google 地圖個別開啟。';
    return;
  }
  $('gmap').hidden=false;
  window.__initMap=async function(){
    try{
      var maps=await google.maps.importLibrary('maps'),places=await google.maps.importLibrary('places');
      var map=new maps.Map($('gmap'),{center:{lat:35,lng:135},zoom:5,mapTypeControl:false,streetViewControl:false});
      var bounds=new google.maps.LatLngBounds(),info=new google.maps.InfoWindow(),n=0;
      for(var i=0;i<stops.length;i++){
        var s=stops[i],pos=null;
        if(typeof s.la==='number')pos={lat:s.la,lng:s.lo};
        else{
          try{
            var r=await places.Place.searchByText({textQuery:s.q||s.n,fields:['location'],maxResultCount:1});
            if(r.places&&r.places[0]&&r.places[0].location)pos=r.places[0].location.toJSON();
          }catch(e){}
        }
        if(!pos)continue;
        var m=new google.maps.Marker({map:map,position:pos,title:s.n,label:{text:s.k==='H'?'H':String(s.i),color:'#fff',fontWeight:'700'}});
        (function(m,s){m.addListener('click',function(){
          info.setContent('<b>'+esc(s.n)+'</b><br><a href="'+esc(plainLink(s))+'" target="_blank" rel="noopener">在 Google 地圖開啟</a>');
          info.open(map,m);
        })})(m,s);
        bounds.extend(pos);n++;
      }
      if(n>1)map.fitBounds(bounds,60);else if(n===1){map.setCenter(bounds.getCenter());map.setZoom(15)}
      if(!n)$('mHint').textContent='找不到這些地點的位置，請改用下方清單個別開啟。';
    }catch(err){$('mHint').textContent='地圖載入失敗：'+(err.message||err)+'（請確認金鑰已啟用 Maps JavaScript API 與 Places API (New)，且網址限制包含目前的網站）。'}
  };
  var sc=document.createElement('script');
  sc.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(GMAPS_KEY)+'&v=weekly&language=zh-TW&loading=async&callback=__initMap';
  sc.async=true;
  sc.onerror=function(){$('mHint').textContent='無法載入 Google 地圖，請確認網路與金鑰設定。'};
  document.head.appendChild(sc);
})();
