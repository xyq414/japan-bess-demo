import {DEFAULTS,validateParameters,solveDay,primaryScenario} from './model.js';
import {esc,sourceButton,sourceForDisplay,marketView,rulesView,sourcesView} from './views.js';
import {lineChart,dispatchChart} from './charts.js';
import {mountDirectory,updateResearchContext,repairDirectoryLinks} from './research-directory.js?v=2-8-nav-20261008-2';
import {startEditorial} from './editorial.js?v=2-8-nav-20261008-2';
import {startNarrative} from './narrative.js?v=2-8-nav-20261008-2';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const labels={chubu:'中部',tokyo:'东京',kansai:'关西',kyushu:'九州',tohoku:'东北'};
const number=(v,d=0)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v);
const clock=slot=>`${String(Math.floor(slot/2)).padStart(2,'0')}:${slot%2?'30':'00'}`;
let summary,prices,evidence,quality,validation,sensitivityCache,last,dispatch,active='overview',dirty=false;
let worker,workerReject,jobId=0,sensitivityWorker,toastTimer,resizeTimer,tourStep=0;
const variants=[{label:'效率 80%',change:{efficiency:.8}},{label:'效率 95%',change:{efficiency:.95}},
  {label:'循环上限 0.5 次',change:{maxCycles:.5}},{label:'循环上限 1.5 次',change:{maxCycles:1.5}},
  {label:'放电成本 2 JPY/kWh',change:{degradation:2}},{label:'放电成本 4 JPY/kWh',change:{degradation:4}}];
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500);}
function metric(title,value,unit,note,kind='calc',source){return `<article class="metric"><div class="metric-label">${esc(title)}${source?sourceButton(source):''}</div><div class="metric-value">${esc(value)}<small>${esc(unit)}</small></div><div class="metric-note"><span class="${kind}-tag">${kind==='fact'?'A · 事实':'B · 计算'}</span> ${esc(note)}</div></article>`;}
function renderOverview(){
  const region=$('#overview-region').value,window=$('#overview-window').value,r=summary.windows[window].regions[region];
  $('#overview-metrics').innerHTML=[metric('理论套利收入',number(r.netRevenue/1e6,2),'百万 JPY',`${r.analyzedDays} 天 · 已知历史价格 · 未计固定成本`,'calc','model'),
    metric('平均现货电价',number(r.priceMean,2),'JPY/kWh','JEPX 官方价格的样本均值','calc','jepx-data'),
    metric('日均峰谷价差',number(r.dailySpreadMean,2),'JPY/kWh','每日最高价 − 最低价的均值','calc','jepx-data'),
    metric('等效放电循环',number(r.equivalentCycles,1),'次',`日均 ${number(r.averageCycles,2)} 次 · 电池侧 / 额定容量`,'calc','model')].join('');
  const comparisons=Object.entries(summary.windows[window].regions).sort((a,b)=>b[1].averageNetRevenue-a[1].averageNetRevenue),max=comparisons[0][1].averageNetRevenue;
  $('#region-bars').innerHTML=comparisons.map(([key,d])=>`<div class="bar-row ${key===region?'selected':''}"><span class="bar-label">${labels[key]}</span><div class="bar-track"><div class="bar-fill" style="width:${d.averageNetRevenue/max*100}%"></div></div><span class="bar-value">${number(d.averageNetRevenue)} <small>JPY</small></span></div>`).join('');
  $('#comparison-caption').textContent=`${r.start} 至 ${r.end} · ${r.analyzedDays} 天 · JPY / 日 · 零起点`;
  $('#takeaway-evidence').textContent=`${labels[region]}在本区间的理论套利收入为 ${number(r.netRevenue/1e6,2)} 百万 JPY，日均 ${number(r.averageNetRevenue)} JPY。最高日均收入出现在${labels[comparisons[0][0]]}；这只是相同电站约束下的现货比较。`;
}
function readParameters(){return validateParameters({power:+$('#power').value,energy:+$('#energy').value,efficiency:+$('#efficiency').value/100,socMin:+$('#soc-min').value/100,socMax:+$('#soc-max').value/100,initialSoc:+$('#initial-soc').value/100,maxCycles:+$('#cycles').value,degradation:+$('#degradation').value,gridSteps:80});}
const sameParameters=p=>Object.keys(DEFAULTS).every(k=>p[k]===DEFAULTS[k]);
function daysInRange(start,end){
  if(!start||!end||start>end)throw new Error('开始日期须不晚于结束日期');
  if(start<quality.delivery_start||end>quality.delivery_end)throw new Error(`数据仅覆盖 ${quality.delivery_start} 至 ${quality.delivery_end}`);
  const days=prices.days.filter(d=>d.date>=start&&d.date<=end);
  if(!days.length||days[0].date!==start||days.at(-1).date!==end)throw new Error('所选日期没有完整半小时数据');
  return days;
}
function cachedResult(days,region,p){
  if(!sameParameters(p))return null;
  const w=Object.values(summary.windows).find(w=>w.start===days[0].date&&w.end===days.at(-1).date);
  return w?.regions[region]??null;
}
function stopWorkers(){
  if(worker){worker.terminate();worker=undefined;workerReject?.(new Error('计算已取消'));workerReject=undefined;}
  if(sensitivityWorker){sensitivityWorker.terminate();sensitivityWorker=undefined;}
  $('#run-model').disabled=false;$('#run-sensitivity').disabled=false;$('#model-progress').hidden=true;
}
function markDirty(){
  syncParameterTags();
  stopWorkers();dirty=true;$('#model-error').hidden=true;$('#model-status').textContent='参数已修改，请重新回测；当前图表仍对应上次成功结果。';
  $('#model-results').classList.add('stale-results');$('#sensitivity-result').innerHTML='<p class="parameter-hint">先完成当前参数的回测，再计算敏感性。</p>';$('#sensitivity-status').textContent='';
}
function syncParameterTags(){for(const id of ['power','energy']){const badge=document.querySelector(`label[for="${id}"] small`),original=+document.getElementById(id).value===DEFAULTS[id];badge.className=original?'fact-tag':'assumption-tag';badge.textContent=original?'公开规格':'自定义假设';}}
function setWindow(value){
  if(value==='custom')return;
  const end=value==='2025'?'2025-12-31':quality.delivery_end;
  const date=new Date(`${end}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-29);
  $('#start-date').value=value==='2025'?'2025-01-01':value==='2026ytd'?'2026-01-01':date.toISOString().slice(0,10);
  $('#end-date').value=end;
}
async function runModel(){
  stopWorkers();syncParameterTags();$('#model-error').hidden=true;
  try{
    const p=readParameters(),region=$('#model-region').value,days=daysInRange($('#start-date').value,$('#end-date').value);
    let r=cachedResult(days,region,p);
    if(!r){
      $('#run-model').disabled=true;$('#model-progress').hidden=false;$('#model-status').textContent=`正在优化 ${days.length} 天；可继续浏览其他研究页面…`;
      r=await new Promise((resolve,reject)=>{
        workerReject=reject;worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});const id=++jobId;
        worker.onmessage=({data})=>{if(data.id!==id)return;if(data.progress!==undefined){$('#model-progress').value=data.progress;$('#model-status').textContent=`研究回测进度 ${Math.round(data.progress*100)}% · ${days.length} 天`;}
          if(data.error)reject(new Error(data.error));if(data.result)resolve(data.result);};
        worker.onerror=()=>reject(new Error('计算线程未能启动，请刷新重试'));
        worker.postMessage({id,days,region,parameters:p});
      });
    }
    stopWorkers();last=r;dirty=false;$('#model-results').classList.remove('stale-results');
    $('#model-status').textContent=`回测完成 · ${r.analyzedDays} 个完整日 · ${r.start} 至 ${r.end}`;
    $('#sensitivity-result').innerHTML='<p class="parameter-hint">对当前研究区间比较效率、循环限制和放电成本，每项重新优化。</p>';$('#sensitivity-status').textContent='';
    renderResults();return r;
  }catch(e){if(e.message==='计算已取消')return null;stopWorkers();$('#model-error').textContent=e.message;$('#model-error').hidden=false;$('#model-status').textContent='回测未运行；请修正参数。';return null;}
}
function renderResults(){
  const r=last;$('#result-heading').textContent=`${labels[r.region]} · ${r.start} 至 ${r.end}`;
  $('#result-caption').textContent=`${r.analyzedDays} 天 · ${r.parameters.power} MW / ${r.parameters.energy} MWh · 效率 ${number(r.parameters.efficiency*100)}% · 每日循环上限 ${r.parameters.maxCycles} 次`;
  $('#model-metrics').innerHTML=[metric('毛套利收入',number(r.grossRevenue/1e6,2),'百万 JPY','放电收入 − 充电成本'),metric('扣变动成本后',number(r.netRevenue/1e6,2),'百万 JPY',`${r.parameters.degradation} JPY/kWh 放电成本；仍非项目利润`),metric('捕获均价差',number(r.capturedSpread,2),'JPY/kWh','放电加权均价 − 充电加权均价，未扣效率'),metric('电网侧吞吐量',number(r.throughputMWh),'MWh','充电量 + 放电量'),metric('电池侧等效循环',number(r.equivalentCycles,1),'次',`日均 ${number(r.averageCycles,2)} 次`),metric('功率 / 容量标准化',`${number(r.revenuePerMW/1e6,2)} / ${number(r.revenuePerMWh/1e6,2)}`,'百万 JPY','分别每 MW / 每 MWh · 该区间总额')].join('');
  $('#cashflow').innerHTML=[['放电收入',r.dischargeRevenue,'正项'],['充电成本',r.chargingCost,'扣项（负价可能为负）'],['放电变动成本',r.variableCost,'扣项'],['扣变动成本后收入',r.netRevenue,'理论研究结果']].map(([name,value,note])=>`<div><span>${name}</span><strong>${number(value)} <small>JPY</small></strong><p>${note}</p></div>`).join('');
  $('#grid-note').textContent=`SOC 可用范围离散为 80 格；能量步长 ${number(r.energyQuantumMWh,4)} MWh。有效最大充 / 放电功率 ${number(r.effectiveMaxChargeMW,3)} / ${number(r.effectiveMaxDischargeMW,3)} MW；边界向内取整，初始 SOC 精确守恒。`;
  const picker=$('#dispatch-date');picker.min=r.start;picker.max=r.end;if(picker.value<r.start||picker.value>r.end)picker.value=r.start;
  renderDispatch();renderMonthly();
}
function renderDispatch(){
  if(!last)return;
  const date=$('#dispatch-date').value;
  if(date<last.start||date>last.end){toast('请选择回测区间内的完整受渡日');return;}
  const day=prices.days.find(d=>d.date===date);if(!day)return;
  dispatch={date,region:last.region,...solveDay(day[last.region],last.parameters)};
  $('#dispatch-caption').textContent=`${labels[last.region]} · ${date} · 已知历史价格下的最优可行调度`;
  drawDispatch();
  $('#dispatch-receipt').innerHTML=`<span>当日毛套利 <strong>${number(dispatch.grossRevenue)} JPY</strong></span><span>扣变动成本 <strong>${number(dispatch.netRevenue)} JPY</strong></span><span>等效循环 <strong>${number(dispatch.equivalentCycles,3)} 次</strong></span><span>首尾 SOC <strong>${number(dispatch.rows[0].socBefore*100,1)}% → ${number(dispatch.rows.at(-1).socAfter*100,1)}%</strong></span>`;
  $('#dispatch-table').innerHTML='<thead><tr><th>开始 JST</th><th>JPY/kWh</th><th>充电 MW</th><th>放电 MW</th><th>SOC 前 %</th><th>SOC 后 %</th><th>毛现金流 JPY</th></tr></thead><tbody>'+dispatch.rows.map((r,i)=>`<tr><td>${clock(i)}</td><td>${number(r.price,2)}</td><td>${number(r.chargeMW,3)}</td><td>${number(r.dischargeMW,3)}</td><td>${number(r.socBefore*100,2)}</td><td>${number(r.socAfter*100,2)}</td><td>${number(r.cashflow)}</td></tr>`).join('')+'</tbody>';
}
function drawDispatch(){if(!dispatch||active!=='market')return;
  lineChart($('#price-chart'),{series:[{name:'区域现货价',values:dispatch.rows.map(r=>r.price)}],labels:dispatch.rows.map((_,i)=>clock(i)),title:`${dispatch.date} ${labels[dispatch.region]}半小时现货价格`,unit:'JPY/kWh',height:210});
  dispatchChart($('#dispatch-chart'),dispatch.rows,last.parameters.power);
  lineChart($('#soc-chart'),{series:[{name:'SOC',values:[dispatch.rows[0].socBefore,...dispatch.rows.map(r=>r.socAfter)].map(v=>v*100),color:'#087f79'}],labels:Array.from({length:49},(_,i)=>clock(i)),title:'电池SOC，日末回到初始值',unit:'SOC %',height:150,min:0,max:100,ticks:2});
}
function renderMonthly(){if(!last||active!=='market')return;
  const days=daysInRange(last.start,last.end),groups={};for(const d of days)(groups[d.date.slice(0,7)]??=[]).push(d);
  const rows=Object.entries(groups).map(([month,ds])=>({month,area:ds.reduce((sum,d)=>sum+d[last.region].reduce((a,b)=>a+b,0),0)/(ds.length*48),system:ds.reduce((sum,d)=>sum+d.system.reduce((a,b)=>a+b,0),0)/(ds.length*48)}));
  $('#monthly-caption').textContent=`${labels[last.region]} · ${last.start} 至 ${last.end} · 首尾月份可能为部分月份`;
  lineChart($('#monthly-chart'),{series:[{name:labels[last.region],values:rows.map(d=>d.area)},{name:'系统价格',values:rows.map(d=>d.system),dashed:true}],labels:rows.map(d=>d.month.slice(2)),unit:'JPY/kWh',title:'所选区间的区域与系统月均电价',height:238,xCount:5});
}
function renderPrimaryChart(){if(active==='rules')lineChart($('#primary-price-chart'),{series:[{name:'一次全国月均成交价',values:evidence.eprx_market.prices}],labels:evidence.eprx_market.months.map(m=>m.slice(2)),title:'FY2025一次全国月均成交价格，官方历史汇总',unit:'JPY/ΔkW·30min',height:238,xCount:5});}
function renderSensitivity(results){
  const base=last.netRevenue;$('#sensitivity-result').innerHTML=`<div class="table-scroll"><table class="sensitivity-table"><thead><tr><th>单一变动</th><th>收入 / 百万 JPY</th><th>相对当前</th></tr></thead><tbody><tr class="baseline"><td>当前基线</td><td>${number(base/1e6,2)}</td><td>—</td></tr>${results.map(r=>{const pct=Math.abs(base)<1e-6?null:(r.netRevenue-base)/Math.abs(base)*100;return `<tr><td>${esc(r.label)}</td><td>${number(r.netRevenue/1e6,2)}</td><td class="${pct<0?'decrease':'increase'}">${pct===null?'基线为零':`${pct>0?'+':''}${number(pct,1)}%`}</td></tr>`;}).join('')}</tbody></table></div>`;
  $('#sensitivity-status').textContent=`${labels[last.region]} · ${last.start} 至 ${last.end} · 单参数改动；扣放电变动成本后收入，仍非利润。`;
}
async function runSensitivity(){
  if(dirty){toast('请先重新回测当前参数');return;}
  const cache=sensitivityCache;if(cache&&last.region===cache.region&&last.start===cache.start&&last.end===cache.end&&sameParameters(last.parameters)){renderSensitivity(cache.results);return;}
  $('#run-sensitivity').disabled=true;$('#sensitivity-status').textContent='正在对 6 个情景重新优化，可继续浏览…';
  const snapshot=last,id=++jobId;sensitivityWorker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  sensitivityWorker.onmessage=({data})=>{if(data.id!==id||last!==snapshot)return;if(data.progress!==undefined)$('#sensitivity-status').textContent=`敏感性计算 ${Math.round(data.progress*100)}%`;if(data.error||data.result){sensitivityWorker?.terminate();sensitivityWorker=undefined;$('#run-sensitivity').disabled=false;if(data.error){$('#sensitivity-status').textContent=data.error;return;}renderSensitivity(data.result);}};
  sensitivityWorker.onerror=()=>{$('#sensitivity-status').textContent='计算线程未能启动，请刷新重试';$('#run-sensitivity').disabled=false;sensitivityWorker?.terminate();sensitivityWorker=undefined;};
  sensitivityWorker.postMessage({id,days:daysInRange(last.start,last.end),region:last.region,parameters:last.parameters,variants});
}
function renderScenario(){
  try{const capacityMW=+$('#reserve-capacity').value,priceJPY=+$('#reserve-price').value,availability=+$('#reserve-availability').value/100,hours=+$('#reserve-hours').value;
    if(!$$('#scenario-form input').every(x=>x.value!==''&&x.checkValidity())||capacityMW<1||capacityMW>2||priceJPY>10)throw new Error('请输入有效参数：容量 1–2MW，单价 0–10，可用比例 0%–100%，供出 0.5–24 小时。');
    const r=primaryScenario({capacityMW,priceJPY,availability,hours,days:365});$('#scenario-error').hidden=true;
    $('#scenario-output').innerHTML=`<span class="assumption-tag">静态情景 · 非项目回测</span><div class="scenario-value">${number(r.grossRevenue/1e6,2)}<small>百万 JPY / 365 天</small></div><p>假设调频容量收入（未扣成本）</p><div class="scenario-breakdown"><span>容量手续费 <strong>${number(r.fee)} JPY</strong></span><span>仅扣此手续费后 <strong>${number(r.afterFee/1e6,2)} 百万 JPY</strong></span></div><p class="parameter-hint">0.06 按 2026 年费率恒定假设，不代表未来费率。与现货研究收入共享电站资源，不能相加。</p>`;
  }catch(e){$('#scenario-error').textContent=e.message;$('#scenario-error').hidden=false;$('#scenario-output').innerHTML='<p class="parameter-hint">修正参数后显示情景结果。</p>';}
}
function showSource(id){
  const original=evidence.sources.find(s=>s.id===id);if(!original)return;const s=sourceForDisplay(original);
  $('#source-content').innerHTML=`<div class="eyebrow">来源证据</div><h2 id="source-title">${esc(s.source_title)}</h2><p class="source-meta">${esc(s.source_org)} · ${esc(s.evidence_type)} · ${esc(s.language)}</p><dl class="source-dates"><div><dt>发布日期</dt><dd>${esc(s.publication_date??'官方未标注')}</dd></div><div><dt>生效 / 事件日</dt><dd>${esc(s.effective_date??'不适用 / 未标注')}</dd></div><div><dt>核验日期</dt><dd>${esc(s.retrieved_at)}</dd></div></dl><h3>原文定位</h3><p>${esc(s.locator)}</p>${s.short_source_excerpt?`<blockquote>${esc(s.short_source_excerpt)}</blockquote>`:''}<h3>中文研究摘要</h3><p>${esc(s.chinese_summary)}</p><h3>对业务的含义</h3><p>${esc(s.business_impact)}</p><div class="source-caveat"><strong>${esc(s.confidence)}</strong><p>${esc(s.caveat)}</p></div><a class="button primary original-source" href="${esc(s.source_url)}" ${s.source_url.startsWith('#')?'':'target="_blank" rel="noopener noreferrer"'}>打开原始来源 ↗</a>`;
  $('#source-dialog').showModal();
}
function showView(hash=location.hash){
  const target=hash.replace('#','')||'modules',base=target.split('/')[0];let view=['overview','market','rules','sources','lab','forward','modules','market-operations','business','feasibility','operations'].includes(base)?base:document.getElementById(target)?.closest('.view')?.id??'modules';
  if(target==='main'){view=active;$('#main').focus();}
  active=view;$$('.view').forEach(x=>x.hidden=x.id!==view);$$('[data-view]').forEach(x=>{x.classList.toggle('active',x.dataset.view===view);if(x.dataset.view===view)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});
  updateResearchContext(target);
  if(view==='modules'||view==='market-operations')mountDirectory({view,route:target.split('/')[1]??''}).then(()=>{if(view==='modules'&&(location.hash.slice(1)||'modules')===target)window.scrollTo(0,0);}).catch(e=>{console.error(e);$('#'+view).innerHTML='<p role="alert">研究目录载入失败，请刷新重试。</p>';});
  if(view==='business')import('./business.js?v=2-8-nav-20261008-2').then(m=>m.mountBusiness({route:target.split('/')[1]??''})).catch(e=>{console.error(e);$('#business').innerHTML='<p role="alert">开发与商业研究载入失败，请刷新重试。</p>';});
  if(view==='lab')import('./lab.js').then(m=>m.mountLab({prices,route:target.split('/')[1]??'anatomy'})).catch(e=>{$('#lab').innerHTML='<p role="alert">研究实验室载入失败，请刷新重试。</p>';console.error(e);});
  if(view==='forward')import('./forward.js').then(m=>m.mountForward({view,route:target.split('/')[1]??''})).then(repairDirectoryLinks).catch(e=>{$('#'+view).innerHTML='<p role="alert">研究资料载入失败，请刷新重试。</p>';console.error(e);});
  if(view==='feasibility')import('./feasibility.js').then(m=>m.mountFeasibility({route:target.split('/')[1]??''})).then(repairDirectoryLinks).catch(e=>{$('#feasibility').innerHTML='<p role="alert">项目可行性资料载入失败，请刷新重试。</p>';console.error(e);});
  if(view==='operations')import('./operations.js').then(m=>m.mountOperations({route:target.split('/')[1]??'bidding'})).then(repairDirectoryLinks).catch(e=>{$('#operations').innerHTML='<p role="alert">运营研究资料载入失败，请刷新重试。</p>';console.error(e);});
  requestAnimationFrame(()=>{if(view==='market'){drawDispatch();renderMonthly();}if(view==='rules')renderPrimaryChart();if(target!==view&&target!=='main')document.getElementById(target)?.scrollIntoView({block:'start'});else window.scrollTo(0,0);});
}
const tour=[
  {view:'overview',target:'case-strip',title:'先核验项目，再看收益',time:15,body:'默认案例来自淘科官方公告：中部 2MW / 8.14MWh。该站并网与已获一次准入的其他电站分别标注。首页比较同一设备在五个区域的日均理论收入。'},
  {view:'market',target:'model-form',title:'改变一个假设，重新计算',time:20,body:'把往返效率从 88% 改为 80%，点击「重新回测」。结果由真实 JEPX 半小时价格和物理约束重新优化；改参数后会提示结果尚未更新。'},
  {view:'market',target:'dispatch-caption',title:'收入必须能还原为调度',time:20,body:'选择一个受渡日，检查电价、充放电功率与 SOC。首尾 SOC 相同，没有免费初始能量；导出 CSV 可以逐时段复核。'},
  {view:'rules',target:'regulation-diff',title:'规则变化，怎样改变机会',time:20,body:'2026 年 3 月 14 日起由周前 3 小时变为日前 30 分钟。9 月 1 日起一次报价上限降至 10。点击来源核验原文；调频情景不能直接与现货收入相加。'},
  {view:'sources',target:'data-quality',title:'核验数据与方法',time:15,body:'下载 v1 研究简报、原始数据或证据清单。这里记录数据范围、哈希、模型方法与假设，便于面试官继续核验和讨论。'}];
function renderTour(){
  const t=tour[tourStep];location.hash=t.view;showView(`#${t.view}`);$$('.tour-highlight').forEach(x=>x.classList.remove('tour-highlight'));document.getElementById(t.target)?.classList.add('tour-highlight');
  requestAnimationFrame(()=>document.getElementById(t.target)?.scrollIntoView({block:'start',behavior:'smooth'}));
  $('#tour-content').innerHTML=`<div class="eyebrow">90 秒浏览指引 · ${tourStep+1} / ${tour.length}</div><h3 id="tour-title">${t.title}</h3><p>${t.body}</p><div class="tour-controls"><span>建议 ${t.time} 秒 · 可操作页面</span><button class="button primary small" id="tour-next">${tourStep===4?'完成浏览':'下一步 →'}</button></div>`;
  $('#tour-next').onclick=()=>{if(tourStep===4){$('#tour-dialog').close();toast('研究路径已完成，可继续修改假设或下载研究简报');return;}tourStep++;renderTour();};
}
function exportCsv(filename,rows){
  const quote=x=>`"${String(x??'').replaceAll('"','""')}"`,text='\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('CSV 已导出，包含参数、单位与研究边界');
}
function exportDispatch(){if(!dispatch)return;const p=last.parameters;
  exportCsv(`bess-dispatch-${dispatch.region}-${dispatch.date}.csv`,[
    ['research_type','Historical perfect-information research backtest'],['source','JEPX official Area Price'],['timezone','Asia/Tokyo'],['parameters',JSON.stringify(p)],['boundary','Daily terminal SOC equals initial; excludes fixed costs, network/market fees, tax and financing'],
    ['date','slot','start_JST','price_JPY_per_kWh','charge_MW','discharge_MW','soc_before_fraction','soc_after_fraction','charge_MWh','discharge_MWh','gross_cashflow_JPY','variable_cost_JPY','after_variable_cost_JPY'],
    ...dispatch.rows.map((r,i)=>[dispatch.date,r.slot,clock(i),r.price,r.chargeMW,r.dischargeMW,r.socBefore,r.socAfter,r.chargeMWh,r.dischargeMWh,r.cashflow,r.variableCost,r.cashflow-r.variableCost])]);}
function exportDaily(){if(!last)return;const columns=['date','grossRevenue','netRevenue','chargingCost','dischargeRevenue','variableCost','chargeMWh','dischargeMWh','throughputMWh','equivalentCycles','capturedSpread'];
  exportCsv(`bess-daily-${last.region}-${last.start}-${last.end}.csv`,[['research_type','Historical perfect-information research backtest'],['region',last.region],['parameters',JSON.stringify(last.parameters)],['units','money: JPY; energy: MWh; capturedSpread: JPY/kWh; cycles: battery-side discharge/nameplate capacity'],columns,...last.daily.map(d=>columns.map(k=>d[k]))]);}
async function init(){
  const load=async file=>{const r=await fetch(`./data/${file}.json`);if(!r.ok)throw new Error(`研究数据 ${file} 未能载入`);return r.json();};
  [summary,prices,evidence,quality,validation]=await Promise.all(['summary','prices','evidence','quality','model-validation'].map(load));
  sensitivityCache=await load('sensitivity').catch(()=>null);
  $('#market').innerHTML=marketView();$('#rules').innerHTML=rulesView(evidence);$('#sources').innerHTML=sourcesView(evidence,quality,validation);
  $('#company-evidence').innerHTML=[['2026.07.17 披露','公开设备规格','各务原市②号于 7 月 7 日并网，2MW / 8.14MWh。公告计划年内参与一次调频；不能据此确认已经入市。','taoke-case'],['2026.06.29 披露','现货与一次调频已有案例','另外两个中部 2MW / 8MWh 项目于 6 月 12 日获准一次市场交易，原已参与 JEPX 套利。官方披露 SI / EM / AG 与日本自主电力运营。','taoke-operation'],['2026.09.28 最新披露','四站并网与业务角色','千叶、福岛、兵库、熊本四站并网，均为 2MW / 8.14MWh。包括交钥匙销售与 TK-GK 资产基金；入市仍属计划。','taoke-latest']].map(([date,title,text,id])=>`<div class="evidence-item"><span class="date">${date}</span><strong>${title}</strong><p>${text}</p>${sourceButton(id,'核验公司公告')}</div>`).join('');
  $('#overview-region').onchange=renderOverview;$('#overview-window').onchange=renderOverview;
  $('#model-form').onsubmit=e=>{e.preventDefault();runModel();};
  $$('#model-form input, #model-form select').forEach(x=>x.addEventListener('change',()=>{if(x.id==='model-window')setWindow(x.value);if(['start-date','end-date'].includes(x.id))$('#model-window').value='custom';markDirty();}));
  $$('#model-form input').forEach(x=>x.addEventListener('input',markDirty));
  $('#reset-model').onclick=()=>{$('#model-form').reset();setWindow('2025');runModel();};
  ['start-date','end-date'].forEach(id=>{document.getElementById(id).min=quality.delivery_start;document.getElementById(id).max=quality.delivery_end;});
  $('#dispatch-date').onchange=renderDispatch;$('#run-sensitivity').onclick=runSensitivity;
  $('#export-dispatch').onclick=exportDispatch;$('#export-daily').onclick=exportDaily;
  $('#scenario-form').onsubmit=e=>e.preventDefault();$$('#scenario-form input').forEach(x=>x.addEventListener('input',renderScenario));renderScenario();
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-source]');if(btn){e.preventDefault();showSource(btn.dataset.source);}if(e.target.closest('.original-source')?.getAttribute('href')?.startsWith('#'))$('#source-dialog').close();});
  $$('dialog').forEach(d=>{d.querySelector('.dialog-close').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d&&d.id==='source-dialog'){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
  $('#tour-dialog').addEventListener('close',()=>$$('.tour-highlight').forEach(x=>x.classList.remove('tour-highlight')));
  $('#tour-start').onclick=()=>{tourStep=0;if(!$('#tour-dialog').open)$('#tour-dialog').show();renderTour();};
  window.addEventListener('hashchange',()=>showView());window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{drawDispatch();renderMonthly();renderPrimaryChart();},120);});
  last=summary.windows['2025'].regions.chubu;renderOverview();renderResults();$('#loading').hidden=true;showView();
  await startEditorial();
  await startNarrative();
  // Progressive enhancement: exactly the same validated, visible model journey.
  registerModelTool();
}
function registerModelTool(){
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try{Promise.resolve(document.modelContext.registerTool({name:'run_bess_research_backtest',title:'运行储能研究回测',description:'Recompute and display the historical known-price BESS research backtest using the current visible station assumptions. Results are theoretical, not project profit.',inputSchema:{type:'object',properties:{region:{type:'string',enum:Object.keys(labels)},start:{type:'string'},end:{type:'string'},efficiency_percent:{type:'number',minimum:50,maximum:100}},required:['region','start','end'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async args=>{
    if(!args||!Object.hasOwn(labels,args.region))throw new Error('无效区域');daysInRange(args.start,args.end);
    if(args.efficiency_percent!==undefined&&(!Number.isFinite(args.efficiency_percent)||args.efficiency_percent<50||args.efficiency_percent>100))throw new Error('效率须在50%–100%之间');
    $('#model-region').value=args.region;$('#model-window').value='custom';$('#start-date').value=args.start;$('#end-date').value=args.end;if(args.efficiency_percent!==undefined)$('#efficiency').value=args.efficiency_percent;location.hash='market';
    const r=await runModel();if(!r)throw new Error($('#model-error').textContent||'计算取消');
    return {region:r.region,start:r.start,end:r.end,analyzedDays:r.analyzedDays,grossRevenueJPY:r.grossRevenue,afterVariableCostJPY:r.netRevenue,parameters:r.parameters,boundary:'Historical perfect-information; not project profit; no balancing co-optimization'};
  }},{signal:lifecycle.signal})).catch(()=>console.warn('WebMCP registration unavailable; standard research UI remains available.'));}catch{console.warn('WebMCP registration unavailable; standard research UI remains available.');}
}
init().catch(e=>{$('#loading').hidden=false;$('#loading').textContent=`载入失败：${e.message}。请刷新重试，或先下载研究简报。`;console.error(e);});
