// ================= 選擇某一天來編輯／顯示 =================
// 6 天以內用按鈕（再按一次取消、顯示全部）；超過 6 天用下拉選單，預設全部顯示。
function daySelHtml(total,cur){
  if(total<2)return '';
  var h='<div class="daysel" role="group" aria-label="選擇要顯示的日期"><span class="muted">顯示：</span>';
  if(total<=6){
    for(var n=1;n<=total;n++)h+='<button type="button" class="tab'+(cur===n?' on':'')+'" data-daysel="'+n+'" aria-pressed="'+(cur===n)+'" title="'+(cur===n?'再按一次顯示全部':'只顯示第 '+n+' 天')+'">第 '+n+' 天</button>';
  }else{
    h+='<select data-daysel-sel aria-label="選擇日期"><option value="0">全部天數</option>';
    for(var m=1;m<=total;m++)h+='<option value="'+m+'"'+(cur===m?' selected':'')+'>第 '+m+' 天</option>';
    h+='</select>';
  }
  return h+'</div>';
}
// 只留下選到的那一天（cur=0 顯示全部）
function applyDaySel(root,cur){
  if(!root)return;
  [].forEach.call(root.querySelectorAll('article.day[data-no]'),function(a){a.hidden=!!cur&&+a.dataset.no!==cur});
}
