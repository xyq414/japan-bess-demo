import {solveDay,DEFAULTS} from './model.js';
/** Optimization receives the prediction only; settlement receives actual prices. */
export function planAndSettle(actual,forecast,parameters=DEFAULTS){
  if(actual.length!==48||actual.some(v=>!Number.isFinite(v)))throw new Error('Expected48 actual slots');
  const planned=solveDay(forecast,parameters);let cost=0,receipt=0,cumulative=0;
  const rows=planned.rows.map((r,t)=>{
    const charge=r.chargeMWh*actual[t]*1000,discharge=r.dischargeMWh*actual[t]*1000;
    cost+=charge;receipt+=discharge;cumulative+=discharge-charge;
    return {...r,price:actual[t],forecast:forecast[t],cashflow:discharge-charge,cumulativeRevenue:cumulative};
  });
  return {...planned,rows,grossRevenue:receipt-cost,netRevenue:receipt-cost,chargingCost:cost,dischargeRevenue:receipt,
    forecastMAE:actual.reduce((a,v,i)=>a+Math.abs(v-forecast[i]),0)/48,plannedObjective:planned.grossRevenue};
}
export function capacityScenario({spot,baseline,reserve,days,price=3,hours=12,ratio=.65,fee=.06}){
  if(![spot,baseline,reserve,days,price,hours,ratio,fee].every(Number.isFinite)||reserve<0||reserve>2||days<=0||price<0||price>10||hours<0||hours>24||ratio<0||ratio>1||fee<0)throw new Error('价格须0–10、小时0–24、交付比例0–100%、手续费非负');
  const units=reserve*1000*hours*2*days*ratio,lost=baseline-spot;
  return {reserveMW:reserve,spotPowerMW:2-reserve,spotGross:spot,lostSpotValue:lost,capacityGross:units*price,
    capacityFee:units*fee,capacityAfterFee:units*(price-fee),combinedScenario:spot+units*(price-fee),breakEvenPrice:units>0?fee+lost/units:null};
}
export function safeCapture(realized,upper){return upper>1?realized/upper:null;}
