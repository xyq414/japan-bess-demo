// Root-owned browser integration template. Copy to dist only after the narrative spine is frozen.
import {esc} from './views.js';
import {isNavigationRoute} from './research-directory.js?v=2-8-nav-20261008-2';
import {syncMobileFigures} from './narrative-mobile.js';
let data,observer,timer;
const route=()=>{
 const h=location.hash||'#modules';
 return h.startsWith('#lab')?'#lab/'+(document.querySelector('[data-lab-tab][aria-selected="true"]')?.dataset.labTab??h.split('/')[1]??'anatomy'):h;
};
function cashChain(){return `<figure class="narrative-cash-flow" aria-label="预计项目现金用于分配，银行并行审查决定贷款与本息"><div class="narrative-cash-chain">${['历史市场机会','事前交易结算','经营贡献','预计项目现金'].map((x,i)=>`<span>${esc(x)}</span>${i<3?'<b aria-hidden="true">→</b>':''}`).join('')}</div><div class="narrative-cash-branches"><div class="narrative-bank-branch"><small>并行贷款审查</small><div class="narrative-cash-chain"><span>银行压力审查</span><b aria-hidden="true">→</b><span>可支持的贷款</span><b aria-hidden="true">→</b><span>约定本金与利息</span></div><p>审查结果决定贷款和本息，压力折减不再扣预计收入。</p></div><div class="narrative-distribution-branch"><small>预计现金分配</small><div class="narrative-cash-chain"><span>预计项目现金</span><b aria-hidden="true">→</b><span>储备与约定本息</span><b aria-hidden="true">→</b><span>股东可分配现金</span></div></div></div></figure>`;}
function links(item){return `<nav class="narrative-links" aria-label="研究问题的衔接">${item.previous?`<a href="${esc(item.previous.href)}">${esc(item.previous.text)}</a>`:''}${item.next?`<a href="${esc(item.next.href)}">${esc(item.next.text)} →</a>`:''}</nav>`;}
function currentFinanceReading(view,id){
 if(!['finance-outstanding-web','business-finance-dscr'].includes(id))return;
 const rows=[...view.querySelectorAll('#business-finance-table tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())).filter(row=>row.length===12);
 if(rows.length<12)return;
 const share=view.querySelector('#business-share')?.value,first=rows[0],eleventh=rows[10],last=rows[11];
 if(share==null)return;
 if(id==='finance-outstanding-web')return {selection:share,comparison:`当前合同化收入${share}%，初始贷款${first[4]}百万日元。`,reading:`本金从第1年期末${first[7]}百万日元逐年减少，到第${last[0]}年归零。贷款降低初始资本需求，以后却需要按期付本息；下图继续看当年现金能否覆盖这些付款。`};
 return {selection:share,comparison:`当前合同化收入${share}%；预计现金与银行压力现金的本息覆盖率。`,reading:`首年预计可偿债现金${first[2]}百万日元，覆盖本息${first[8]}倍；银行压力审查按${first[3]}百万日元、${first[9]}倍判断贷款。第${eleventh[0]}年起换电储备筹完，覆盖率升至${eleventh[8]}和${eleventh[9]}倍，变化来自储备现金的释放。压力路径用于定债，预计分配仍按预计现金和约定本息计算。`};
}
const selected=(view,selector)=>{const s=view.querySelector(selector);return s?{value:s.value,label:s.selectedOptions[0]?.textContent.trim()??s.value}:undefined;};
function tableRows(view,headers){
 const table=[...view.querySelectorAll('table')].find(t=>headers.every(h=>[...t.querySelectorAll('th')].some(th=>th.textContent.includes(h))));
 return table?[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())):[];
}
function currentStrategyReading(view,id){
 if(!['lab-f10','lab-f11'].includes(id))return;
 const region=selected(view,'#lab-region'),rows=tableRows(view,['策略','毛收益']),months=tableRows(view,['月份 / 天数','中位数','岭回归']);
 const upper=rows.find(x=>x[0].includes('上限')),median=rows.find(x=>x[0].includes('中位数')),ridge=rows.find(x=>x[0].includes('岭回归')),april=months.find(x=>x[0].startsWith('2026-04')),last=months.at(-1);
 if(!region||!upper||!median||!ridge||!april||!last)return;
 const m=april[2].split(' / '),q=april[3].split(' / '),oct=last[3].split(' / '),higher=Number(m[0].replaceAll(',',''))>Number(q[0].replaceAll(',',''))?'高于':'不高于';
 const selection=region.value+'|2026';
 if(id==='lab-f10')return {selection,comparison:`当前${region.label}，2026年1月1日至10月5日278天，按历史实价结算。`,reading:`4月中位数策略留下${m[0]}百万日元，${higher}岭回归的${q[0]}百万。全期理论机会${upper[1]}百万，事前中位数和岭回归分别取得${median[1]}、${ridge[1]}百万。总体结果和单月排名需要一起看，才能及时发现策略不适合的市场阶段；10月只覆盖五天。`};
 return {selection,comparison:`当前${region.label}，同一2026年278天的理论机会捕获率。`,reading:`4月中位数和岭回归分别捕获${m[1]}、${q[1]}，全期分别为${median[2]}、${ridge[2]}。与金额一起看，就能分清收入减少来自机会变小，还是计划兑现能力变弱。10月岭回归${oct[1]}只来自五天，还需继续观察。`};
}
function currentRiskReading(view,id){
 if(!['lab-f12','lab-f13','risk-daily-hist'].includes(id))return;
 const region=selected(view,'#lab-region'),window=selected(view,'#lab-window'),strategy=selected(view,'#lab-risk-strategy'),months=tableRows(view,['Gross 百万JPY','日均 千JPY']),first=months[0],last=months.at(-1);
 if(!region||!window||!strategy||!first||!last)return;
 const scope=view.querySelector('#lab-panel .lab-intro')?.textContent.trim(),selection=[region.value,window.value,strategy.value].join('|'),comparison=`当前${region.label} · ${strategy.label}；${scope??window.label}`;
 const misread='';
 if(id==='lab-f12')return {selection,comparison,misread,reading:`${first[0]}的${first[1]}天合计${first[2]}百万日元、日均${first[3]}千日元；${last[0]}的${last[1]}天则合计${last[2]}百万、日均${last[3]}千。月总额小可能只是天数较少，日均值才能帮助辨认较弱收入阶段。接着看跨月弱段，把资金缓冲安排到需要它的时候。`};
 if(id==='lab-f13')return {selection,comparison,misread,reading:'连续30日合计把日历月切开的弱段连接起来。弱收入若与买电周转、固定支出或本息日重叠，资金压力可能远高于全期均值；缓冲应按这些时段准备。'};
 const losses=[...view.querySelectorAll('#lab-panel .lab-stat')].find(x=>x.querySelector('span')?.textContent.trim()==='亏损天数')?.querySelector('strong')?.textContent.trim();
 return {selection,comparison,misread,reading:`当前序列有${losses??'页面上方列示的'}个亏损日。高收益日能拉高总额，弱日和亏损日仍要支付经营支出；运营资金不能只按全期平均值安排。`};
}
function currentJointReading(view,id){
 if(!['operations-f05','joint-monthly-web'].includes(id))return;
 const region=selected(view,'#ops-joint-region');if(!region)return;
 const selection=region.value;
 if(id==='operations-f05'){
  const rows=tableRows(view,['策略','影子损耗后']),spot=rows.find(x=>x[0]==='Spot-only'),fixed=rows.find(x=>x[0]==='FixedReserve'),joint=rows.find(x=>x[0]==='JointRolling'),upper=rows.find(x=>x[0]==='PerfectInformation');
  if(!spot||!fixed||!joint||!upper)return;
  return {selection,comparison:`当前${region.label}，同一188天内四种策略的日均经济贡献。`,reading:`固定预留留下${fixed[2]}日元／日，联合滚动为${joint[2]}；纯现货为${spot[2]}，已知未来信息的比较为${upper[2]}。收到新信息后重排资源，能改变平均利用效率；是否改善较弱日，还要接着看P10和现金缓冲。这里已计非现金电池消耗，项目现金另加回。`};
 }
 const tips=[...view.querySelectorAll('#ops-joint-month [data-tip]')].map(x=>x.dataset.tip),first=tips[0],last=tips.at(-1);if(!first||!last)return;
 return {selection,comparison:`当前${region.label}，2026年4月至10月5日的日均经济贡献。`,reading:`蓝线纯现货与金线联合滚动，要经过不同的月度强弱阶段。首月为${first}；末月为${last}，10月仅五天。把较弱月份接到买电周转和固定支出，比只看平均提升更有助于资金安排；现金年化先加回非现金消耗。`};
}
function currentControlReading(view,r,id){
 const metric=(label,root=view)=>[...root.querySelectorAll('.lab-stat,.ops-metric,.business-metric')].find(x=>x.querySelector('span')?.textContent.trim()===label)?.querySelector('strong')?.textContent.trim();
 const tips=selector=>[...view.querySelectorAll(selector+' [data-tip]')].map(x=>x.dataset.tip);
 if(r==='#lab/anatomy'){
  const region=selected(view,'#lab-region'),window=selected(view,'#lab-window');if(!region||!window)return;
  const selection=region.value+'|'+window.value,comparison=`当前${region.label}；${view.querySelector('#lab-panel .lab-intro')?.textContent.trim()??window.label}`;
  if(region.value==='chubu'&&window.value==='2026ytd')return {selection,comparison,reading:data.figures[id]?.reading};
  const reading={
   'lab-f01':'较高晚峰同时可能伴随更贵的午间补电。对照同月买入与卖出时段，再看这种差额在不同月份是否稳定，才能判断较高电价留下多少交易空间。',
   'lab-f02':'中位数看常见的日内节奏，分位线之间的距离看同一时段的偏离。交易可以借助这种规律，计划仍要判断当天会偏向哪一侧。',
   'lab-f03':'较大的日内价差值得关注，兑现多少还取决于高低价持续多久、出现的顺序，以及电池能搬多少电。只有半小时的高价无法卖完一池库存。',
   'lab-f04':'工作日和周末的价格水平可以不同，可利用买卖差额却未必同幅变化。出售价格更高时，也要同时看购电成本是否增加。',
   'anatomy-spread-hist':data.figures[id]?.reading,
   'anatomy-frequency':data.figures[id]?.reading
  }[id];
  return reading?{selection,comparison,reading}:undefined;
 }
 if(r==='#lab/replay'){
  const region=selected(view,'#lab-region'),strategy=selected(view,'#lab-replay-strategy'),day=view.querySelector('#lab-replay-date')?.value;if(!region||!strategy||!day)return;
  const base={selection:[region.value,day,strategy.value].join('|'),comparison:`当前${region.label} · ${day} · ${strategy.label}`};
  if(id==='replay-cash')return {...base,reading:`同一天先支付${metric('买电成本')??'上方列示的'}日元购电，再收到${metric('卖电收入')??'上方列示的'}日元卖电回款，实际结算差额为${metric('套利毛收益')??'上方列示的'}日元。现金低谷体现购电周转需求，日末差额还要覆盖项目费用和投资。`};
  return {...base,reading:data.figures[id]?.reading};
 }
 if(r==='#lab/frontier'&&id==='lab-f14'){
  const region=selected(view,'#lab-region'),reserve=view.querySelector('#lab-reserve-slider')?.value;if(!region||reserve==null)return;
  return {selection:[region.value,reserve,...['price','hours','ratio','fee'].map(k=>view.querySelector('#lab-capacity-'+k)?.value)].join('|'),comparison:`当前${region.label}，2026年278天；当前容量付款与预留参数。`,reading:`预留${reserve}MW后，现货毛收益留下${metric('预留后现货毛收益')}百万日元，相对零预留放弃${metric('放弃现货毛收益')}百万；加容量扣费情景后合计${metric('资源竞争后合计情景')}百万。沿曲线看新增付款何时开始抵不过更多现货损失，才能选择预留量；合计尚未扣全部经营费用。`};
 }
 if(r==='#lab/economics'&&id==='lab-f15'){
  const region=selected(view,'#lab-region'),day=selected(view,'#lab-rule-day');if(!region||!day)return;
  return {selection:region.value+'|'+day.value,comparison:`当前${region.label} · ${day.label}；同样预留12小时。`,reading:`3小时区块留下${metric('粗块现货毛收益')}日元现货毛收益，30分钟区块为${metric('30min现货毛收益')}日元，多出${metric('灵活性上限差额')}日元。较短区块能够绕开更多有价值的现货时段；差额展示已知价格下的安排空间，实际仍须在申报时作出选择。`};
 }
 if(r==='#lab/bridge'&&id==='p1-waterfall'){
  const region=selected(view,'#lab-region'),basis=selected(view,'#p1-bridge-basis');if(!region||!basis)return;
  return {selection:[region.value,basis.value,view.querySelector('#p1-scenario-name')?.textContent].join('|'),comparison:`当前${region.label} · ${basis.label}；${view.querySelector('#p1-basis-period')?.textContent.trim()??''}`,reading:`当前毛市场机会为${metric('毛市场机会')}百万日元，列示成本合计${metric('列示成本合计')}百万，经营贡献剩${metric('经营贡献情景')}百万。市场、聚合和网络费用侵蚀差额，电池使用消耗寿命；非现金消耗在项目现金中加回，再按实际更换年份支付预算。`};
 }
 if(r==='#operations/bidding'){
  const region=selected(view,'#ops-bid-region');if(!region)return;
  if(id==='operations-f01')return {selection:region.value,comparison:`当前${region.label}，2026年4月1日至10月5日的已成交区块均价分布。`,reading:`${tips('#ops-bid-distribution').join('；')}。中位价格和分布宽度描述当地历史报价环境；具体电站仍按自身中标价付款，报价还需覆盖机会和履约成本。`};
  if(id==='operations-f02')return {selection:[region.value,view.querySelector('#ops-bid-price')?.value,view.querySelector('#ops-q')?.value].join('|'),comparison:`当前${region.label}；自身报价和设定中标率的成本覆盖。`,reading:`当前报价的期望净贡献为${metric('C 报价期望净贡献')??'上方列示值'}。容量付款需要补偿已承诺资源的现货机会与履约费用，热图帮助看什么价与胜率组合能留下钱；胜率是情景输入。`};
 }
 if(r==='#operations/activation'){
  const level=selected(view,'#ops-act-case'),reserve=selected(view,'#ops-act-reserve'),soc=selected(view,'#ops-act-soc');if(!level||!reserve||!soc)return;
  const base={selection:[level.value,reserve.value,soc.value].join('|'),comparison:`当前${level.label} · ${reserve.label} · 初始库存${soc.label}；同一人工调用代表日。`};
  if(id==='operations-f03')return {...base,reading:`调用和恢复后，期末库存为${metric('期末SOC')}，物理循环消耗为${metric('实际物理EFC')}。库存波动小，可能来自恢复动作持续补电；需要同时检查购电、吞吐和交付不足，才能判断履约代价。`};
  if(id==='operations-f04')return {...base,reading:`容量和调用付款经过恢复购电、交易与辅机等支出；再计非现金电池消耗及放弃的现货机会，比较差额为${metric('扣机会与影子损耗后')}。恢复支出可能吃掉大部分容量付款，报价与库存恢复应一起判断。`};
 }
 if(r==='#operations/reliability'&&id==='operations-f10'){
  const level=selected(view,'#ops-reliability');if(!level)return;
  return {selection:level.value,comparison:`当前${level.label}可用率故障情景；年度运营现金分位数。`,reading:`${tips('#ops-reliability-cash').join('；')}。目标可用率相同，故障发生的时点和持续时间仍会带来不同现金；服务保证应看实际损失，也要看年度可用率。`};
 }
 if(r==='#operations/markets'&&id==='markets-f02'){
  const service=selected(view,'#ops-service'),measure=selected(view,'#ops-foreign-metric');if(!service||!measure)return;
  const september=tips('#ops-gb-eac').find(x=>x.startsWith('2026-09'));
  return {selection:service.value+'|'+measure.value,comparison:`当前${service.label} · ${measure.label}；英国EAC公开月度成交窗口。`,reading:`${september??tips('#ops-gb-eac').at(-1)??'图中显示当前商品的逐月结果'}。英国服务方向会改变容量承诺的付款价值：负容量价表示提供方付款。是否值得承诺，要比较接受这项服务相对不接受时的增量现金，包括相关电能交易与机会成本。`};
 }
 if(r==='#business/policy'&&id==='policy-workspace-web')return {selection:[view.querySelector('#business-policy-profit')?.value,view.querySelector('#business-policy-loss')?.value].join('|'),comparison:'当前他市场利润及亏损结转输入。',reading:`利润结转后为${metric('利润结转后')}日元，返还${metric('返还额')}日元，LTDA扣返还留下${metric('LTDA收入扣返还')}日元。返还可能超过容量付款，需要把实际支付时点放进项目资金安排。`};
 if(r==='#business/use-cases'&&id==='business-pv-energy')return {selection:view.querySelector('#business-export-limit')?.value,comparison:`当前共用出口上限${view.querySelector('#business-export-limit')?.value}MW；同一合成光储日。`,reading:`电池减少弃光${metric('减少弃光')}，有效放电${metric('有效放电')}。共用出口决定能搬多少电，自用和出口的合同决定现金归谁；回收能量还需按各自计价方式转成收入。`};
}
function currentFigureReading(view,r,id){
 return (r==='#business/finance'?currentFinanceReading(view,id):r==='#lab/strategy'?currentStrategyReading(view,id):r==='#lab/risk'?currentRiskReading(view,id):r==='#operations/joint'?currentJointReading(view,id):undefined)??currentControlReading(view,r,id);
}
function apply(){
 if(!data)return;const r=route(),view=document.querySelector('.view:not([hidden])');if(!view?.querySelector('h1,h2'))return;
 const item=data.routes?.[r],host=view.querySelector('.research-wrap')??view;
 if(item){
  if(item.title){const title=view.querySelector('h1');if(title&&title.textContent!==item.title)title.textContent=item.title;}
  const old=view.querySelector('[data-narrative-context]');
  if(!old||old.dataset.narrativeRoute!==r){
   old?.remove();const p=document.createElement('section');p.className='narrative-context';p.dataset.narrativeContext='';p.dataset.narrativeRoute=r;const hasSummary=!!view.querySelector('[data-editorial-summary]');p.innerHTML=`${item.context&&(!hasSummary||(!item.r3_copy&&item.context!==item.result_lead))?`<p>${esc(item.context)}</p>`:''}${item.cash_chain?cashChain():''}${item.bridge?`<p>${esc(item.bridge)}</p>`:''}${links(item)}`;
   const anchor=view.querySelector('[data-editorial-summary]')??view.querySelector('.page-heading,.ops-top,.research-head')??host.firstElementChild;anchor?.insertAdjacentElement('afterend',p);
  }
  const summary=view.querySelector('[data-editorial-summary]');
  if(summary&&item.result_lead){const p=summary.querySelector('p');if(p&&p.textContent!==item.result_lead)p.textContent=item.result_lead;}
  if(summary&&item.r3_copy){const heading=summary.querySelector('h2');if(heading&&item.result_title&&heading.textContent!==item.result_title)heading.textContent=item.result_title;summary.querySelector('.editorial-essential')?.remove();}
  if(summary&&r==='#lab/strategy'){
   const region=selected(view,'#lab-region'),rows=tableRows(view,['策略','毛收益']),p=summary.querySelector('p');
   if(region&&p&&rows.length>=3){const upper=rows.find(x=>x[0].includes('上限')),median=rows.find(x=>x[0].includes('中位数')),ridge=rows.find(x=>x[0].includes('岭回归'));if(upper&&median&&ridge){const text=`当前${region.label}，2026年1月1日至10月5日278天：理论毛套利机会${upper[1]}百万日元，事前中位数策略结算${median[1]}百万，岭回归${ridge[1]}百万、捕获${ridge[2]}。计划抓住了多少差额，比价格预测误差更接近业务结果；这些金额尚未扣项目费用。`;if(p.textContent!==text)p.textContent=text;}}
  }
  if(summary&&item.result_points){let ul=summary.querySelector('ul');if(!item.result_points.length)ul?.remove();else{if(!ul){ul=document.createElement('ul');summary.append(ul);}const wanted=item.result_points.map(x=>`<li>${esc(x)}</li>`).join('');if(ul.innerHTML!==wanted)ul.innerHTML=wanted;}}
  if(item.copy_changes)for(const change of item.copy_changes){for(const node of view.querySelectorAll(change.selector??'h2,h3,p,small,td,th')){if(node.closest('[data-narrative-context],.narrative-figure-reading')||node.textContent.trim()!==change.before)continue;if(!node.querySelector('input,select,button,a,svg'))node.textContent=change.after;}}
  if(item.collapse_headings)for(const heading of item.collapse_headings){
   const title=[...view.querySelectorAll('h2,h3')].find(x=>x.textContent.trim()===heading);
   const card=title?.closest('article.card');if(card&&!card.closest('details')){const fold=document.createElement('details');fold.className='narrative-methods';fold.innerHTML='<summary>更新记录与处理方法</summary>';card.before(fold);fold.append(card);}
  }
  const charts=[...view.querySelectorAll('svg')].filter(x=>!x.closest('details'));
  if(r==='#operations/joint'){
   const power=view.querySelector('#ops-joint-power');
   if(power&&!view.querySelector('[data-narrative-power-legend]')){const legend=document.createElement('p');legend.className='ops-note';legend.dataset.narrativePowerLegend='';legend.textContent='蓝线：实际净并网功率；金线：已交付调用。调用已经计入净并网功率，两条线不能相加。';power.before(legend);}
  }
  for(const binding of item.figures??[]){
   const f=data.figures[binding.id];if(!f)continue;const node=binding.selector?view.querySelector(binding.selector):charts[binding.chart_index??0];if(!node)continue;
   const container=node.closest('.ops-card,.lab-v2-card,.lab-card,.feas-card,.forward-card,.business-panel,.business-section,.card,figure,article')??node.parentElement;
   let note=container.querySelector(`[data-narrative-figure="${CSS.escape(binding.id)}"]`);if(!note){note=document.createElement('div');note.className='narrative-figure-reading';note.dataset.narrativeFigure=binding.id;const wrap=node.closest('.business-diagram-wrap,.chart-wrap,.ops-chart-wrap')??node;wrap.insertAdjacentElement('afterend',note);}
   const current=currentFigureReading(view,r,binding.id);
   const comparison=current?.comparison??f.comparison,reading=current?.reading??f.reading;
   const lead=r==='#business/commercial'&&binding.id==='business-commercial-allocation'?'此图一次显示当前贡献池的三种业主分配；请用上方滑块依次选8、20、32m JPY，对照下述三池比较。':'';
   const misread=current?.misread??f.misread;
   const markup=`${comparison?`<small class="narrative-figure-scope">${esc(comparison)}</small>`:''}<p>${esc(lead+reading)}${misread?' '+esc(misread):''}</p>`;
   if(note.innerHTML!==markup)note.innerHTML=markup;
   if(current)note.dataset.narrativeSelection=current.selection;
  }
 }
 if(data.entries?.[r]&&!isNavigationRoute(r)){
  const entry=data.entries[r];let intro=view.querySelector('[data-narrative-entry]');
  if(!intro){intro=document.createElement('section');intro.className='narrative-entry';intro.dataset.narrativeEntry='';intro.innerHTML=`<p>${esc(entry.lead)}</p>${entry.cash_chain?cashChain():''}${entry.bridge?`<p>${esc(entry.bridge)}</p>`:''}${entry.path?.length?`<ol>${entry.path.map(x=>`<li><a href="${esc(x.href)}">${esc(x.title)}</a><p>${esc(x.why)}</p></li>`).join('')}</ol>`:''}`;const anchor=view.querySelector('.research-head')??host.querySelector('h1');anchor?.insertAdjacentElement('afterend',intro);}
 }
 const library=view.querySelector('[data-r3-report-library]');
 if(library){
  library.classList.add('narrative-report-library');
  const order=data.reading_order??['memo','lab','operations','p1','feasibility','business','forward','markets'];
  const markup=order.map((key,i)=>{const report=data.current_reports?.[key];if(!report)return '';return `<article class="narrative-report-card"><span class="narrative-report-order">${i+1}</span><div><h3>${esc(report.title)}</h3>${report.pages?`<p>${report.pages}页正文${report.reference_pages?` · ${report.reference_pages}页参考资料`:''}</p>`:''}<div class="narrative-report-links"><a class="button primary" href="./${esc(report.href)}" download data-current-formal-report="${esc(key)}">阅读正文 PDF</a>${report.reference_href?`<a class="narrative-reference-link" href="./${esc(report.reference_href)}" download data-reference-report="${esc(key)}">参考资料 PDF ↓</a>`:''}</div></div></article>`;}).join('');
  if(library.innerHTML!==markup)library.innerHTML=markup;
 }
 // Current downloads are explicit. Historical files keep their original URLs and bytes in a low-priority fold.
 for(const a of view.querySelectorAll('a[download]')){
  if(a.closest('[data-narrative-archive]')||a.hasAttribute('data-reference-report'))continue;const old=a.getAttribute('href')?.replace(/^\.\//,'');const report=data.report_links?.[old];if(report){a.href='./'+report.current_href;a.textContent=report.title+' ↓';a.dataset.currentFormalReport=report.id;const reference=report.reference_href??data.current_reports?.[report.id]?.reference_href;if(reference&&!a.nextElementSibling?.hasAttribute('data-reference-report')){const link=document.createElement('a');link.className='narrative-reference-link';link.href='./'+reference;link.setAttribute('download','');link.dataset.referenceReport=report.id;link.textContent='参考资料 ↓';a.after(link);}}
 }
 const context=document.querySelector('#context-report');if(isNavigationRoute(r)){document.querySelector('[data-context-reference]')?.remove();}else if(context){const key=item?.source_book??(r.startsWith('#business')||r==='#modules'?'business':'operations');const rep=data.current_reports[key];if(rep){const href='./'+rep.href;if(context.getAttribute('href')!==href)context.setAttribute('href',href);const label='下载本册正文';if(context.textContent!==label)context.textContent=label;context.title=rep.title;context.dataset.currentFormalReport=key;const reference=document.querySelector('[data-context-reference]');if(rep.reference_href){const link=reference??document.createElement('a');link.className='narrative-reference-link';link.dataset.contextReference='';link.href='./'+rep.reference_href;link.setAttribute('download','');link.textContent='参考资料 ↓';if(!reference)context.after(link);}else reference?.remove();}}
 if(['#market-operations','#business'].includes(r)&&!view.querySelector('[data-narrative-archive]')){
  const old=data.historical_reports.filter(x=>r==='#business'?x.major==='B':x.major==='A');const fold=document.createElement('details');fold.className='card narrative-archive';fold.dataset.narrativeArchive='';fold.innerHTML=`<summary>历史报告</summary><div class="research-links">${old.map(x=>`<a href="./${esc(x.href)}" download>${esc(x.title)}（历史版本） ↓</a>`).join('')}</div>`;host.append(fold);
 }
 if(r==='#lab/strategy')for(const legend of view.querySelectorAll('.chart-legend,.lab-legend')){const prior=legend.previousElementSibling;if(prior?.matches('.narrative-figure-reading'))prior.before(legend);}
 syncMobileFigures(view,r);
 view.dataset.narrativeReady='true';view.dataset.narrativeRoute=r;
}
function update(){observer?.disconnect();try{apply();}finally{observer?.observe(document.querySelector('#main'),{childList:true,subtree:true,characterData:true});}}
export async function startNarrative(){const response=await fetch('./data/narrative-v2-8.json');if(!response.ok)throw Error('研究正文未能载入');data=await response.json();observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(update,55);});observer.observe(document.querySelector('#main'),{childList:true,subtree:true,characterData:true});window.addEventListener('hashchange',()=>setTimeout(update,80));update();}
