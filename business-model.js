// Independent browser implementation of the research financing/energy model.
// JPY, annual end-period cash; inputs are C, outputs B. No company loan terms.
export const DEFAULT={capex:150e6,gross_revenue:20e6,opex:5e6,years:20,tenor:12,interest:.04,contracted_share:0,target_dscr:1.3,merchant_haircut:.4,contracted_haircut:.05,reserve_years:.5,discount:.07,replacement_year:11,replacement_cost:20e6,decommission:5e6};
const finite=(v,name,min=-Infinity)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min)throw Error('Invalid finite number: '+name);return v;};
const finiteSeries=(a,name)=>{if(!Array.isArray(a))throw Error('Invalid array: '+name);return a.map(v=>finite(v,name));};
export function npv(flows,rate){finite(rate,'discount');flows=finiteSeries(flows,'cash flows');if(rate<=-1)throw Error('Invalid discount');return flows.reduce((s,v,t)=>s+v/(1+rate)**t,0);}
const poly=(c,x)=>c.reduceRight((s,v)=>s*x+v,0);
function positiveRoots(input){
 let c=[...input];while(c.length&&Math.abs(c.at(-1))<1e-14)c.pop();if(c.length<2)return [];
 const scale=Math.max(...c.map(Math.abs));c=c.map(v=>v/scale);
 if(c.length===2)return -c[0]/c[1]>0?[-c[0]/c[1]]:[];
 const bound=1+Math.max(...c.slice(0,-1).map(v=>Math.abs(v/c.at(-1))));
 const critical=positiveRoots(c.slice(1).map((v,i)=>v*(i+1))).filter(x=>x<bound);
 const points=[0,...critical,bound],roots=[];
 for(const x of critical)if(Math.abs(poly(c,x))<1e-10)roots.push(x);
 for(let i=0;i<points.length-1;i++){
  let lo=points[i],hi=points[i+1],a=poly(c,lo),b=poly(c,hi);if(a*b>=0)continue;
  for(let k=0;k<100;k++){const mid=(lo+hi)/2,v=poly(c,mid);if(v*a<=0){hi=mid;b=v;}else{lo=mid;a=v;}}
  const x=(lo+hi)/2;if(x>0)roots.push(x);
 }
 return roots.sort((a,b)=>a-b).filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>1e-7);
}
export function irrRoots(flows){return positiveRoots(finiteSeries(flows,'IRR cash flows')).map(x=>1/x-1).sort((a,b)=>a-b);}
export function annuityFactor(rate,tenor){finite(rate,'interest',0);if(!Number.isInteger(tenor)||tenor<1)throw Error('Debt terms');return rate===0?1/tenor:rate/(1-(1+rate)**-tenor);}
export function debtSchedule(debt,rate,tenor){finite(debt,'debt',0);const payment=debt*annuityFactor(rate,tenor);let balance=debt;return Array.from({length:tenor},(_,i)=>{const interest=balance*rate,principal=i===tenor-1?balance:payment-interest,opening_balance=balance;balance=Math.max(0,balance-principal);return {year:i+1,opening_balance,interest,principal,debt_service:interest+principal,closing_balance:balance};});}
export function financeModel(parameters={}){
 if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw Error('Invalid parameters');
 const c={...DEFAULT,...parameters},n=c.years,tenor=c.tenor,share=c.contracted_share;
 for(const k of ['contracted_share','target_dscr','merchant_haircut','contracted_haircut','discount'])finite(c[k],k);
 if(!Number.isInteger(n)||n<1||!Number.isInteger(tenor)||tenor<1||tenor>n||share<0||share>1)throw Error('Horizon/share');
 for(const k of ['capex','gross_revenue','opex','interest','reserve_years','replacement_cost','decommission'])if(!Number.isFinite(c[k])||c[k]<0)throw Error(k);
 if(c.capex<=0||c.target_dscr<=0||c.merchant_haircut<0||c.merchant_haircut>1||c.contracted_haircut<0||c.contracted_haircut>1)throw Error('Sizing');
 const ry=c.replacement_year,rc=c.replacement_cost;if(!Number.isInteger(ry)||ry<2||ry>n)throw Error('Replacement year');
 const revenues=finiteSeries(Object.hasOwn(c,'annual_revenue')?c.annual_revenue:Array(n).fill(c.gross_revenue),'annual revenue'),costs=finiteSeries(Object.hasOwn(c,'annual_opex')?c.annual_opex:Array(n).fill(c.opex),'annual opex');
 if(revenues.length!==n||costs.length!==n||[...revenues,...costs].some(v=>v<0||!Number.isFinite(v)))throw Error('Annual inputs');
 const reserveContribution=rc/(ry-1),available=[],downside=[],net=[];
 for(let y=1;y<=n;y++){const r=revenues[y-1],o=costs[y-1],contribution=y<ry?reserveContribution:0,close=y===n?c.decommission:0,haircut=share*c.contracted_haircut+(1-share)*c.merchant_haircut;available.push(r-o-contribution-close);downside.push(r*(1-haircut)-o-contribution-close);net.push(r-o-(y===ry?rc:0)-close);}
 const factor=annuityFactor(c.interest,tenor),supported=Math.max(0,Math.min(...downside.slice(0,tenor)))/c.target_dscr/factor;
 const debt=c.debt==null?Math.min(c.capex,supported):c.debt;if(!Number.isFinite(debt)||debt<0||debt>c.capex)throw Error('Debt exceeds CAPEX');
 const schedule=debtSchedule(debt,c.interest,tenor),service=schedule[0].debt_service,dsra=service*c.reserve_years;
 const project=[-c.capex,...net],equity=[-(c.capex-debt+dsra)],annual=[];let balance=0;
 for(let y=1;y<=n;y++){const d=y<=tenor?schedule[y-1]:{opening_balance:0,interest:0,principal:0,debt_service:0,closing_balance:0},funded=y<ry?reserveContribution:0,release=y===ry?rc:0;balance+=funded-release;const cash=available[y-1]-d.debt_service+(y===tenor?dsra:0);equity.push(cash);annual.push({year:y,gross_revenue:revenues[y-1],opex:costs[y-1],project_cash:net[y-1],cfads:available[y-1],lender_cfads:downside[y-1],...d,dscr:d.debt_service>1e-8?available[y-1]/d.debt_service:null,lender_dscr:d.debt_service>1e-8?downside[y-1]/d.debt_service:null,augmentation_contribution:funded,augmentation_release:release,augmentation_balance:balance,dsra_release:y===tenor?dsra:0,equity_cash:cash});}
 const pr=irrRoots(project),er=irrRoots(equity),minimum=key=>{const v=annual.map(r=>r[key]).filter(x=>x!==null);return v.length?Math.min(...v):null;};
 const required=Array.from({length:tenor},(_,y)=>revenues[y]>0?(debt*factor*c.target_dscr+costs[y]+(y+1<ry?reserveContribution:0)+(y+1===n?c.decommission:0))/revenues[y]:Infinity),denom=c.merchant_haircut-c.contracted_haircut;
 let minshare=denom>0?Math.max(...required.map(q=>(q-(1-c.merchant_haircut))/denom)):required.every(q=>q<=1-c.merchant_haircut)?0:Infinity;
 minshare=minshare<0?0:minshare<=1?minshare:null;
 return {parameters:c,evidence_level:'B from C inputs',debt_amount:debt,leverage:debt/c.capex,annual_debt_service:service,dsra,equity_requirement:c.capex-debt+dsra,minimum_dscr:minimum('dscr'),lender_minimum_dscr:minimum('lender_dscr'),project_irr:pr.length===1?pr[0]:null,project_irr_roots:pr,equity_irr:er.length===1?er[0]:null,equity_irr_roots:er,project_npv:npv(project,c.discount),equity_npv:npv(equity,c.discount),break_even_debt:supported,break_even_contracted_share:minshare,covenant_pass:debt===0||minimum('lender_dscr')>=c.target_dscr-1e-8,project_flows:project,equity_flows:equity,annual};
}
export function pvBess({capacity=2,power=.8,exportLimit=1,loadMW=.35,eta=.95}={}){
 for(const [name,value] of Object.entries({capacity,power,exportLimit,loadMW,eta}))finite(value,name,0);
 if(Math.min(capacity,power,exportLimit,loadMW)<0||eta<=0||eta>1)throw Error('Energy parameters');
 const floor=.1*capacity,ceiling=.9*capacity;let soc=floor;const rows=[];
 for(let t=0;t<48;t++){const h=t*.5,pvMW=h>=6&&h<=18?2.4*Math.max(0,Math.sin(Math.PI*(h-6)/12)):0,pv=pvMW*.5,load=loadMW*.5,selfUse=Math.min(pv,load),surplus=pv-selfUse,pvExport=Math.min(surplus,exportLimit*.5),spill=surplus-pvExport,charge=Math.min(spill,power*.5,Math.max(0,(ceiling-soc)/eta)),before=soc;soc+=charge*eta;
 const discharge=h>=17?Math.min(power*.5,Math.max(0,soc-floor)*eta,load-selfUse+Math.max(0,exportLimit*.5-pvExport)):0;soc-=discharge/eta;const toLoad=Math.min(discharge,load-selfUse),bessExport=discharge-toLoad;
 rows.push({slot:t+1,hour_jst:h,pv_mwh:pv,load_mwh:load,pv_self_mwh:selfUse,pv_export_mwh:pvExport,charge_mwh:charge,curtailment_mwh:spill-charge,discharge_mwh:discharge,bess_self_mwh:toLoad,bess_export_mwh:bessExport,grid_import_mwh:load-selfUse-toLoad,soc_before_mwh:before,soc_after_mwh:soc,loss_mwh:charge*(1-eta)+discharge*(1/eta-1),baseline_curtailment_mwh:spill});}
 const fields=Object.keys(rows[0]).filter(k=>k.endsWith('_mwh')&&!k.startsWith('soc')),totals=Object.fromEntries(fields.map(k=>[k,rows.reduce((s,r)=>s+r[k],0)]));
 return {parameters:{capacity_mwh:capacity,power_mw:power,export_limit_mw:exportLimit,load_mw:loadMW,charge_efficiency:eta,discharge_efficiency:eta,source:'synthetic C, not measured solar output'},rows,totals,initial_soc_mwh:floor,final_soc_mwh:soc};
}
export function vppAvailable(resources){if(!Array.isArray(resources)||resources.some(r=>!r||typeof r!=='object'))throw Error('Invalid resources');if(new Set(resources.map(r=>r.id)).size!==resources.length)throw Error('Duplicate resource');const out=resources.map(r=>{finite(r.kw,'resource kW',0);finite(r.availability,'availability',0);if(r.availability>1||typeof r.qualified!=='boolean'||typeof r.telemetry!=='boolean')throw Error('Resource');return {...r,eligible_available_kw:r.qualified&&r.telemetry?r.kw*r.availability:0};});return {resources:out,nameplate_kw:out.reduce((s,r)=>s+r.kw,0),eligible_available_kw:out.reduce((s,r)=>s+r.eligible_available_kw,0),rule:'C qualification/availability scenario for one selected product; not blanket market eligibility'};}
export function demandBill(currentPeaks,prior11,rate){finite(rate,'demand rate',0);currentPeaks=finiteSeries(currentPeaks,'current peaks');prior11=finiteSeries(prior11,'previous peaks');if(prior11.length!==11||[...prior11,...currentPeaks].some(p=>p<0))throw Error('Demand history');let h=[...prior11];return currentPeaks.map((p,i)=>{h.push(p);h=h.slice(-12);const contract=Math.max(...h);return {month:i+1,measured_peak_kw:p,contract_kw:contract,basic_charge_jpy:contract*rate};});}
