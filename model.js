/**
 * Deterministic finite-grid dynamic programming battery dispatch.
 * State: stored energy grid s, cumulative discharged stored-energy units d.
 * Each 30-minute edge is idle OR charge OR discharge. No simultaneous flows.
 * Monotone sliding maxima give O(T * S * D) time, no third-party solver.
 * Objective: discharge receipts - charging expense - discharge variable cost.
 * Daily terminal energy equals exact initial energy. Prices are historical known.
 */
export const DEFAULTS = Object.freeze({power:2,energy:8.14,efficiency:0.88,socMin:0.10,socMax:0.90,
  initialSoc:0.10,maxCycles:1,degradation:0,gridSteps:80});

export function validateParameters(input) {
  const p={...DEFAULTS,...input};
  for(const key of Object.keys(DEFAULTS)) if(!Number.isFinite(p[key])) throw new Error(`${key} 必须为有限数值`);
  if(p.power<=0||p.power>20||p.energy<=0||p.energy>100) throw new Error('功率须为 0–20 MW，容量须为 0–100 MWh（均不含 0）');
  if(p.efficiency<0.5||p.efficiency>1) throw new Error('往返效率须在 50%–100% 之间');
  if(p.socMin<0||p.socMax>1||p.socMin>=p.socMax) throw new Error('SOC 下限须低于上限，范围为 0%–100%');
  if(p.initialSoc<p.socMin||p.initialSoc>p.socMax) throw new Error('初始 SOC 须位于上下限之间');
  if(p.maxCycles<0||p.maxCycles>3||p.degradation<0||p.degradation>30) throw new Error('每日循环上限须为 0–3，变动成本须为 0–30 JPY/kWh');
  if(!Number.isInteger(p.gridSteps)||p.gridSteps<8||p.gridSteps>240) throw new Error('无效 SOC 网格精度');
  return p;
}

export function solveDay(prices,input={}) {
  const p=validateParameters(input);
  if(!Array.isArray(prices)||prices.length!==48||prices.some(x=>!Number.isFinite(x))) throw new Error('每日须有 48 个有效半小时价格');
  const eta=Math.sqrt(p.efficiency), q=p.energy*(p.socMax-p.socMin)/p.gridSteps;
  const initialEnergy=p.energy*p.initialSoc, minEnergy=p.energy*p.socMin;
  // Translate the uniform lattice to contain EXACT initial energy; tighten only
  // the boundaries by less than one cell. This never creates free initial energy.
  let start=Math.floor((initialEnergy-minEnergy)/q+1e-9);
  const base=initialEnergy-start*q;
  const n=Math.floor((p.energy*p.socMax-base)/q+1e-9), S=n+1;
  const chargeLimit=Math.min(n,Math.floor(p.power*0.5*eta/q+1e-9));
  const dischargeLimit=Math.min(n,Math.floor(p.power*0.5/eta/q+1e-9));
  const maxD=Math.min(Math.floor(p.energy*p.maxCycles/q+1e-9),48*dischargeLimit), D=maxD+1;
  const size=S*D, NEG=-Infinity;
  let prev=new Float64Array(size); prev.fill(NEG); prev[start*D]=0;
  let next=new Float64Array(size);
  const parents=new Int32Array(48*size); parents.fill(-1);
  const queue=new Int32Array(S), queueValue=new Float64Array(S);
  for(let t=0;t<48;t++) {
    next.fill(NEG);
    const parentOffset=t*size, c=q/eta*prices[t]*1000;
    const r=q*eta*(prices[t]-p.degradation)*1000;
    // Charge/idle transitions along fixed cumulative discharge d.
    for(let d=0;d<D;d++) {
      let head=0,tail=0;
      for(let s=0;s<S;s++) {
        while(head<tail && queue[head]<s-chargeLimit) head++;
        const value=prev[s*D+d]+s*c;
        if(value!==NEG) {
          while(head<tail && queueValue[tail-1]<value-1e-9) tail--;
          queue[tail]=s; queueValue[tail++]=value;
        }
        if(head<tail) {
          const at=s*D+d;
          next[at]=queueValue[head]-s*c;
          parents[parentOffset+at]=queue[head]*D+d;
        }
      }
    }
    // Discharge/idle transitions along diagonal s+d=j. Descending s.
    for(let j=0;j<=n+maxD;j++) {
      let head=0,tail=0;
      const lower=Math.max(0,j-maxD),upper=Math.min(n,j);
      for(let s=upper;s>=lower;s--) {
        while(head<tail && queue[head]>s+dischargeLimit) head++;
        const d=j-s, value=prev[s*D+d]+s*r;
        if(value!==NEG) {
          while(head<tail && queueValue[tail-1]<value-1e-9) tail--;
          queue[tail]=s; queueValue[tail++]=value;
        }
        if(head<tail) {
          const at=s*D+d, candidate=queueValue[head]-s*r;
          if(candidate>next[at]+1e-7) {
            const oldS=queue[head];
            next[at]=candidate;
            parents[parentOffset+at]=oldS*D+(j-oldS);
          }
        }
      }
    }
    [prev,next]=[next,prev];
  }
  let final=start*D;
  for(let d=1;d<D;d++) if(prev[start*D+d]>prev[final]+1e-7) final=start*D+d;
  const objective=prev[final], rows=new Array(48);
  let chargingCost=0,dischargeRevenue=0,variableCost=0,chargeMWh=0,dischargeMWh=0,batteryDischargeMWh=0;
  for(let t=47;t>=0;t--) {
    const old=parents[t*size+final];
    if(old<0) throw new Error('无法恢复可行调度');
    const before=Math.floor(old/D),after=Math.floor(final/D),delta=(after-before)*q;
    const charge=delta>0?delta/eta:0, discharge=delta<0?-delta*eta:0;
    rows[t]={slot:t+1,price:prices[t],chargeMW:charge*2,dischargeMW:discharge*2,
      socBefore:(base+before*q)/p.energy,socAfter:(base+after*q)/p.energy,
      chargeMWh:charge,dischargeMWh:discharge,cashflow:(discharge-charge)*prices[t]*1000,
      variableCost:discharge*p.degradation*1000};
    chargingCost+=charge*prices[t]*1000; dischargeRevenue+=discharge*prices[t]*1000;
    variableCost+=discharge*p.degradation*1000; chargeMWh+=charge; dischargeMWh+=discharge;
    batteryDischargeMWh+=Math.max(0,-delta); final=old;
  }
  const grossRevenue=dischargeRevenue-chargingCost,netRevenue=grossRevenue-variableCost;
  if(Math.abs(netRevenue-objective)>1e-5) throw new Error('调度现金流与优化目标不一致');
  return {rows,grossRevenue,netRevenue,chargingCost,dischargeRevenue,variableCost,chargeMWh,dischargeMWh,
    throughputMWh:chargeMWh+dischargeMWh,batteryDischargeMWh,equivalentCycles:batteryDischargeMWh/p.energy,
    capturedSpread:dischargeMWh>1e-9?(dischargeRevenue/dischargeMWh-chargingCost/chargeMWh)/1000:0,
    effectiveSocMin:base/p.energy,effectiveSocMax:(base+n*q)/p.energy,energyQuantumMWh:q,
    effectiveMaxChargeMW:chargeLimit*q/eta*2,effectiveMaxDischargeMW:dischargeLimit*q*eta*2,
    gridSteps:p.gridSteps,objective};
}

export function runBacktest(days,region,input={},onProgress) {
  const parameters=validateParameters(input);
  if(!days.length) throw new Error('所选区间没有有效数据');
  const totals={grossRevenue:0,netRevenue:0,chargingCost:0,dischargeRevenue:0,variableCost:0,
    chargeMWh:0,dischargeMWh:0,throughputMWh:0,equivalentCycles:0};
  const daily=[];let first;
  for(let i=0;i<days.length;i++) {
    const result=solveDay(days[i][region],parameters); first??=result;
    for(const k of Object.keys(totals)) totals[k]+=result[k];
    daily.push({date:days[i].date,...Object.fromEntries(Object.keys(totals).map(k=>[k,result[k]])),capturedSpread:result.capturedSpread});
    if(onProgress&&i%20===0) onProgress(i/days.length);
  }
  return {...totals,region,parameters,daily,analyzedDays:days.length,start:days[0].date,end:days.at(-1).date,
    revenuePerMW:totals.netRevenue/parameters.power,revenuePerMWh:totals.netRevenue/parameters.energy,
    averageCycles:totals.equivalentCycles/days.length,
    capturedSpread:totals.dischargeMWh>1e-9?(totals.dischargeRevenue/totals.dischargeMWh-totals.chargingCost/totals.chargeMWh)/1000:0,
    energyQuantumMWh:first.energyQuantumMWh,effectiveSocMin:first.effectiveSocMin,effectiveSocMax:first.effectiveSocMax,
    effectiveMaxChargeMW:first.effectiveMaxChargeMW,effectiveMaxDischargeMW:first.effectiveMaxDischargeMW};
}

export function primaryScenario({capacityMW,priceJPY,availability,hours,days,feeJPY=0.06}) {
  const values=[capacityMW,priceJPY,availability,hours,days,feeJPY];
  if(values.some(x=>!Number.isFinite(x))||capacityMW<0||priceJPY<0||availability<0||availability>1||hours<0||hours>24||days<1||feeJPY<0)
    throw new Error('无效调频情景参数');
  const contractedUnits=capacityMW*1000*(hours*2)*days*availability;
  return {grossRevenue:contractedUnits*priceJPY,fee:contractedUnits*feeJPY,
    afterFee:contractedUnits*(priceJPY-feeJPY),contractedUnits};
}
