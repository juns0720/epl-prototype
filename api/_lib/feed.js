function firstMediaUrl(media) {
  if (!Array.isArray(media)) return null;
  const first = media.find(item => item?.url || item?.preview_image_url);
  return first?.url || first?.preview_image_url || null;
}

function briefingFor(item) {
  const aiBriefing = item.ai_result?.briefing || {};
  return {
    title: item.title_ko || aiBriefing.title,
    summary_short: item.summary_short_ko || item.summary_ko || aiBriefing.summary_short,
    summary_detail: item.summary_detail_ko || aiBriefing.summary_detail || item.summary_ko,
    tags: Array.isArray(item.team_tags) ? item.team_tags : aiBriefing.tags,
    status: item.briefing_status || aiBriefing.status,
  };
}

function statusLabel(briefingStatus, newsType) {
  if (briefingStatus === 'OFFICIAL' || briefingStatus === 'CONFIRMED' || newsType === 'official') return 'Official';
  if (briefingStatus === 'RUMOUR' || newsType === 'rumour') return 'Rumour';
  if (briefingStatus === 'UPDATE') return 'Talks';
  if (briefingStatus === 'DENIED') return 'Opinion';
  return 'Opinion';
}

function initials(handle) {
  const clean = String(handle || 'XP').replace(/^@/, '');
  return clean.slice(0, 2).toUpperCase() || 'XP';
}

function mapItemToPost(item) {
  const metrics = item.raw_public_metrics || {};
  const briefing = briefingFor(item);
  const teamTags = Array.isArray(briefing.tags) && briefing.tags.length > 0 ? briefing.tags : (item.team_tags || []);
  const team = Array.isArray(teamTags) ? teamTags[0] : null;
  const handle = item.raw_author_handle || item.source_handle || 'x';

  return {
    id: `live-${item.id}`,
    type: 'general',
    title: briefing.title || item.raw_text?.slice(0, 80) || 'EPL 업데이트',
    summary: briefing.summary_short || item.raw_text || '',
    briefing: briefing.summary_detail || item.raw_text || '',
    tweet: {
      author: item.raw_author_name || handle,
      initials: initials(handle),
      handle: `@${String(handle).replace(/^@/, '')}`,
      tier: item.source_tier || 2,
      timeAgo: item.raw_created_at ? new Date(item.raw_created_at).toLocaleString('ko-KR') : '',
      text: item.raw_text || '',
    },
    imageUrl: firstMediaUrl(item.media),
    club: team,
    status: statusLabel(briefing.status, item.news_type),
    hashtags: (teamTags || []).map(code => `#${code}`),
    reactions: metrics.like_count || 0,
    comments: metrics.reply_count || 0,
    bookmarks: metrics.bookmark_count || 0,
    shares: (metrics.retweet_count || 0) + (metrics.quote_count || 0),
    comments_data: [],
    sourceUrl: item.raw_url,
    ai: item.ai_result,
  };
}

module.exports = {
  mapItemToPost,
};
