import {esc} from './views.js';

let topicDataPromise;
export const getTopicData = () => topicDataPromise ??= fetch('./data/topic-navigation-v2-8.json?v=20261008-1').then(response => {
  if (!response.ok) throw new Error('研究目录未能载入');
  return response.json();
});

export function renderTopicCards(topics = []) {
  return `<div class="topic-nav-grid">${topics.map(topic => `<a class="topic-nav-card" href="${esc(topic.route)}" data-topic-link="${esc(topic.key)}"><h3>${esc(topic.title)} <span aria-hidden="true">→</span></h3><p>${esc(topic.question || topic.lead)}</p></a>`).join('')}</div>`;
}

export async function mountResearchHome({el}) {
  const data = await getTopicData();
  const directions = [
    ['market-operations', 'A', '#market-operations'],
    ['business', 'B', '#business']
  ];
  el.innerHTML = `<div class="research-wrap topic-nav-home" data-topic-home><header class="research-head"><div><div class="eyebrow">JAPAN BESS RESEARCH</div><h1>${esc(data.home.title)}</h1><p>${esc(data.home.lead)}</p></div></header><div class="topic-nav-directions">${directions.map(([key, code, route]) => {
    const major = data.majors[key];
    return `<a class="topic-nav-direction" href="${route}" data-major-card="${code === 'A' ? 'market_operations' : 'project_business'}"><div class="eyebrow">${code}</div><h2>${esc(major.title.replace(/^[AB]｜/, ''))}</h2><p>${esc(major.lead)}</p><span class="topic-nav-read">进入研究 →</span></a>`;
  }).join('')}</div><section class="topic-nav-topics" aria-labelledby="topic-nav-heading"><h2 id="topic-nav-heading">按问题选择研究主题</h2>${renderTopicCards(data.topics)}</section></div>`;
}

function resolvedModule(route, manifest, data, websiteCopy) {
  const source = manifest.modules.find(module => module.route === route);
  if (!source) throw new Error(`研究链接不存在：${route}`);
  const mapped = data.modules?.find(module => module.route === route);
  const copy = websiteCopy?.modules?.find(module => module.route === route) || websiteCopy?.routes?.[route];
  return {
    ...source,
    title: mapped?.title || copy?.title || source.title,
    question: mapped?.question || copy?.card || copy?.text || source.research_question || source.question
  };
}

export async function mountTopicDirectory({el, key, manifest, websiteCopy}) {
  const data = await getTopicData();
  const topic = data.topics.find(item => item.key === key);
  if (!topic) throw new Error('研究目录不存在');
  const modules = topic.primary_routes.map(route => resolvedModule(route, manifest, data, websiteCopy));
  const major = data.modules?.find(module => module.route === topic.primary_routes[0]);
  const isBusiness = major?.major_route === '#business' || key === 'business';
  const majorRoute = isBusiness ? '#business' : '#market-operations';
  const majorLabel = isBusiness ? 'B｜项目开发与投融资研究' : 'A｜电力市场与交易运营研究';
  const crossLinks = (topic.cross_links || []).map(link => ({...link, module: resolvedModule(link.route, manifest, data, websiteCopy)}));
  el.innerHTML = `<div class="research-wrap topic-nav-directory" data-topic-directory="${esc(key)}"><header class="research-head"><div><div class="eyebrow">${esc(majorLabel)}</div><h1>${esc(topic.title)}</h1><p class="topic-nav-question">${esc(topic.question)}</p><p class="topic-nav-lead">${esc(topic.lead)}</p></div></header><nav class="topic-nav-return" aria-label="研究目录导航"><a href="#modules">← 研究首页</a><a href="${majorRoute}">${esc(majorLabel)} →</a></nav><section aria-labelledby="topic-nav-module-heading"><h2 id="topic-nav-module-heading">这部分研究</h2><div class="research-card-grid topic-nav-module-grid">${modules.map(module => `<a class="research-module-card topic-nav-module-card" href="${esc(module.route)}" data-module-id="${esc(module.module_id)}"><h3>${esc(module.title)}</h3><p>${esc(module.question)}</p><span class="topic-nav-read">阅读研究 →</span></a>`).join('')}</div></section>${crossLinks.length ? `<section class="topic-nav-cross" aria-labelledby="topic-nav-cross-heading"><h2 id="topic-nav-cross-heading">继续理解相关问题</h2><ul>${crossLinks.map(link => `<li><a href="${esc(link.route)}">${esc(link.module.title)} <span aria-hidden="true">→</span></a><p>${esc(link.reason)}</p></li>`).join('')}</ul></section>` : ''}<nav class="topic-nav-return topic-nav-bottom" aria-label="返回研究导航"><a href="#modules">← 研究首页</a><a href="${majorRoute}">${esc(majorLabel)} →</a></nav></div>`;
}
