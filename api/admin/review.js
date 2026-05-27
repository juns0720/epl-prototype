const { requireToken } = require('../_lib/auth');
const { legacyNewsTypeFromBriefingStatus } = require('../_lib/ai');
const { recordAudit } = require('../_lib/audit');
const { handleError, json, parseJsonBody } = require('../_lib/http');
const { notifyPublished } = require('../_lib/slack');
const { eq, patch, select } = require('../_lib/supabase');

async function loadItem(id) {
  const rows = await select('content_items', `select=*&${eq('id', id)}&limit=1`);
  const item = rows[0];
  if (!item) throw Object.assign(new Error('content item not found'), { statusCode: 404 });
  return item;
}

function patchForBody(body, currentItem) {
  const now = new Date().toISOString();
  const base = { updated_at: now };
  if (typeof body.title_ko === 'string') base.title_ko = body.title_ko;
  const summaryShort = typeof body.summary_short_ko === 'string' ? body.summary_short_ko : body.summary_ko;
  if (typeof summaryShort === 'string') {
    base.summary_short_ko = summaryShort;
    base.summary_ko = summaryShort;
  }
  if (typeof body.summary_detail_ko === 'string') base.summary_detail_ko = body.summary_detail_ko;
  if (typeof body.briefing_status === 'string') base.briefing_status = body.briefing_status;
  if (typeof body.review_reason === 'string') base.review_reason = body.review_reason;
  if (Array.isArray(body.team_tags)) base.team_tags = body.team_tags;
  if (typeof body.news_type === 'string') base.news_type = body.news_type;

  const currentAi = currentItem.ai_result || {};
  const currentBriefing = currentAi.briefing || {};
  const shouldPatchBriefing =
    typeof body.title_ko === 'string' ||
    typeof summaryShort === 'string' ||
    typeof body.summary_detail_ko === 'string' ||
    typeof body.briefing_status === 'string' ||
    Array.isArray(body.team_tags);

  if (shouldPatchBriefing) {
    const nextBriefing = {
      title: typeof body.title_ko === 'string' ? body.title_ko : currentBriefing.title,
      summary_short: typeof summaryShort === 'string' ? summaryShort : currentBriefing.summary_short,
      summary_detail: typeof body.summary_detail_ko === 'string' ? body.summary_detail_ko : currentBriefing.summary_detail,
      tags: Array.isArray(body.team_tags) ? body.team_tags : currentBriefing.tags,
      status: typeof body.briefing_status === 'string' ? body.briefing_status : currentBriefing.status,
    };

    base.ai_result = {
      ...currentAi,
      briefing: nextBriefing,
    };

    if (typeof body.news_type !== 'string') {
      base.news_type = legacyNewsTypeFromBriefingStatus(nextBriefing.status, currentAi.decision);
    }
  }

  if (body.action === 'approve') {
    const nextAiResult = {
      ...(base.ai_result || currentAi),
      decision: 'publish',
      review_reason: null,
    };
    return {
      ...base,
      ai_result: nextAiResult,
      status: 'published',
      published_at: now,
      reviewed_at: now,
      reviewed_by: body.actor || 'admin',
      review_reason: null,
      review_note: null,
    };
  }
  if (body.action === 'reject') {
    const reviewNote = typeof body.review_note === 'string' ? body.review_note.trim() : '';
    if (!reviewNote) {
      throw Object.assign(new Error('review_note is required when rejecting an item'), { statusCode: 400 });
    }
    const nextAiResult = {
      ...(base.ai_result || currentAi),
      decision: 'review',
      review_reason: reviewNote,
    };
    return {
      ...base,
      ai_result: nextAiResult,
      status: 'rejected',
      published_at: null,
      reviewed_at: now,
      reviewed_by: body.actor || 'admin',
      review_reason: reviewNote,
      review_note: reviewNote,
    };
  }
  if (body.action === 'update') {
    return base;
  }
  throw Object.assign(new Error('action must be approve, reject, or update'), { statusCode: 400 });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' });
      return;
    }
    requireToken(req, 'ADMIN_TOKEN', 'admin');
    const body = await parseJsonBody(req);
    if (!body.id) throw Object.assign(new Error('id is required'), { statusCode: 400 });

    const currentItem = await loadItem(body.id);
    const updated = await patch('content_items', eq('id', body.id), patchForBody(body, currentItem));
    const item = updated[0];
    await recordAudit(`admin_${body.action}`, {
      content_item_id: item.id,
      actor: body.actor || 'admin',
      action: body.action,
    });

    if (body.action === 'approve') {
      await notifyPublished(item, 'admin-approved').catch(error =>
        recordAudit('slack_notify_failed', { content_item_id: item.id, message: error.message })
      );
    }

    json(res, 200, { ok: true, item });
  } catch (error) {
    handleError(res, error);
  }
};
