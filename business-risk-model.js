/** Deterministic B arithmetic from explicit C stress magnitudes. See risk_model.py. */
const KEYS=new Set(['outage_days','outage_year','delay_years','extra_capex','annual_insurance','construction_opex','replacement_cost','replacement_year']);
function number(value,name,min=0){if(typeof value!=='number'||!Number.isFinite(value)||value<min)throw new Error(`Invalid ${name}`);return value;}
function integer(value,name,min,max){if(!Number.isInteger(value)||value<min||value>max)throw new Error(`Invalid ${name}`);return value;}
function annual(config,key,fallback,years){const a=Object.hasOwn(config,key)?config[key]:Array(years).fill(fallback);if(!Array.isArray(a)||a.length!==years)throw new Error(`Invalid ${key}`);return a.map(v=>number(v,key));}
export function adjustRisk(config,risk={}){
  if(risk===null)risk={};
  if(!config||typeof config!=='object'||Array.isArray(config)||!risk||typeof risk!=='object'||Array.isArray(risk)||Object.keys(risk).some(k=>!KEYS.has(k)))throw new Error('Invalid risk/config keys');
  const out=structuredClone(config),years=integer(config.years,'years',1,100),capex=number(config.capex,'capex');
  if(capex<=0)throw new Error('CAPEX must be positive');
  const gross=number(config.gross_revenue,'gross_revenue'),opex=number(config.opex,'opex'),revenues=annual(config,'annual_revenue',gross,years),costs=annual(config,'annual_opex',opex,years);
  const get=(key,fallback)=>Object.hasOwn(risk,key)?risk[key]:fallback;
  const delay=integer(get('delay_years',0),'delay_years',0,years),days=number(get('outage_days',0),'outage_days');
  if(days>365)throw new Error('outage_days cannot exceed the 365-day convention');
  const year=integer(get('outage_year',Math.min(delay+1,years)),'outage_year',1,years);
  if(days>0&&year<=delay)throw new Error('Outage must fall in an operating year');
  const extra=number(get('extra_capex',0),'extra_capex'),insurance=number(get('annual_insurance',0),'annual_insurance'),construction=number(get('construction_opex',0),'construction_opex');
  const revenue=[...Array(delay).fill(0),...revenues.slice(0,years-delay)],cost=[...Array(delay).fill(construction),...costs.slice(0,years-delay).map(v=>v+insurance)];
  const loss=revenue[year-1]*days/365;revenue[year-1]-=loss;
  Object.assign(out,{capex:capex+extra,annual_revenue:revenue,annual_opex:cost});
  if(Object.hasOwn(risk,'replacement_cost'))out.replacement_cost=number(risk.replacement_cost,'replacement_cost');
  if(Object.hasOwn(risk,'replacement_year'))out.replacement_year=integer(risk.replacement_year,'replacement_year',2,years);
  if(config.debt!==undefined&&config.debt!==null){const debt=number(config.debt,'debt');if(debt>capex)throw new Error('Baseline debt exceeds baseline CAPEX');out.debt=debt;}
  out.risk_adjustment_metadata={evidence_level:'C inputs; deterministic B arithmetic',delay_years:delay,outage_days:days,outage_year:year,outage_revenue_loss_jpy:loss,extra_capex_jpy:extra,annual_insurance_jpy:insurance,construction_opex_jpy:construction,insurance_operating_years:years-delay,risk_adjusted_revenue_sum_jpy:revenue.reduce((a,b)=>a+b,0),calendar_rule:'Fixed investment-calendar horizon, debt schedule, replacement year and disposal year',loss_rule:'Outage removes gross revenue pro-rata, including any availability-dependent contracted receipts',not_modelled:['insurance indemnity','deductible','LD recovery','tax','interest during construction','new loan agreement']};
  return out;
}
export function compareRisk(financeFn,config,risk={}){const baseline=financeFn(structuredClone(config)),stressed=financeFn(adjustRisk({...baseline.parameters,debt:baseline.debt_amount},risk));if(Math.abs(stressed.debt_amount-baseline.debt_amount)>1e-7)throw new Error('Risk comparison changed loan amount');return {baseline,stressed,fixed_debt_jpy:baseline.debt_amount,rule:'Baseline sized loan held fixed; C stresses are not expected-loss estimates'};}
