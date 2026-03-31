/**
 * api.js — Kimi API 调用 + 业务逻辑
 * 移植自 Python generator.py，使用 CapacitorHttp 绕过 CORS
 */

const BASE_URL = 'https://api.moonshot.cn/v1';
const MODEL = 'moonshot-v1-8k';
const DURATION_WORDS = { 1: '200-300', 3: '600-900', 5: '1000-1500' };

// API Key：构建时内置，开源代码中为占位符
// 如需自行部署，请替换为你的 Moonshot API Key
const _BUILT_IN_KEY = 'YOUR_MOONSHOT_API_KEY';
let _apiKey = _BUILT_IN_KEY;

async function getApiKey() {
  return _apiKey;
}

async function saveApiKey(key) {
  _apiKey = key;
}

// ── LLM 调用 ──

async function callLLM(messages, temperature = 0.7) {
  const apiKey = await getApiKey();
  const body = JSON.stringify({ model: MODEL, messages, temperature });
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST', headers, body
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || '请求失败');

  return data.choices[0].message.content.trim();
}

// ── System Prompt 构建 ──

async function buildSystemPrompt() {
  const cfg = await DB.getConfig();
  const industry = cfg.industry_name || '通用行业';
  const company = cfg.company_name || '某公司';
  const desc = cfg.company_desc || '';
  const guide = cfg.writing_guide || '';

  // 偏好
  const prefs = await DB.getPreferences();
  let prefText = '';
  if (prefs.length) {
    const lines = prefs.map(p => `- ${p.rule}`).join('\n');
    prefText = `\n\n【用户风格偏好（从历史反馈中学习到的，必须严格遵守）】\n${lines}`;
  }

  // 参考文案分析
  const refs = await DB.getReferences();
  let refText = '';
  const analyses = refs.filter(r => r.analysis).map((r, i) => `参考文案${i + 1}的特点：\n${r.analysis}`);
  if (analyses.length) {
    refText = `\n\n【参考文案风格分析（生成时必须模仿这些特点）】\n${analyses.join('\n')}`;
  }

  // 行文逻辑
  let guideText = '';
  if (guide) {
    guideText = `\n\n【行文逻辑（严格按照此框架生成文案）】\n${guide}`;
  }

  // 去重
  const recent = await DB.getRecentTopics(7);
  let dedupText = '';
  if (recent.length) {
    dedupText = `\n\n【近7天已写过的主题，避免重复】\n${recent.slice(0, 20).join(', ')}`;
  }

  const baseFormat = guide ? '' : `\n【默认格式要求】\n根据用户选择的输出模式（大纲或逐字稿）来输出。`;

  return `你是一位资深短视频内容策划，专注于${industry}领域。

【你服务的品牌/机构】
名称：${company}
简介：${desc}
${baseFormat}${guideText}${prefText}${refText}${dedupText}`;
}

// ── 分析参考文案 ──

async function analyzeReference(content) {
  return callLLM([
    { role: 'system', content: `你是一个文案风格分析专家。分析给定的文案，从以下维度总结其特点，每个维度一句话概括：

1. 结构：文章的组织方式（总分总、递进、列举等）
2. 语气：说话的口吻和态度（如老师聊天式、严肃专业、轻松幽默等）
3. 开头方式：如何吸引注意力
4. 用词风格：是书面还是口语，是否用比喻、数据、案例等
5. 节奏：句子长短、段落节奏
6. 结尾方式：如何收尾

直接输出分析结果，不要有多余的开场白。` },
    { role: 'user', content: `分析这篇文案：\n\n${content}` }
  ], 0.3);
}

// ── 生成单条内容 ──

async function generateSingle(topic, duration = 1, outputMode = 'outline') {
  const systemPrompt = await buildSystemPrompt();
  const wordRange = DURATION_WORDS[duration] || '200-300';

  let modeInstruction;
  if (outputMode === 'outline') {
    modeInstruction = `输出一份${duration}分钟口播大纲，极简，不要逐字稿。
- 开头钩子（一句话方向）
- 3-5个核心要点（每点不超过10个字）
- 结尾收口方式（一句话）
总共不超过10行。`;
  } else if (outputMode === 'questions') {
    const qCount = { 1: 3, 3: 6, 5: 9 }[duration] || 3;
    const simpleCount = Math.ceil(qCount * 0.67);
    const deepCount = qCount - simpleCount;
    modeInstruction = `围绕这个主题，生成${qCount}个主播自用的口播引导问题。每个问题要简短有力，一句话就够。

【受众画像】
大学生、职场遇到瓶颈的人、想入行AI的人。问题要让他们听得懂、觉得有用，同时感受到主播的专业能力。

【结构要求】
- ${simpleCount}个简单问题 + ${deepCount}个有深度的问题
- 每个问题前标注类型标签，从以下选一个：【故事】【案例】【方法】【过程】【对比】【深度】
- 每个问题一行，格式：【类型】问题内容
- 问题要短，不超过25个字

【类型说明】
- 【故事】引导主播讲亲身经历，如"你见过最离谱的求职翻车是什么？"
- 【案例】引导主播拆解具体案例，如"你用AI做过最漂亮的项目是什么？"
- 【方法】引导主播教一个马上能用的方法，如"只推荐一个AI工具入门，你选哪个？"
- 【过程】引导主播展示做事过程，如"从零学AI写方案，踩了几个坑？"
- 【对比】引导主播做before/after对比，如"用AI前后，工作节奏有啥变化？"
- 【深度】考验专业判断力，秀真本事，如"AI替代80%岗位，谁反而赚更多？"

【好问题的标准】
- 问完后主播脑子里马上有画面、有话想说
- 具体到场景，不要"你怎么看AI"这种太空的问题
- 简单问题暖场建立信任，难题展示深度和引发讨论`;
  } else {
    modeInstruction = `写一条完整的口播逐字稿，主播可以直接对着念。
字数要求：${wordRange}字（约${duration}分钟口播时长）`;
  }

  const content = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `主题：${topic}\n\n${modeInstruction}` }
  ], 0.85);

  const id = await DB.saveContent(topic, content, 'oral');
  return { id, topic, content, content_type: 'oral' };
}

// ── 自动选题 ──

async function autoPickTopics(count = 5) {
  const cfg = await DB.getConfig();
  const industry = cfg.industry_name || '通用行业';
  const company = cfg.company_name || '某公司';
  const desc = cfg.company_desc || '';

  const recent = await DB.getRecentTopics(7);
  const recentText = recent.length ? `\n已写过的主题（避免重复）：${recent.slice(0, 20).join(', ')}` : '';

  const result = await callLLM([
    { role: 'system', content: '你是短视频选题策划专家。根据行业和品牌信息，推荐短视频选题。' },
    { role: 'user', content: `行业：${industry}
品牌：${company}
简介：${desc}
${recentText}

请推荐${count}个适合今天发布的短视频选题。
每个选题一行，直接输出选题名称，不要序号和解释。` }
  ], 0.9);

  return result.split('\n').map(l => l.trim()).filter(l => l).slice(0, count);
}

// ── 改进内容 ──

async function improveContent(contentId, instruction) {
  const original = await DB.getContentById(contentId);
  if (!original) throw new Error('文案不存在');

  // 调用1：改进文案
  const systemPrompt = await buildSystemPrompt();
  const improved = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `原文案：
${original.content}

用户的修改要求：${instruction}

请根据用户的要求修改文案。直接输出修改后的完整文案，不要解释。` }
  ], 0.7);

  await DB.updateContent(contentId, improved);

  // 调用2：提取偏好
  let learnedRules = [];
  try {
    const raw = await callLLM([
      { role: 'system', content: `你是一个用户偏好分析器。根据用户对文案提出的修改要求，提取出可以复用的风格偏好规则。

输出JSON数组，每条规则是一个简短的偏好描述。如果这次修改不包含可复用的偏好，输出空数组 []。

示例输出：["开头用反问句", "不要使用感叹号", "语气更口语化"]

只输出JSON数组，不要其他内容。` },
      { role: 'user', content: `用户的修改要求：${instruction}\n\n原文案片段：${original.content.slice(0, 200)}` }
    ], 0.3);

    let jsonStr = raw;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.split('```')[1];
      if (jsonStr.startsWith('json')) jsonStr = jsonStr.slice(4);
    }
    const rules = JSON.parse(jsonStr);
    if (Array.isArray(rules)) {
      const existing = new Set((await DB.getPreferences()).map(p => p.rule));
      for (const rule of rules) {
        if (typeof rule === 'string' && rule.trim() && !existing.has(rule.trim())) {
          await DB.addPreference(rule.trim(), instruction);
          learnedRules.push(rule.trim());
        }
      }
    }
  } catch (e) { /* ignore parse errors */ }

  return { id: contentId, content: improved, learned_rules: learnedRules };
}

// ── 改写内容 ──

async function rewriteContent(text, duration = 1, outputMode = 'outline') {
  const systemPrompt = await buildSystemPrompt();
  const wordRange = DURATION_WORDS[duration] || '200-300';

  let modeNote;
  if (outputMode === 'outline') {
    modeNote = `改写后输出${duration}分钟口播大纲，极简：开头钩子一句话 + 3-5个要点（每点不超10字）+ 结尾收口一句话，总共不超过10行。`;
  } else if (outputMode === 'questions') {
    const qCount = { 1: 3, 3: 6, 5: 9 }[duration] || 3;
    const simpleCount = Math.ceil(qCount * 0.67);
    const deepCount = qCount - simpleCount;
    modeNote = `根据原文核心观点，生成${qCount}个主播自用引导问题（每个不超25字）。受众是大学生、职场困惑者、想入行AI的人。${simpleCount}个简单问题暖场+${deepCount}个有深度的问题秀实力。每个问题前标注【故事】【案例】【方法】【过程】【对比】【深度】之一。问题要具体到场景，让主播一看就有画面有话想说。`;
  } else {
    modeNote = `改写后输出完整逐字稿，字数控制在${wordRange}字（约${duration}分钟口播时长）。`;
  }

  return callLLM([
    { role: 'system', content: systemPrompt + `

【特殊任务：改写文案】
你现在的任务是改写一段别人的文案，使其：
1. 保留核心观点和信息
2. 完全改变表达方式、句式结构、用词
3. 加入品牌自身的视角和特色
4. 目标：与原文的文字重复率低于10%

【语气要求】
- 这是口播稿，像老师跟学生聊天，平等交流，不要居高临下也不要谄媚讨好
- 不要用营销号语气（"你知道吗？""一探究竟""不妨关注我们"这类都不要）
- 不要在结尾硬塞关注/点赞/私信引导，除非原文本身就有
- 保持说人话的自然感，像面对面聊天而不是念稿` },
    { role: 'user', content: `请改写以下文案。${modeNote}\n\n${text}` }
  ], 0.9);
}

// 导出
window.API = {
  generateSingle, autoPickTopics, improveContent,
  rewriteContent, analyzeReference, buildSystemPrompt,
  getApiKey, saveApiKey
};
