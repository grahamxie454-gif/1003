import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(result={data:{url:'https://accounts.example'}}){
  const elements=new Map();
  for(const id of ['oauthGoogle','oauthGithub','authMsg'])elements.set(id,{disabled:false,hidden:false,textContent:'',className:''});
  let request;
  const context=vm.createContext({
    location:{origin:'https://grahamxie454-gif.github.io',pathname:'/1003/share.html',search:'?trip=trip-id'},
    sb:{auth:{async signInWithOAuth(options){request=options;return result}}},
    $(id){if(!elements.has(id))elements.set(id,{classList:{toggle(){}},hidden:false,required:false,textContent:'',value:'',disabled:false});return elements.get(id)},
    on(){},SITE_URL:'https://grahamxie454-gif.github.io/1003/',ME:null,TRIP:null,TRIPS:[]
  });
  vm.runInContext(fs.readFileSync(new URL('../js/auth.js',import.meta.url),'utf8'),context);
  return {context,elements,request:()=>request};
}

test('OAuth login preserves the current deep link',async()=>{
  const f=fixture();
  await f.context.oauthLogin('google');
  assert.equal(f.request().provider,'google');
  assert.equal(f.request().options.redirectTo,'https://grahamxie454-gif.github.io/1003/share.html?trip=trip-id');
  assert.equal(f.elements.get('oauthGoogle').disabled,true);
  assert.equal(f.elements.get('oauthGithub').disabled,true);
});

test('OAuth errors restore buttons and show a useful provider message',async()=>{
  const f=fixture({error:new Error('Provider not enabled')});
  await f.context.oauthLogin('github');
  assert.equal(f.elements.get('oauthGoogle').disabled,false);
  assert.equal(f.elements.get('oauthGithub').disabled,false);
  assert.equal(f.elements.get('authMsg').textContent,'此帳號服務尚未啟用，請聯絡管理員。');
  assert.equal(f.elements.get('authMsg').className,'msg err');
});
