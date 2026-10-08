import {runBacktest} from './model.js';
self.onmessage=({data})=>{
  try {const result=data.variants?data.variants.map((v,i)=>{
      const r=runBacktest(data.days,data.region,{...data.parameters,...v.change},p=>self.postMessage({id:data.id,progress:(i+p)/data.variants.length}));
      return {label:v.label,change:v.change,netRevenue:r.netRevenue,equivalentCycles:r.equivalentCycles};
    }):runBacktest(data.days,data.region,data.parameters,p=>self.postMessage({id:data.id,progress:p}));
    self.postMessage({id:data.id,result});
  } catch(e) {self.postMessage({id:data.id,error:e.message});}
};
