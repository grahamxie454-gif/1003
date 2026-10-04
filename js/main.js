// ================= 啟動 =================
(async function(){
  try{
    await Promise.all([
      loadView($('auth'),'views/auth.html'),
      loadView($('viewPlan'),'views/plan.html'),
      loadView($('viewShared'),'views/shared.html'),
      loadView($('viewAdmin'),'views/admin.html')
    ]);
  }catch(err){$('boot').textContent='無法載入頁面：'+err.message;return}
  if(!window.supabase){$('boot').textContent='無法載入登入元件，請檢查網路連線。';return}
  sb=window.supabase.createClient(SB_URL,SB_KEY);
  setAuthMode('login');
  sb.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')showAuth()});
  var s=await sb.auth.getSession();
  if(s.data&&s.data.session&&s.data.session.user.email_confirmed_at)await enter(s.data.session.user);else{$('boot').hidden=true;$('auth').hidden=false}
})();
