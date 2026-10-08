import {esc} from './views.js';
import {getTopicData,renderTopicCards,mountResearchHome,mountTopicDirectory} from './topic-navigation.js?v=2-8-nav-20261008-1';
let manifestPromise;
export const getManifest=()=>manifestPromise??=fetch('./data/module-manifest-v2-5.json').then(r=>{if(!r.ok)throw new Error('Directory unavailable');return r.json();});
let websiteCopyPromise;
export const getWebsiteCopy=()=>websiteCopyPromise??=fetch('./data/website-copy-v2-8.json').then(r=>{if(!r.ok)throw new Error('研究正文未能载入');return r.json();});
export const entryNarrative=entry=>`<section class="narrative-entry" data-r3-entry>${(entry?.paragraphs??[]).map(p=>`<p>${esc(p)}</p>`).join('')}</section>`;
const aRoutes=new Set(['overview','market','rules','sources','lab','forward','feasibility','operations','market-operations']);
export const isNavigationRoute=route=>/^#?modules(?:\/[^/]+)?$/.test(route)||['market-operations','market-operations/modules','business','business/modules'].includes(route.replace(/^#/,''));
let topicData;
const currentTarget=()=>location.hash.slice(1)||'modules';
const moduleForTarget=(data,target)=>data.modules.find(m=>m.route==='#'+target)??data.modules.find(m=>m.route.startsWith('#'+target+'/'));
function paintContext(target,data){
 if(currentTarget()!==target)return;
 const [base,sub]=target.split('/'),topic=base==='modules'&&sub?data.topics.find(t=>t.key===sub):null,module=isNavigationRoute(target)?null:moduleForTarget(data,target);
 const isB=topic?topic.key==='business':base==='business',isA=topic?!isB:aRoutes.has(base),major=isB?'project_business':isA?'market_operations':null;
 const landing=isB?'#business':'#market-operations',directory=topic?.route??module?.primary_directory_route??(isB?'#business/modules':'#market-operations/modules');
 document.querySelectorAll('[data-major]').forEach(e=>{const active=e.dataset.major===major;e.classList.toggle('active',active);if(active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
 document.querySelector('#research-context').textContent=topic?topic.title:isB?'B / 项目开发、商业模式与投融资':isA?'A / 电力市场与储能交易运营':'日本储能 / 市场机会与项目投资';
 const report=document.querySelector('#context-report'),navigation=isNavigationRoute(target);
 if(navigation){report.href=base==='modules'&&!sub?'#market-operations':directory;report.textContent=base==='modules'&&!sub?'探索研究':'浏览研究目录';report.removeAttribute('download');report.removeAttribute('data-current-formal-report');report.removeAttribute('title');document.querySelector('[data-context-reference]')?.remove();}
 else{report.setAttribute('download','');report.href=isB?'./japan-bess-project-business-v2-8.pdf':'./japan-bess-operations-research-v2-8.pdf';report.textContent='下载本册正文';}
 document.querySelector('#tour-start').hidden=navigation||!isA;
 const topics=data.topics.filter(t=>isB?t.key==='business':isA?t.key!=='business':true);
 const businessShortcuts=isB?data.modules.filter(m=>m.major_module_id==='project_business').map(m=>[m.route,m.title]):[];
 const links=major?[[landing,'研究摘要'],...topics.map(t=>[t.route,t.title]),...businessShortcuts]:[];
 document.querySelector('#context-navigation').innerHTML=links.map(([r,t])=>`<a href="${esc(r)}"${'#'+target===r?' class="active" aria-current="page"':''}>${esc(t)}</a>`).join('');
 const crumbs=[['#modules','研究首页']];
 if(major)crumbs.push([landing,isB?'项目开发、商业与投融资':'电力市场与交易运营']);
 if(topic)crumbs.push([null,topic.title]);
 else if(module){const own=data.topics.find(t=>t.key===module.primary_topic);crumbs.push([own.route,own.title],[null,module.title]);}
 else if(sub==='modules')crumbs.push([null,'研究目录']);
 else if(base==='business'&&sub==='methods')crumbs.push(['#modules/business','开发与投融资'],[null,'来源与研究方法']);
 document.querySelector('#research-breadcrumb').innerHTML=crumbs.map(([r,t],i)=>`${i?'<span aria-hidden="true">/</span>':''}${r?`<a href="${esc(r)}">${esc(t)}</a>`:`<span aria-current="page">${esc(t)}</span>`}`).join('');
 repairDirectoryLinks();
}
export function updateResearchContext(target){
 document.documentElement.dataset.navigationPage=String(isNavigationRoute(target));
 if(topicData)paintContext(target,topicData);
 else getTopicData().then(data=>{topicData=data;paintContext(target,data);}).catch(console.error);
}
export function repairDirectoryLinks(){
 if(!topicData||isNavigationRoute(currentTarget()))return;
 const module=moduleForTarget(topicData,currentTarget());if(!module)return;
 for(const e of document.querySelectorAll('.view:not([hidden]) a[href="#modules"]')){
  if(e.textContent.includes('研究首页'))continue;
  e.href=module.primary_directory_route;
  if(/目录|全部.*模块|返回/.test(e.textContent))e.textContent='返回'+topicData.topics.find(t=>t.key===module.primary_topic).title+'目录';
 }
}
export function moduleCards(modules,copy={}){return `<div class="research-card-grid">${modules.map(m=>{const item=copy.modules?.find(x=>x.route===m.route)??copy.routes?.[m.route];return `<a class="research-module-card" href="${esc(m.route)}" data-module-id="${esc(m.module_id)}"><span>${esc(m.subgroup==='研究实验室'?'市场结构与交易策略':m.subgroup)}</span><h3>${esc(item?.title??m.title)}</h3><p>${esc(item?.text??item?.card??item?.headline??m.research_question)}</p><span>阅读全文 →</span></a>`;}).join('')}</div>`;}
export const evidenceNotice=()=>'<div class="business-notice"><p><strong>证据口径</strong>　A 官方事实 / 企业公开披露；B 可复算结果或基于来源的分析；C 明示研究假设。未披露数据保留未知。企业披露只支持该企业、该项目和该日期。</p></div>';
export async function mountDirectory({view,route=''}){
 const [m,copy,nav]=await Promise.all([getManifest(),getWebsiteCopy(),getTopicData()]),el=document.getElementById(view);
 if(view==='modules'){
  if(route&&nav.topics.some(t=>t.key===route))await mountTopicDirectory({el,key:route,manifest:m,websiteCopy:copy});
  else if(route)el.innerHTML='<div class="research-wrap"><h1>未找到研究目录</h1><p><a href="#modules">返回研究首页</a></p></div>';
  else await mountResearchHome({el});
  return;
 }
 const entry=copy.entries['market-operations'],topics=nav.topics.filter(t=>t.key!=='business');
 el.innerHTML=`<div class="research-wrap"><div class="research-head"><div><div class="eyebrow">ELECTRICITY MARKETS & STORAGE OPERATIONS</div><h1>${esc(route==='modules'?'电力市场与储能交易运营研究目录':entry.title)}</h1><p>${esc(route==='modules'?nav.majors['market-operations'].lead:entry.lead)}</p></div></div>${route==='modules'?'':entryNarrative(entry)}<div class="research-links"><a href="#modules">研究首页</a><a href="#sources">来源与方法</a>${route==='modules'?'<a href="#market-operations">研究摘要</a>':''}</div><h2>按研究问题继续阅读</h2>${renderTopicCards(topics)}</div>`;
}
