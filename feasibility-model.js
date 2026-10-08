/** Deterministic pretax project cash flow. All applied project parameters are C. */
export function npv(rate, cashflows) {
  if (!Number.isFinite(rate) || rate <= -1 || !cashflows.length || cashflows.some(v=>!Number.isFinite(v))) throw new Error('Invalid discounted cash flow');
  return cashflows.reduce((sum,v,year)=>sum+v/(1+rate)**year,0);
}
export function irr(cashflows) {
  if (!cashflows.some(v=>v>0)||!cashflows.some(v=>v<0)) return {value:null,roots:[],status:'no_sign_change'};
  // Work in log(1+r), covering negative rates and >100% returns. Report multiple roots.
  const roots=[],steps=900,lo=Math.log(.0001),hi=Math.log(101);
  let lastRate=Math.expm1(lo),last=npv(lastRate,cashflows);
  for(let i=1;i<=steps;i++){
    const rate=Math.expm1(lo+(hi-lo)*i/steps),value=npv(rate,cashflows);
    if((last>0&&value<0)||(last<0&&value>0)||value===0){
      let a=lastRate,b=rate,fa=last;
      for(let j=0;j<90;j++){const m=(a+b)/2,f=npv(m,cashflows);if((fa>=0&&f>=0)||(fa<=0&&f<=0)){a=m;fa=f;}else b=m;}
      const root=(a+b)/2;if(!roots.some(v=>Math.abs(v-root)<1e-7))roots.push(root);
    }
    lastRate=rate;last=value;
  }
  return {value:roots.length===1?roots[0]:null,roots,status:roots.length===1?'unique':roots.length>1?'multiple_roots':'outside_search_range'};
}
export function payback(cashflows) {
  let cumulative=cashflows[0];if(cumulative>=0)return 0;
  for(let year=1;year<cashflows.length;year++){const before=cumulative;cumulative+=cashflows[year];if(cumulative>=0&&cashflows[year]>0)return year-1+(-before)/cashflows[year];}
  return null;
}
export function validateEconomics(p){
  const nonnegative=['batteryJPYkWh','pcsJPYkWh','otherEquipmentJPYkWh','epcJPYkWh','connectionJPY','fixedOMJPYkWYear','landJPYYear','insuranceFraction','discountRate','replacementFraction','residualFraction','decommissionFraction','revenueMultiplier','debtFraction','interestRate'];
  if(nonnegative.some(k=>!Number.isFinite(p[k])||p[k]<0)||!Number.isInteger(p.horizonYears)||p.horizonYears<1||p.horizonYears>40||!Number.isInteger(p.debtYears)||p.debtYears<1||p.debtYears>40)throw new Error('投资、费用、利率和时间参数必须完整且非负');
  if(['insuranceFraction','discountRate','replacementFraction','residualFraction','decommissionFraction','debtFraction','interestRate'].some(k=>p[k]>1)||p.revenueMultiplier>3)throw new Error('比例与收入敏感性超出研究范围');
  return p;
}
export function capex(p,energyMWh=8.14){
  return energyMWh*1000*(p.batteryJPYkWh+p.pcsJPYkWh+p.otherEquipmentJPYkWh+p.epcJPYkWh)+p.connectionJPY;
}
export function projectCashflow(lifetime,p,{powerMW=2,energyMWh=8.14,gridDelayYears=0}={}){
  validateEconomics(p);
  if(!Number.isInteger(gridDelayYears)||gridDelayYears<0||gridDelayYears>10||lifetime.years.length<p.horizonYears)throw new Error('Invalid operating life or grid delay');
  const investment=capex(p,energyMWh),fixedOM=powerMW*1000*p.fixedOMJPYkWYear,insurance=investment*p.insuranceFraction;
  const replacementCost=energyMWh*1000*p.batteryJPYkWh*p.replacementFraction;
  const rows=[{year:0,operatingYear:0,investment:-investment,spotCash:0,capacityCash:0,fixedOM:0,land:0,insurance:0,replacement:0,residual:0,decommission:0,freeCashflow:-investment,cumulative:-investment}];
  let cumulative=-investment;
  // CAPEX is spent at year0. Waiting consumes insurance/land but no cycling/calendar age:
  // commissioning starts the battery age clock; pre-COD cell ageing is an omitted risk.
  for(let year=1;year<=gridDelayYears;year++){
    const freeCashflow=-p.landJPYYear-insurance;cumulative+=freeCashflow;
    rows.push({year,operatingYear:0,investment:0,spotCash:0,capacityCash:0,fixedOM:0,land:-p.landJPYYear,insurance:-insurance,replacement:0,residual:0,decommission:0,freeCashflow,cumulative});
  }
  for(let operatingYear=1;operatingYear<=p.horizonYears;operatingYear++){
    const life=lifetime.years[operatingYear-1],year=operatingYear+gridDelayYears;
    const spotCash=life.spotCash*p.revenueMultiplier,capacityCash=life.capacityCash*p.revenueMultiplier;
    const replacement=life.replacement?-replacementCost:0;
    const residual=operatingYear===p.horizonYears?investment*p.residualFraction:0;
    const decommission=operatingYear===p.horizonYears?-investment*p.decommissionFraction:0;
    const freeCashflow=spotCash+capacityCash-fixedOM-p.landJPYYear-insurance+replacement+residual+decommission;
    cumulative+=freeCashflow;
    rows.push({year,operatingYear,investment:0,spotCash,capacityCash,fixedOM:-fixedOM,land:-p.landJPYYear,insurance:-insurance,replacement,residual,decommission,freeCashflow,cumulative,sohStart:life.sohStart,sohEnd:life.sohEnd,efc:life.efc});
  }
  const cashflows=rows.map(r=>r.freeCashflow),discounted=npv(p.discountRate,cashflows),projectIRR=irr(cashflows),first=rows.find(r=>r.operatingYear===1);
  // Exact affine CAPEX break-even: scale the same complete initial budget and its
  // battery replacement component, as in the two-dimensional CAPEX sensitivity.
  const coefficient=-1+rows.slice(1).reduce((s,r)=>s-p.insuranceFraction/(1+p.discountRate)**r.year,0)+(p.residualFraction-p.decommissionFraction)/(1+p.discountRate)**rows.at(-1).year;
  const independentPV=discounted-coefficient*investment;
  const fixedReplacementBreakEvenCapex=coefficient!==0?-independentPV/coefficient:null;
  const replacementPV=rows.reduce((s,r)=>s-r.replacement/(1+p.discountRate)**r.year,0);
  const coupledCoefficient=coefficient-(investment>0?replacementPV/investment:0);
  const independentCapitalPV=independentPV+replacementPV;
  const breakEvenCapex=coupledCoefficient!==0?-independentCapitalPV/coupledCoefficient:null;
  const revenuePV=rows.reduce((s,r)=>s+(r.spotCash+r.capacityCash)/(1+p.discountRate)**r.year,0);
  const firstCash=first.spotCash+first.capacityCash;
  const lifetimeRevenueShapePV=firstCash>0?revenuePV/firstCash:0;
  const breakEvenAnnualOperatingContribution=lifetimeRevenueShapePV>0?(revenuePV-discounted)/lifetimeRevenueShapePV:null;
  const initialDebt=investment*p.debtFraction,annualPrincipal=initialDebt/p.debtYears;
  let debt=initialDebt,minDSCR=null;
  const financing=rows.map(r=>{
    if(r.year===0)return {year:0,draw:initialDebt,principal:0,interest:0,remainingDebt:initialDebt,equityCashflow:r.freeCashflow+initialDebt,dscr:null};
    let principal=r.year<=p.debtYears?Math.min(debt,annualPrincipal):0;
    if(r.year===rows.at(-1).year)principal=debt; // settle any outstanding loan at liquidation
    const interest=debt*p.interestRate,service=principal+interest;
    const cfads=r.spotCash+r.capacityCash+r.fixedOM+r.land+r.insurance+r.replacement;
    debt=Math.max(0,debt-principal);const dscr=service>0?cfads/service:null;
    if(dscr!==null)minDSCR=minDSCR===null?dscr:Math.min(minDSCR,dscr);
    return {year:r.year,draw:0,principal,interest,remainingDebt:debt,equityCashflow:r.freeCashflow-service,dscr};
  });
  return {identity:'B',initialInvestment:investment,annualOperatingContribution:firstCash,year1FreeCashflow:first.freeCashflow,lifetimeFreeCashflow:cashflows.slice(1).reduce((a,b)=>a+b,0),lifetimeProfit:cumulative,npv:discounted,projectIRR,discountRate:p.discountRate,payback:payback(cashflows),breakEvenCapex,fixedReplacementBreakEvenCapex,breakEvenAnnualOperatingContribution,rows,financing,equityIRR:p.debtFraction>0?irr(financing.map(r=>r.equityCashflow)):null,minDSCR,parameters:{...p},gridDelayYears,
    boundary:'税前、名义、项目口径；历史年化后重复的C情景，不是项目实际财务或预期回报率。'};
}

/** Annual physical derating of the SAME executed schedule, not a fresh revenue model. */
export function validateAgeing(p){
  if(!Number.isFinite(p.calendarFade)||p.calendarFade<0||p.calendarFade>.1||!Number.isFinite(p.efcTo80)||p.efcTo80<=0||!Number.isFinite(p.dodExponent)||p.dodExponent<0||p.dodExponent>3||!Number.isFinite(p.replacementThreshold)||p.replacementThreshold<=.3||p.replacementThreshold>1)throw new Error('Invalid lifetime assumptions');
  return p;
}
export function ageingIncrement(efc,weightedEFC,p){validateAgeing(p);if(efc<0||weightedEFC<0)throw new Error('Invalid throughput');return {calendar:p.calendarFade,cycle:.2*weightedEFC/p.efcTo80};}
export function lifetimePath(basis,p,horizonYears=20,{replace=true,gridScale=1}={}){
  validateAgeing(p);if(!Number.isInteger(horizonYears)||horizonYears<1||horizonYears>40||gridScale<0||gridScale>1)throw new Error('Invalid lifetime horizon');
  const energy=basis.energyMWh,window=basis.socMax-basis.socMin,headroom=basis.reserveMW*(5/60)*(1/Math.sqrt(.88)+Math.sqrt(.88));
  const usable0=energy*window-headroom,years=[];let soh=1,calendarAge=0,totalEFC=0,replacements=0;
  if(usable0<=0)throw new Error('Reserved energy exceeds the SOC window');
  for(let year=1;year<=horizonYears;year++){
    const replacement=year>1&&replace&&soh<=p.replacementThreshold;
    if(replacement){soh=1;calendarAge=0;replacements++;}
    const usableMWh=Math.max(0,energy*soh*window-headroom),scale=Math.max(0,Math.min(1,usableMWh/usable0))*gridScale;
    const annualEFC=basis.annual.batteryDischargeMWh*scale/energy; // ORIGINAL rated capacity denominator
    const originalWeighted=basis.annual.dodExposure.reduce((s,r)=>s+r.efc*(r.dod/.8)**p.dodExponent,0)*basis.annualizationFactor;
    const weighted=originalWeighted*scale*(scale/soh)**p.dodExponent;
    const fade=ageingIncrement(annualEFC,weighted,p),sohEnd=Math.max(.05,soh-fade.calendar-fade.cycle);
    calendarAge++;totalEFC+=annualEFC;
    const spotCash=basis.annual.spotCashBeforeWear*scale;
    // Same reserve MW, same delivery assumption. A grid loss is an explicit C haircut
    // to both spot and balancing availability; no claim about an actual control window.
    const capacityCash=basis.annual.capacityCash*gridScale;
    years.push({year,calendarAge,replacement,sohStart:soh,sohEnd,capacityMWh:energy*soh,usableMWh,trajectoryScale:scale,chargeMWh:basis.annual.chargeMWh*scale,dischargeMWh:basis.annual.dischargeMWh*scale,throughputMWh:basis.annual.throughputMWh*scale,efc:annualEFC,weightedEFC:weighted,cycleFade:fade.cycle,calendarFade:fade.calendar,spotCash,capacityCash,operatingCash:spotCash+capacityCash,gross:basis.annual.spotGross*scale+basis.annual.capacityGross*gridScale});
    soh=sohEnd;
  }
  return {identity:'B',years,replacements,totalEFC,finalSOH:soh,lifetimeGross:years.reduce((s,r)=>s+r.gross,0),lifetimeOperatingCash:years.reduce((s,r)=>s+r.operatingCash,0),assumptions:{...p},gridScale,
    boundary:'按首年调度的可行比例缩放后重复历史；PCS功率不随SOH缩放；不重优化后续年份、不含调频激活和温控电化学模型。EFC统一以原始8.14MWh计。'};
}
