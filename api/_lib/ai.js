const { OFFICIAL_KEYWORDS, RUMOUR_KEYWORDS, TARGET_TEAMS, hasAny, matchTeams } = require('./constants');

const TARGET_TEAM_CODES = TARGET_TEAMS.map(team => team.code);
const BRIEFING_STATUSES = ['OFFICIAL', 'RUMOUR', 'UPDATE', 'CONFIRMED', 'DENIED'];
const PUBLISHABLE_STATUSES = new Set(['OFFICIAL', 'CONFIRMED']);

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_target_relevant',
    'teams',
    'decision',
    'confidence',
    'entities',
    'evidence',
    'review_reason',
    'briefing',
  ],
  properties: {
    is_target_relevant: { type: 'boolean' },
    teams: {
      type: 'array',
      items: { type: 'string', enum: TARGET_TEAM_CODES },
    },
    decision: { type: 'string', enum: ['publish', 'review', 'discard'] },
    confidence: { type: 'number' },
    entities: {
      type: 'object',
      additionalProperties: false,
      required: ['players', 'clubs', 'competitions', 'journalists'],
      properties: {
        players: { type: 'array', items: { type: 'string' } },
        clubs: { type: 'array', items: { type: 'string' } },
        competitions: { type: 'array', items: { type: 'string' } },
        journalists: { type: 'array', items: { type: 'string' } },
      },
    },
    evidence: { type: 'array', items: { type: 'string' } },
    review_reason: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    briefing: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'summary_short', 'summary_detail', 'tags', 'status'],
      properties: {
        title: { type: 'string' },
        summary_short: { type: 'string' },
        summary_detail: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string', enum: TARGET_TEAM_CODES },
        },
        status: { type: 'string', enum: BRIEFING_STATUSES },
      },
    },
  },
};

function parseChatContent(payload) {
  return payload.choices?.[0]?.message?.content || null;
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Solar response did not include message content');

  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Solar response was not valid JSON');
  }
}

function uniqueTargetTeams(values) {
  const allowed = new Set(TARGET_TEAM_CODES);
  const output = [];
  for (const value of values || []) {
    const code = String(value || '').trim().toUpperCase();
    if (allowed.has(code) && !output.includes(code)) output.push(code);
  }
  return output;
}

function normalizeConfidence(value) {
  let confidence = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (confidence > 1 && confidence <= 100) confidence /= 100;
  return Math.max(0, Math.min(confidence, 1));
}

function normalizeDecision(value) {
  return ['publish', 'review', 'discard'].includes(value) ? value : 'review';
}

function normalizeStatus(value, fallback = 'UPDATE') {
  const normalized = String(value || '').trim().toUpperCase();
  if (BRIEFING_STATUSES.includes(normalized)) return normalized;
  if (normalized === 'OFFICIAL') return 'OFFICIAL';
  if (normalized === 'CONFIRMED') return 'CONFIRMED';
  if (normalized === 'RUMOUR' || normalized === 'RUMOR') return 'RUMOUR';
  if (normalized === 'IRRELEVANT' || normalized === 'AMBIGUOUS') return fallback;
  return fallback;
}

function reviewReason(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean : null;
}

function textSnippet(post, max = 220) {
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function isMediaHeavy(post) {
  return (post.media || []).length > 0 && String(post.text || '').trim().length < 40;
}

function legacyNewsTypeFromBriefingStatus(status, decision) {
  if (decision === 'discard') return 'irrelevant';
  const normalized = normalizeStatus(status);
  if (normalized === 'OFFICIAL' || normalized === 'CONFIRMED') return 'official';
  if (normalized === 'RUMOUR') return 'rumour';
  return 'ambiguous';
}

function normalizeBriefing(result, teams, post) {
  const source = result.briefing || {};
  const status = normalizeStatus(source.status, 'UPDATE');
  const fallbackSummary = textSnippet(post);
  const title = String(source.title || '검수 필요 EPL 업데이트').trim();
  const summaryShort = String(source.summary_short || fallbackSummary).trim();
  const summaryDetail = String(source.summary_detail || source.summary_short || fallbackSummary).trim();

  return {
    title,
    summary_short: summaryShort,
    summary_detail: summaryDetail,
    tags: uniqueTargetTeams(source.tags || teams),
    status,
  };
}

function neutralBriefing(post) {
  const snippet = textSnippet(post) || '원문 텍스트가 비어 있습니다.';
  return {
    title: '비대상 EPL 업데이트',
    summary_short: snippet,
    summary_detail: snippet,
    tags: [],
    status: 'UPDATE',
  };
}

function fallbackStatus({ relevant, officialish, rumourish }) {
  if (!relevant) return 'UPDATE';
  if (rumourish) return 'RUMOUR';
  if (officialish) return 'CONFIRMED';
  return 'UPDATE';
}

function fallbackClassify(post, aliases) {
  const teams = matchTeams(post.text, aliases);
  const relevant = teams.length > 0;
  const officialish = hasAny(post.text, OFFICIAL_KEYWORDS);
  const rumourish = hasAny(post.text, RUMOUR_KEYWORDS);
  const status = fallbackStatus({ relevant, officialish, rumourish });
  const snippet = textSnippet(post);

  return enforcePolicy({
    is_target_relevant: relevant,
    teams,
    decision: relevant ? 'review' : 'discard',
    confidence: relevant ? 0.55 : 0.9,
    entities: {
      players: [],
      clubs: teams,
      competitions: [],
      journalists: post.author_handle ? [post.author_handle] : [],
    },
    evidence: relevant ? ['Upstage Solar 키가 없어 alias 기반 규칙으로만 분류했습니다.'] : ['대상 6개 팀 alias와 일치하지 않았습니다.'],
    review_reason: relevant
      ? (isMediaHeavy(post) ? '사진/영상 중심이거나 텍스트가 짧아 검수가 필요합니다.' : 'Upstage Solar 키가 없어 자동 발행하지 않고 검수로 보냅니다.')
      : null,
    briefing: {
      title: relevant ? '검수 필요 EPL 업데이트' : '비대상 EPL 업데이트',
      summary_short: snippet || '원문 텍스트가 비어 있습니다.',
      summary_detail: snippet || '원문 텍스트가 비어 있습니다.',
      tags: teams,
      status,
    },
  }, post, aliases);
}

function enforcePolicy(result, post, aliases = []) {
  const localEvidenceTeams = uniqueTargetTeams(matchTeams(post.text, aliases));
  const modelTeams = uniqueTargetTeams([...(result.teams || []), ...((result.briefing && result.briefing.tags) || [])]);
  const teams = localEvidenceTeams.length > 0
    ? localEvidenceTeams
    : modelTeams.filter(code => localEvidenceTeams.includes(code));
  const confidence = normalizeConfidence(result.confidence);
  const briefing = normalizeBriefing(result, teams, post);
  const evidence = Array.isArray(result.evidence) ? result.evidence.filter(Boolean).map(String) : [];
  const hasEvidence = evidence.length > 0;
  const mediaHeavy = isMediaHeavy(post);
  const hasLocalPublishSignal = hasAny(post.text, OFFICIAL_KEYWORDS);
  const reason = reviewReason(result.review_reason);
  const targetRelevant = localEvidenceTeams.length > 0;
  let decision = normalizeDecision(result.decision);

  const cleanResult = {
    ...result,
    is_target_relevant: targetRelevant,
    teams: targetRelevant ? localEvidenceTeams : [],
    decision,
    confidence,
    entities: {
      players: Array.isArray(result.entities?.players) ? result.entities.players : [],
      clubs: Array.isArray(result.entities?.clubs) ? result.entities.clubs : [],
      competitions: Array.isArray(result.entities?.competitions) ? result.entities.competitions : [],
      journalists: Array.isArray(result.entities?.journalists) ? result.entities.journalists : [],
    },
    evidence,
    review_reason: reason,
    briefing: {
      ...briefing,
      tags: targetRelevant ? localEvidenceTeams : [],
    },
  };

  if (!targetRelevant) {
    return {
      ...cleanResult,
      is_target_relevant: false,
      teams: [],
      decision: 'discard',
      review_reason: null,
      briefing: neutralBriefing(post),
    };
  }

  const canPublish =
    PUBLISHABLE_STATUSES.has(cleanResult.briefing.status) &&
    cleanResult.confidence >= 0.85 &&
    !cleanResult.review_reason &&
    hasEvidence &&
    hasLocalPublishSignal &&
    !mediaHeavy;

  if (decision === 'publish' && !canPublish) {
    return {
      ...cleanResult,
      decision: 'review',
      review_reason: cleanResult.review_reason || (hasLocalPublishSignal
        ? '보수적 자동 발행 정책에 따라 검수가 필요합니다.'
        : '원문에 공식/확정 발표 키워드 근거가 없어 검수가 필요합니다.'),
    };
  }

  if (mediaHeavy) {
    return {
      ...cleanResult,
      decision: 'review',
      review_reason: cleanResult.review_reason || '사진/영상 중심이거나 텍스트가 짧아 검수가 필요합니다.',
    };
  }

  if (cleanResult.decision === 'discard') {
    return {
      ...cleanResult,
      decision: 'review',
      review_reason: cleanResult.review_reason || '대상 팀 근거가 있어 폐기 전에 검수가 필요합니다.',
    };
  }

  if (!PUBLISHABLE_STATUSES.has(cleanResult.briefing.status) && decision === 'publish') {
    return {
      ...cleanResult,
      decision: 'review',
      review_reason: cleanResult.review_reason || '루머/업데이트/부인 상태는 자동 발행할 수 없습니다.',
    };
  }

  return cleanResult;
}

function solarBaseUrl() {
  return String(process.env.UPSTAGE_BASE_URL || 'https://api.upstage.ai/v1').replace(/\/$/, '');
}

function systemPrompt() {
  return [
    'You classify football X posts for a Korean EPL fan product.',
    'Return JSON only. Do not return markdown, code fences, commentary, or extra text.',
    'The JSON object must follow this exact top-level shape: is_target_relevant, teams, decision, confidence, entities, evidence, review_reason, briefing.',
    'Only these target teams are in scope: MUN, MCI, LIV, ARS, TOT, CHE.',
    'Target team Korean names: MUN=맨유, MCI=맨시티, LIV=리버풀, ARS=아스널, TOT=토트넘, CHE=첼시.',
    'Discard posts unrelated to those six teams.',
    'If a team is not named but a player/manager alias clearly links to one target team, tag that team. If the link is uncertain, choose review.',
    'All user-facing briefing fields must be written in Korean.',
    'Use only facts stated in the original X post. Do not add background context, fan sentiment, source credibility commentary, debate framing, opinion, or emotional wording.',
    'Never mention names, seasons, clubs, records, or historical context that are not literally present in the original X post.',
    'Do not add "reported by", "according to", source attribution, or journalist framing unless that wording is visible in the original X post text.',
    'The author_handle is metadata for routing only, not a fact to include in briefing text.',
    'Every person name in briefing.title, briefing.summary_short, and briefing.summary_detail must correspond to a person name visible in the original X post.',
    'Preserve visible person names accurately. If the post says "Mikel Arteta", write "미켈 아르테타"; do not replace him with Arsenal or "아르센".',
    'Write Arsenal as "아스널"; never write Arsenal as "아르센".',
    'Do not introduce historical person names such as Arsene Wenger, Sir Alex Ferguson, Jose Mourinho, Pep Guardiola, Jurgen Klopp, or Mauricio Pochettino unless the original X post contains that name.',
    'If the post says a generic fact such as "first title in 22 years", translate that fact literally; do not infer who the previous manager was or what season it refers to.',
    'For example, if an Arsenal post says only "first title in 22 years", do not write "아르센 벵거 이후".',
    'For discarded posts, keep the briefing neutral and based only on the visible text.',
    'Do not use clickbait, exclamation marks, emojis, or exaggerated Korean words such as 충격, 초대형, 전격.',
    'Use speculative Korean reporting endings for unconfirmed information.',
    'Allowed decision values: publish, review, discard.',
    'Allowed briefing.status values: OFFICIAL, CONFIRMED, UPDATE, RUMOUR, DENIED.',
    'Set briefing.status to OFFICIAL for club/player official announcements, CONFIRMED for definitive completed reports, UPDATE for progress, RUMOUR for interest/talks/possibility, and DENIED for denial/collapse/rejection.',
    'Only choose decision=publish when the post is target-relevant, text-supported, status is OFFICIAL or CONFIRMED, confidence is at least 0.85, evidence exists, and review_reason is null.',
    'Rumours, speculative wording, ambiguous posts, media-heavy posts, short captions, photos, and videos must go to review.',
  ].join('\n');
}

function userPrompt(post, aliases) {
  return JSON.stringify({
    required_json_contract: CLASSIFICATION_SCHEMA,
    post,
    target_team_aliases: aliases,
  });
}

async function requestSolar(body, allowRetry = true) {
  const response = await fetch(`${solarBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (response.ok) return payload;

  const message = payload.error?.message || '';
  if (allowRetry && response.status === 400 && /response_format|json_object/i.test(message)) {
    const { response_format: _ignored, ...retryBody } = body;
    return requestSolar(retryBody, false);
  }

  throw Object.assign(new Error(message || 'Upstage Solar classification failed'), {
    statusCode: response.status >= 500 ? 502 : response.status,
    payload,
  });
}

async function classifyPost(post, aliases) {
  if (!process.env.UPSTAGE_API_KEY) return fallbackClassify(post, aliases);

  const payload = await requestSolar({
    model: process.env.UPSTAGE_MODEL || 'solar-pro3',
    messages: [
      {
        role: 'system',
        content: systemPrompt(),
      },
      {
        role: 'user',
        content: userPrompt(post, aliases),
      },
    ],
    temperature: 0.1,
    stream: false,
    response_format: { type: 'json_object' },
  });

  return enforcePolicy(parseJsonObject(parseChatContent(payload)), post, aliases);
}

module.exports = {
  classifyPost,
  enforcePolicy,
  legacyNewsTypeFromBriefingStatus,
};
