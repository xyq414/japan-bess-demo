/** Fixed v2 schedules -> explicit operating contribution, never project profit. */
export function operatingContribution(basis,costs,capacity={reserve:0,price:3,hours:12,ratio:.65,fee:.06},unreserved=basis){
 const keys=['degradation','spotFee','flatMonthlyFee','flatShare','aggregationPercent','network','otherDaily'];
 if(keys.some(k=>!Number.isFinite(costs[k])||costs[k]<0)||costs.aggregationPercent>100||costs.flatShare>1||
    !['per_volume','flat','custom'].includes(costs.spotFeeMode)||
    (costs.activationDaily!==null&&(!Number.isFinite(costs.activationDaily)||costs.activationDaily<0)))throw new Error('成本必须非负且完整；聚合比例0–100%，分摊比例0–100%。');
 if(![basis.grossRevenue,basis.chargeMWh,basis.dischargeMWh,basis.days,basis.months].every(Number.isFinite)||basis.days<=0)throw new Error('Missing frozen cost basis');
 const isCombined=basis.kind==='frontier';
 if(isCombined&&(![capacity.reserve,capacity.price,capacity.hours,capacity.ratio,capacity.fee].every(Number.isFinite)||capacity.reserve<0||capacity.reserve>2||capacity.price<0||capacity.price>10||capacity.hours<0||capacity.hours>24||capacity.ratio<0||capacity.ratio>1||capacity.fee<0||capacity.reserve!==basis.reserveMW))throw new Error('预留档位须与v2调度一致；价格0–10，小时0–24，交付0–100%。');
 const aggregation=costs.aggregationPercent/100;
 const spotCosts=b=>({degradation:b.dischargeMWh*1000*costs.degradation,
  spotMarket:costs.spotFeeMode==='flat'?b.months*costs.flatMonthlyFee*costs.flatShare:(b.chargeMWh+b.dischargeMWh)*1000*costs.spotFee,
  spotAggregation:Math.max(0,b.grossRevenue)*aggregation,network:b.chargeMWh*1000*costs.network,other:b.days*costs.otherDaily});
 const spot=spotCosts(basis),unreservedCosts=spotCosts(unreserved),sum=o=>Object.values(o).reduce((a,v)=>a+v,0);
 const units=isCombined?capacity.reserve*1000*capacity.hours*2*basis.days*capacity.ratio:0;
 const capacityGross=units*(isCombined?capacity.price:0),capacityFee=units*(isCombined?capacity.fee:0),capacityAggregation=capacityGross*aggregation;
 const activationAllowance=units>0&&costs.activationDaily!==null?basis.days*costs.activationDaily:0;
 const capacityCost=capacityFee+capacityAggregation+activationAllowance,spotCost=sum(spot);
 const gross=basis.grossRevenue+capacityGross,cost=spotCost+capacityCost,net=gross-cost,spotNet=basis.grossRevenue-spotCost;
 const unreservedNet=unreserved.grossRevenue-sum(unreservedCosts);
 const waterfall=[{key:'gross',label:isCombined?'资源竞争后的毛机会':'现货套利毛收益',value:gross,kind:'total'},
  {key:'degradation',label:'衰减代理 C',value:-spot.degradation,kind:'cost'},
  {key:'market',label:'市场手续费 A→C应用',value:-(spot.spotMarket+capacityFee),kind:'cost'},
  {key:'aggregation',label:'聚合情景 C',value:-(spot.spotAggregation+capacityAggregation),kind:'cost'},
  {key:'network',label:'网络情景 C',value:-spot.network,kind:'cost'},
  {key:'other',label:'其他情景 C',value:-spot.other,kind:'cost'}];
 if(costs.activationDaily!==null&&isCombined)waterfall.push({key:'activation',label:'激活/恢复额度 C',value:-activationAllowance,kind:'cost'});
 waterfall.push({key:'net',label:'经营贡献情景 B',value:net,kind:'total'});
 const dischargeKWh=basis.dischargeMWh*1000,aggregationBasis=Math.max(0,basis.grossRevenue)+capacityGross;
 const breakEvenDegradation=dischargeKWh>1e-9?(gross-(cost-spot.degradation))/dischargeKWh:null;
 const breakEvenAggregation=aggregationBasis>1e-9?(gross-(cost-spot.spotAggregation-capacityAggregation))/aggregationBasis*100:null;
 const marginalCapacity=units*(1-aggregation);
 const breakEvenCapacityPrice=isCombined&&marginalCapacity>1e-9?(unreservedNet-spotNet+capacityFee+activationAllowance)/marginalCapacity:null;
 return {gross,cost,net,spotGross:basis.grossRevenue,spotNet,spotCost,capacityGross,capacityFee,capacityAggregation,
  capacityNet:capacityGross-capacityCost,capacityCost,activationAllowance,spotCosts:spot,units,waterfall,
  margin:gross>1?net/gross:null,annualizationFactor:365/basis.days,perMWYear:net/basis.powerMW*365/basis.days,
  perMWhYear:net/basis.energyMWh*365/basis.days,breakEvenDegradation,breakEvenAggregation,breakEvenCapacityPrice,
  lostSpotGross:unreserved.grossRevenue-basis.grossRevenue,unreservedNet,
  opportunityCostAdjusted:isCombined?net-unreservedNet:null,
  exclusions:['真实激活电量与SOC恢复轨迹','偏差结算/罚金','CAPEX与融资','固定O&M、土地、保险','项目税务'],
  activationStatus:costs.activationDaily===null?'Not Modelled / 未建模':'C 手动费用额度；实际激活轨迹仍未建模'};
}
