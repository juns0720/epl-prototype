async function postSlack(webhookUrl, payload) {
  if (!webhookUrl) return { skipped: true };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }

  return { ok: true };
}

function itemUrl(item) {
  return item.raw_url || (item.raw_author_handle && item.raw_post_id
    ? `https://x.com/${item.raw_author_handle}/status/${item.raw_post_id}`
    : null);
}

function briefingFor(item) {
  const aiBriefing = item.ai_result?.briefing || {};
  return {
    title: item.title_ko || aiBriefing.title,
    tags: Array.isArray(item.team_tags) ? item.team_tags : aiBriefing.tags,
    status: item.briefing_status || aiBriefing.status,
  };
}

function itemTitle(item) {
  const briefing = briefingFor(item);
  return briefing.title || item.title_ko || 'EPL update';
}

function itemTeams(item) {
  const briefing = briefingFor(item);
  return Array.isArray(briefing.tags) && briefing.tags.length > 0 ? briefing.tags : (item.team_tags || []);
}

function itemStatus(item) {
  const briefing = briefingFor(item);
  return briefing.status || item.news_type || '-';
}

async function notifyPublished(item, reason = 'published') {
  const url = itemUrl(item);
  const title = itemTitle(item);
  return postSlack(process.env.SLACK_PUBLISH_WEBHOOK_URL, {
    text: `[${reason}] ${title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Published*: ${title}\n*Teams*: ${itemTeams(item).join(', ') || '-'}\n*Status*: ${itemStatus(item)} / confidence ${item.confidence ?? '-'}`,
        },
      },
      ...(url ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `<${url}|Open original X post>` },
      }] : []),
    ],
  });
}

async function notifyReview(item, reason = 'needs review') {
  const url = itemUrl(item);
  const title = itemTitle(item);
  return postSlack(process.env.SLACK_REVIEW_WEBHOOK_URL, {
    text: `[review] ${title || item.raw_text || 'EPL item'} - ${reason}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Review queue*: ${title}\n*Reason*: ${reason}\n*Teams*: ${itemTeams(item).join(', ') || '-'}\n*Status*: ${itemStatus(item)} / confidence ${item.confidence ?? '-'}`,
        },
      },
      ...(url ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `<${url}|Open original X post>` },
      }] : []),
    ],
  });
}

async function notifyError(message, payload = {}) {
  return postSlack(process.env.SLACK_REVIEW_WEBHOOK_URL, {
    text: `[collector error] ${message}`,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Collector error*: ${message}\n\`\`\`${JSON.stringify(payload, null, 2).slice(0, 2500)}\`\`\``,
      },
    }],
  });
}

module.exports = {
  notifyError,
  notifyPublished,
  notifyReview,
};
