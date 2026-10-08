// Fetch the small configuration afresh so code changes invalidate old sessions on reload.
const {ACCESS_CONFIG}=await import(`./access-config.js?revision=${Date.now()}`);

// A lightweight welcome gate for a static demo, not server authorization.
const KEY='japan-bess-demo-access';
const entry=document.getElementById('access-entry');
const shell=document.getElementById('research-shell');
const form=document.getElementById('access-form');
const input=document.getElementById('access-code');
const error=document.getElementById('access-error');
const button=document.getElementById('access-submit');
const researchTitle=document.title;
let memorySession,expiryTimer,appPromise,busy=false;

function readSession(){
  try{return JSON.parse(localStorage.getItem(KEY))??memorySession;}catch{return memorySession;}
}
function valid(session){
  return session?.codeHash===ACCESS_CONFIG.codeHash&&Number.isFinite(session.expiresAt)&&session.expiresAt>Date.now()&&session.expiresAt<=Date.now()+ACCESS_CONFIG.sessionHours*3600000;
}
function lock(){
  clearTimeout(expiryTimer);
  document.documentElement.dataset.accessState='locked';
  shell.hidden=true;shell.inert=true;
  if(!entry.isConnected)document.body.prepend(entry);
  document.title='日本电力市场与储能研究';
  input.value='';input.removeAttribute('aria-invalid');error.textContent='';
  button.disabled=false;button.textContent='进入研究';
  requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
async function enter(session){
  clearTimeout(expiryTimer);
  entry.remove();shell.hidden=false;shell.inert=false;
  document.documentElement.dataset.accessState='open';document.title=researchTitle;
  // Preserve the original hash, including a module deep link.
  expiryTimer=setTimeout(lock,Math.max(0,session.expiresAt-Date.now()));
  appPromise??=import('./app.js?v=2-8-nav-20261008-2');
  try{await appPromise;}catch{
    appPromise=undefined;
    const loading=document.getElementById('loading');loading.hidden=false;
    loading.textContent='研究页面暂时未能载入，请刷新重试。';
  }
  document.getElementById('main').focus({preventScroll:true});
}
input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');error.textContent='';});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  busy=true;button.disabled=true;button.textContent='正在验证…';error.textContent='';
  try{
    const candidate=input.value.trim().toUpperCase();
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate));
    const hash=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==ACCESS_CONFIG.codeHash){
      input.setAttribute('aria-invalid','true');error.textContent='访问码不正确，请重新输入。';
      input.focus();input.select();return;
    }
    const session={codeHash:ACCESS_CONFIG.codeHash,expiresAt:Date.now()+ACCESS_CONFIG.sessionHours*3600000};
    memorySession=session;
    try{localStorage.setItem(KEY,JSON.stringify(session));}catch{/* Current visit still works when browser storage is disabled. */}
    input.value='';await enter(session);
  }catch{
    error.textContent='暂时无法验证，请刷新页面后重试。';
  }finally{busy=false;button.disabled=false;button.textContent='进入研究';}
});
window.addEventListener('storage',event=>{
  if(event.key!==KEY)return;
  const session=readSession();
  if(valid(session)){memorySession=session;enter(session);}else{memorySession=undefined;lock();}
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&document.documentElement.dataset.accessState==='open'&&!valid(readSession()))lock();
});
const session=readSession();
if(valid(session))enter(session);else lock();
