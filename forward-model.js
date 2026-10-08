/** Transparent C price stress; actual and forecast vectors are independent. */
export function stressPrices(prices,scenario,allowNonpositiveForecast=false){
 if(prices.length!==48||prices.some(v=>!Number.isFinite(v)||(!allowNonpositiveForecast&&v<=0)))throw new Error('实际压力输入须为 48 个正的半小时价格；预测可保留非正估计');
 const {compression,midday_multiplier:midday,evening_multiplier:evening}=scenario;
 if(!Number.isFinite(compression)||compression<0||compression>1||!Number.isFinite(midday)||midday<=0||!Number.isFinite(evening)||evening<=0)throw new Error('无效压力参数');
 const ordered=[...prices].sort((a,b)=>a-b),median=(ordered[23]+ordered[24])/2;
 return prices.map((p,t)=>{
  const q=median+(1-compression)*(p-median),hour=t/2;
  return q*(hour>=10&&hour<16?midday:hour>=17&&hour<21?evening:1);
 });
}
export function halfContributionPrice(stressed,baseReference,capacity,costs){
 // All quantities refer to a fixed, resource-feasible LP schedule.
 const units=stressed.units,retained=1-costs.aggregationPercent/100;
 if(units<=0||retained<=0)return null;
 const zeroPriceNet=stressed.net-units*capacity.price*retained;
 return (baseReference.net*.5-zeroPriceNet)/(units*retained);
}
