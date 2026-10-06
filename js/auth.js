// ================= 登入與註冊 =================
var authMode='login';
function setMsg(el,text,err){el.hidden=!text;el.textContent=text||'';el.className='msg'+(err?' err':'')}
function authErr(m){
  m=String(m||'');
  if(/Invalid login/i.test(m))return '電子郵件或密碼錯誤。';
  if(/not confirmed/i.test(m))return '信箱尚未驗證，請先點擊驗證信中的連結。';
  if(/rate limit/i.test(m))return '寄信過於頻繁，請稍後再試。';
  if(/already registered/i.test(m))return '這個信箱已註冊，請直接登入。';
  if(/provider.*not enabled|unsupported provider/i.test(m))return '此帳號服務尚未啟用，請聯絡管理員。';
  if(/password/i.test(m))return '密碼不符合規定，至少需要 8 個字元。';
  return m||'發生錯誤，請稍後再試。';
}
function setAuthMode(m){
  authMode=m;
  $('tabLogin').classList.toggle('on',m==='login');$('tabSignup').classList.toggle('on',m==='signup');
  $('authTitle').textContent=m==='login'?'登入':'註冊新帳號';
  $('authBtn').textContent=m==='login'?'登入':'註冊';
  $('apass2Wrap').hidden=m==='login';$('apass2').required=m==='signup';
  $('apass').autocomplete=m==='login'?'current-password':'new-password';
  setMsg($('authMsg'),'');
}
on('tabLogin','click',function(){setAuthMode('login')});
on('tabSignup','click',function(){setAuthMode('signup')});
function oauthRedirectUrl(){return location.origin+location.pathname+location.search}
async function oauthLogin(provider){
  var buttons=[$('oauthGoogle'),$('oauthGithub')];
  buttons.forEach(function(button){button.disabled=true});
  setMsg($('authMsg'),'正在前往帳號服務授權…');
  try{
    var result=await sb.auth.signInWithOAuth({provider:provider,options:{redirectTo:oauthRedirectUrl()}});
    if(result.error)throw result.error;
  }catch(err){
    buttons.forEach(function(button){button.disabled=false});
    setMsg($('authMsg'),authErr(err.message),true);
  }
}
on('oauthGoogle','click',function(){oauthLogin('google')});
on('oauthGithub','click',function(){oauthLogin('github')});
on('authForm','submit',async function(e){
  e.preventDefault();
  var em=$('aemail').value.trim(),pw=$('apass').value,btn=$('authBtn');
  if(authMode==='signup'&&pw!==$('apass2').value){setMsg($('authMsg'),'兩次輸入的密碼不一樣。',true);return}
  btn.disabled=true;setMsg($('authMsg'),'處理中…');
  try{
    if(authMode==='login'){
      var r=await sb.auth.signInWithPassword({email:em,password:pw});
      if(r.error)throw r.error;
      if(!r.data.user.email_confirmed_at){await sb.auth.signOut();throw new Error('not confirmed')}
      await enter(r.data.user);
    }else{
      var s=await sb.auth.signUp({email:em,password:pw,options:{emailRedirectTo:SITE_URL}});
      if(s.error)throw s.error;
      if(s.data.session)await sb.auth.signOut();
      setMsg($('authMsg'),'驗證信已寄到 '+em+'，請點擊信中的連結完成註冊，之後回來登入。沒收到請檢查垃圾信件。');
      $('apass').value='';$('apass2').value='';
    }
  }catch(err){setMsg($('authMsg'),authErr(err.message),true)}
  btn.disabled=false;
});
on('logout','click',async function(){await flush();await sb.auth.signOut();showAuth()});
function showAuth(msg){
  ME=null;TRIP=null;TRIPS=[];
  $('boot').hidden=true;$('app').hidden=true;$('auth').hidden=false;
  if(msg)setMsg($('authMsg'),msg,true);
}
