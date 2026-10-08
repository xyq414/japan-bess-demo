/** Explicit C scenario calculators; prices already include their settlement unit. */
export function bidEV({reserveMW=1,blocks=24,bidPrice=3,q=.7,opportunity=20000,delivery=4000,wear=2000,fee=.06}={}){
 if(![reserveMW,blocks,bidPrice,q,opportunity,delivery,wear,fee].every(Number.isFinite)||reserveMW<0||blocks<0||bidPrice<0||q<0||q>1)throw new Error('参数超出有效范围');
 const capacity=reserveMW*1000*blocks*bidPrice,tradeFee=reserveMW*1000*blocks*fee,conditional=capacity-tradeFee-delivery-wear;
 return {capacity,tradeFee,conditional,expected:q*conditional-opportunity,breakEvenQ:conditional>0?opportunity/conditional:null,breakEvenPrice:q>0&&reserveMW*blocks>0?(opportunity/q+tradeFee+delivery+wear)/(reserveMW*1000*blocks):null};
}
export function availabilityCash({baseCash,capacityCash,availability}){
 if(!Number.isFinite(availability)||availability<0||availability>1)throw new Error('可用率应为0–100%');
 const lost=Math.max(0,baseCash)*(1-availability),penalty=Math.max(0,capacityCash)*(1-availability)*.65*1.5;
 return {lost,penalty,retained:baseCash-lost-penalty};
}
export function scenarioFinance({annualCash,annualEFC,years=20,capex=563520000,fixedOM=10000000,rate=.08}){
 let soh=1;const flows=[-capex],replacementYears=[],lifePath=[];
 for(let y=1;y<=years;y++){let replacement=0;if(soh<.8-1e-9){replacement=162800000;soh=1;replacementYears.push(y);}flows.push(annualCash*soh-fixedOM-replacement);lifePath.push({year:y,openingSOH:soh,operatingCash:annualCash*soh,replacement,netCash:flows.at(-1)});soh-=.01+annualEFC/6000*.2;}
 const npv=flows.reduce((sum,v,t)=>sum+v/(1+rate)**t,0);
 return {npv,flows,lifePath,replacementYears,shadowWearInDCF:false};
}
