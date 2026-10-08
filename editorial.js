import {esc} from './views.js';
import {isNavigationRoute} from './research-directory.js?v=2-8-nav-20261008-2';
export const MAJORS={
 market_operations:{title:'日本电力市场与储能交易运营研究',subtitle:'电价、交易策略、调频运营与收益测算'},
 project_business:{title:'日本储能项目开发、商业模式与投融资研究',subtitle:'开发流程、合同结构、政策机制、融资与项目风险'}
};
let copyPromise,copy,observer,pending;
export const editorialApplication=[];
export const getEditorial=()=>copyPromise??=fetch('./data/editorial-v2-8.json').then(r=>{if(!r.ok)throw new Error('研究摘要未能载入');return r.json();}).then(x=>copy=x);
export function editorialSummary(item){
 if(!item)return '';
 return `<article class="card editorial-result" data-editorial-summary><h2>${esc(item.headline)}</h2><p>${esc(item.lead)}</p>${item.points?.length?`<ul>${item.points.map(p=>`<li>${esc(typeof p==='string'?p:p.text)}</li>`).join('')}</ul>`:''}${item.essential_note?`<p class="editorial-essential business-footnote">${esc(item.essential_note)}</p>`:''}</article>`;
}
function currentRoute(){
 const hash=location.hash||'#modules';
 if(hash.startsWith('#lab')){const selected=document.querySelector('[data-lab-tab][aria-selected="true"]');return '#lab/'+(selected?.dataset.labTab??hash.split('/')[1]??'anatomy');}
 return hash;
}
function detailsHost(root){
 let host=root.querySelector(':scope > details[data-editorial-methods]');
 if(!host){host=document.createElement('details');host.className='card editorial-methods';host.dataset.editorialMethods='';host.innerHTML='<summary>来源、方法与口径</summary><div class="editorial-details-body"></div>';root.append(host);}
 return host.querySelector('.editorial-details-body');
}
function moveToDetails(root,selectors){
 let destination;
 for(const selector of selectors){
  for(const node of [...root.querySelectorAll(selector)]){
   if(node.closest('[data-editorial-methods]')||node.closest('[data-editorial-summary]')||node===root)continue;
   destination??=detailsHost(root);destination.append(node);
  }
 }
}
function apply(){
 if(!copy)return;
 const route=currentRoute(),view=document.querySelector('.view:not([hidden])');if(!view||!view.querySelector('h1,h2'))return;
 if(isNavigationRoute(route)){view.dataset.editorialReady='true';return;}
 const item=copy.routes?.[route];
 if(item){
  const host=view.querySelector('.research-wrap')??view;
  const edits=(item.copy_changes??[]).map(change=>({change,nodes:[...view.querySelectorAll(change.selector)]}));
  for(const {change,nodes} of edits){
   for(const node of nodes){
    if(node.closest('[data-editorial-methods]')||node.closest('[data-editorial-summary]')||node.textContent.replace(/\s+/g,' ').trim()!==change.before||node.querySelector('input,select,button,a,svg,canvas,table')||node.matches('.metric-value,.business-metric strong'))continue;
    if(change.action==='REWRITE'&&change.after!==change.before){
     if(node.matches('h1')&&item.title)continue;
     node.textContent=change.after;
    }else if(change.action==='MOVE_TO_DETAILS'&&!node.closest('details')){
     detailsHost(host).append(node);
    }else if(['REMOVE','MOVE_TO_BACKEND'].includes(change.action)){
     node.hidden=true;node.dataset.editorialBackend='';
    }
    editorialApplication.push({id:change.id,route,action:change.action});
   }
  }
  if(item.title&&!view.dataset.narrativeReady){const h=view.querySelector('h1');if(h&&h.textContent!==item.title)h.textContent=item.title;}
  const old=view.querySelector('[data-editorial-summary]');
  if(!item.no_summary&&old?.dataset.editorialRoute!==route){old?.remove();const top=view.querySelector('.page-heading,.ops-top,.research-head')??view.firstElementChild;top?.insertAdjacentHTML('afterend',editorialSummary(item));const result=view.querySelector('[data-editorial-summary]');if(result)result.dataset.editorialRoute=route;}
  for(const change of item.rewrites??[]){
   for(const node of view.querySelectorAll(change.selector)){
    if(node.closest('[data-editorial-methods]'))continue;
    if(!change.before||node.textContent.trim()===change.before){if(node.textContent!==change.after)node.textContent=change.after;}
   }
  }
  for(const change of item.body_rewrites??[]){
   for(const node of view.querySelectorAll('h2,h3,p,small,figcaption')){
    if(node.closest('[data-editorial-methods]')||node.closest('[data-editorial-summary]')||node.textContent.trim()!==change.before||node.querySelector('input,select,button,a'))continue;
    if(change.after!==change.before)node.textContent=change.after;
   }
  }
  moveToDetails(host,item.move_to_details??[]);
 }
 view.dataset.editorialReady='true';
 document.querySelectorAll('.module-version,.ops-tags,.lab-badge,.lab-v2-small,.business-level').forEach(n=>n.classList.add('editorial-metadata'));
 document.querySelectorAll('a[href="#modules"]').forEach(n=>{if(/^全部\s*\d+\s*个模块$/.test(n.textContent.trim()))n.textContent='研究目录';});
 for(const entry of copy.report_display_names??[])document.querySelectorAll('a[download][href="'+entry.href+'"],a[download][href="'+entry.href.replace('./','')+'"]').forEach(n=>{const label=entry.display_name+' ↓';if(!n.closest('[data-narrative-archive]')&&n.textContent!==label)n.textContent=label;});
 const eyebrow=view.querySelector('.page-heading .eyebrow');if(eyebrow&&eyebrow.textContent.includes('研究问题'))eyebrow.textContent=route==='#sources'?'来源与方法':'电力市场与储能运营';
 for(const id of ['lab-notebook','p1-lab-notebook','ops-notebook']){const link=view.querySelector('#'+id);if(link)moveToDetails(view,['#'+id]);}
 const a=route!=='#modules'&&!route.startsWith('#business'),context=document.querySelector('#research-context');
 if(context)context.textContent=route==='#modules'?'日本储能行业研究':a?'日本电力市场 · 交易运营':'日本储能项目 · 开发与投融资';
 const report=document.querySelector('#context-report');if(report&&!view.dataset.narrativeReady){const label=a?'下载交易运营报告':'下载项目商业报告';if(report.textContent!==label)report.textContent=label;}
}
export function applyEditorial(){
 if(observer)observer.disconnect();
 try{apply();}finally{observer?.observe(document.querySelector('#main'),{subtree:true,childList:true,characterData:true});}
}
export async function startEditorial(){
 await getEditorial();
 observer=new MutationObserver(()=>{clearTimeout(pending);pending=setTimeout(applyEditorial,30);});
 observer.observe(document.querySelector('#main'),{subtree:true,childList:true,characterData:true});
 window.addEventListener('hashchange',()=>setTimeout(applyEditorial,40));applyEditorial();
}
