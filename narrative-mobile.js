import {esc} from './views.js';

function compactBars(svg){
 const rows=[...svg.querySelectorAll('rect title')].map(t=>{const text=t.textContent,split=text.lastIndexOf('：');return {label:text.slice(0,split),value:text.slice(split+1),number:Number(text.slice(split+1).replaceAll(',','').match(/^[−-]?[\d.]+/)?.[0]?.replace('−','-')),color:t.parentElement.getAttribute('fill')};}).filter(r=>r.label&&Number.isFinite(r.number));
 if(!rows.length)return '';
 const largest=Math.max(...rows.map(r=>Math.abs(r.number)),1);
 return `<h3>${esc(svg.getAttribute('aria-label'))}</h3><div class="narrative-compact-bars">${rows.map(r=>`<div class="narrative-compact-row"><div><span>${esc(r.label)}</span><strong>${esc(r.value)}</strong></div><div class="narrative-bar-track"><i style="width:${Math.max(1,Math.abs(r.number)/largest*100)}%;background:${esc(r.color??'#245edb')}"></i></div></div>`).join('')}</div>`;
}

function compactYears(svg){
 const series=new Map(),years=[];
 for(const title of svg.querySelectorAll('circle title')){
  const text=title.textContent,colon=text.lastIndexOf('：'),dot=text.indexOf(' · ');if(colon<0||dot<0)continue;
  const label=text.slice(0,dot),year=text.slice(dot+3,colon),value=text.slice(colon+1);if(!series.has(label))series.set(label,new Map());series.get(label).set(year,value);if(!years.includes(year))years.push(year);
 }
 if(!series.size)return '';
 const selected=[...new Set([0,9,10,11,years.length-1].filter(i=>i>=0&&i<years.length))];
 return `<h3>${esc(svg.getAttribute('aria-label'))}</h3><p>先比较首年、更换储备转换前后、贷款到期与末年。</p><table class="narrative-compact-years"><thead><tr><th>年度</th>${[...series.keys()].map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${selected.map(i=>`<tr><th>${esc(years[i])}</th>${[...series.values()].map(values=>`<td>${esc(values.get(years[i])??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function compactDevelopment(){return '<h3>并行条件与资金放行</h3><div class="narrative-mobile-flow"><div class="narrative-parallel"><span>土地与权利</span><span>接入检讨</span><span>许可条件</span></div><b>↓ 前置条件与资金落实</b><strong>FID：投资决定与支出授权</strong><b>↓ 按各自启动前提推进</b><div class="narrative-parallel"><span>EPC采购施工</span><span>电网工程</span><span>市场准备</span></div><b>↓ 各项分别核实</b><div class="narrative-parallel"><span>受电与试运</span><span>COD</span><span>市场资格</span></div><b>↓ 商业条件成立</b><strong>可交易运营资产</strong></div><p>同一行可以并行；受电、COD和市场资格分别确认。完整图保留每项启动依赖，参考路径没有给出确定工期。</p>';}

function compactRoles(svg){
 const nodes=[...svg.querySelectorAll('g[tabindex]')].map(g=>[...g.querySelectorAll('text')].map(t=>t.textContent));
 return `<h3>交付、运营与资金接口</h3><p>设备与系统 → 工程及资产 → 运营、市场与资金。下面保留全部角色和现金类别；产业连接不表示调度指令顺序。</p><div class="narrative-role-grid">${nodes.map(n=>`<div><strong>${esc(n[0]??'')}</strong><span>${esc(n[1]??'')}</span></div>`).join('')}</div>`;
}

export function syncMobileFigures(view,route){
 if(!['#business/development','#business/commercial','#business/finance','#business/value-chain'].includes(route))return;
 for(const wrap of view.querySelectorAll('.business-diagram-wrap')){
  const svg=wrap.querySelector('svg');if(!svg)continue;
  const body=route==='#business/development'?compactDevelopment():route==='#business/value-chain'?compactRoles(svg):svg.querySelector('rect title')?compactBars(svg):compactYears(svg);
  if(!body)continue;
  let compact=wrap.previousElementSibling?.matches('[data-narrative-mobile]')?wrap.previousElementSibling:null;
  if(!compact){compact=document.createElement('section');compact.className='narrative-mobile-figure';compact.dataset.narrativeMobile='';wrap.before(compact);wrap.classList.add('narrative-has-mobile-view');}
  const content=body+'<button type="button" class="button quiet narrative-full-figure-toggle" aria-expanded="false">展开完整图</button>';
  if(compact.dataset.nativeSnapshot!==body){compact.innerHTML=content;compact.dataset.nativeSnapshot=body;wrap.removeAttribute('data-narrative-detail-open');compact.querySelector('button').onclick=e=>{const open=wrap.hasAttribute('data-narrative-detail-open');wrap.toggleAttribute('data-narrative-detail-open',!open);e.currentTarget.setAttribute('aria-expanded',String(!open));e.currentTarget.textContent=open?'展开完整图':'收起完整图';};}
 }
}
