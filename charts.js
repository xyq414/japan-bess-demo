import {esc} from './views.js';
const blue='#245edb', gray='#91a1b2', ink='#65778b';
const fmt=x=>Number(x.toFixed(2)).toLocaleString('zh-CN');
/** Responsive SVG figures with honest zero-inclusive axes, units and accessible titles. */
export function lineChart(el,{series,labels,title,unit,height=220,min,max,ticks=5,xCount=6}) {
  if(!el||!series.length||!labels.length)return;
  const width=Math.max(280,el.clientWidth||600), left=49,right=17,top=30,bottom=34;
  const w=width-left-right,h=height-top-bottom,values=series.flatMap(s=>s.values);
  let lo=min??Math.min(0,...values),hi=max??Math.max(0,...values);
  if(hi===lo)hi=lo+1;
  const x=i=>left+i*w/Math.max(1,labels.length-1),y=v=>top+(hi-v)/(hi-lo)*h;
  let out=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(unit)}；${esc(labels[0])} 至 ${esc(labels.at(-1))}。详细数值见页面表格或下载数据。</desc><text x="0" y="15" fill="${ink}" font-size="12">${esc(unit)}</text>`;
  for(let i=0;i<=ticks;i++){const v=lo+(hi-lo)*i/ticks,yy=y(v);out+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#e3eaf2"/><text x="${left-8}" y="${yy+4}" text-anchor="end" fill="${ink}" font-size="12">${fmt(v)}</text>`;}
  for(const i of [...new Set(Array.from({length:Math.min(xCount,labels.length)},(_,j)=>Math.round(j*(labels.length-1)/Math.max(1,Math.min(xCount,labels.length)-1))))])out+=`<text x="${x(i)}" y="${height-10}" text-anchor="${i===0?'start':i===labels.length-1?'end':'middle'}" fill="${ink}" font-size="12">${esc(labels[i])}</text>`;
  series.forEach((s,j)=>{out+=`<path d="${s.values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="${s.color??(j?gray:blue)}" stroke-width="${j?1.8:2.4}" ${s.dashed?'stroke-dasharray="5 4"':''}/>`;if(labels.length<=24)s.values.forEach((v,i)=>{out+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color??(j?gray:blue)}"><title>${esc(labels[i])} · ${esc(s.name)}: ${fmt(v)} ${esc(unit)}</title></circle>`;});});
  el.innerHTML=out+'</svg>';
}
export function dispatchChart(el,rows,power){
  if(!el)return;
  const width=Math.max(280,el.clientWidth||600),height=158,l=49,r=17,t=13,b=31,w=width-l-r,h=height-t-b;
  const x=i=>l+(i+.5)*w/48,y=v=>t+(power-v)/(2*power)*h,zero=y(0),bw=w/48*.75;
  let out=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="半小时充放电功率，充电为负、放电为正，单位MW"><title>充放电功率 / MW</title>`;
  for(const v of [-power,0,power])out+=`<line x1="${l}" x2="${width-r}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?'#b7c5d5':'#e3eaf2'}"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end" fill="${ink}" font-size="12">${fmt(v)}</text>`;
  rows.forEach((row,i)=>{const v=row.dischargeMW-row.chargeMW;out+=`<rect x="${x(i)-bw/2}" y="${Math.min(y(v),zero)}" width="${bw}" height="${Math.max(0,Math.abs(y(v)-zero))}" fill="${v>=0?blue:'#fff'}" stroke="${blue}" stroke-width=".8"><title>时段 ${i+1}: 充电 ${fmt(row.chargeMW)} / 放电 ${fmt(row.dischargeMW)} MW</title></rect>`;});
  [0,12,24,36,47].forEach(i=>out+=`<text x="${x(i)}" y="${height-7}" text-anchor="${i===0?'start':i===47?'end':'middle'}" fill="${ink}" font-size="12">${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}</text>`);
  el.innerHTML=out+'</svg>';
}
