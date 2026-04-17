import type { ProjectDetail } from '../types/project.js';
import { appConfig } from '../core/config.js';

const BASE = 'https://www.workana.com';

// Convert relative time ("Just now", "5 minutes ago", "2 hours ago", "Yesterday")
// to absolute time in configured timezone
function relativeTimeToAbsolute(relativeTime: string): string {
  const tz = appConfig.posting.timezone;
  const now = new Date();

  const lower = relativeTime.toLowerCase().trim();

  let date: Date | null = null;

  if (lower === 'just now') {
    date = now;
  } else if (lower.includes('minute')) {
    const m = lower.match(/(\d+)/);
    if (m) {
      date = new Date(now.getTime() - parseInt(m[1]) * 60 * 1000);
    }
  } else if (lower.includes('hour')) {
    const m = lower.match(/(\d+)/);
    if (m) {
      date = new Date(now.getTime() - parseInt(m[1]) * 60 * 60 * 1000);
    }
  } else if (lower === 'yesterday') {
    date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (lower.includes('day')) {
    const m = lower.match(/(\d+)/);
    if (m) {
      date = new Date(now.getTime() - parseInt(m[1]) * 24 * 60 * 60 * 1000);
    }
  } else if (lower.includes('almost an hour')) {
    date = new Date(now.getTime() - 50 * 60 * 1000);
  }

  if (!date) return relativeTime;

  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ` (${tz.split('/')[1] || tz})`;
  } catch {
    return relativeTime;
  }
}

function link(text: string, url: string): string {
  const full = url.startsWith('http') ? url : BASE + url;
  return `<a href="${full}">${escapeHtml(text)}</a>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function starsText(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) + ` ${rating.toFixed(1)}/5`;
}

export function formatProjectMessage(project: ProjectDetail): string {
  const lines: string[] = [];

  // Title as hyperlink
  lines.push(`📋 <b>${link(project.title, project.url)}</b>`);
  lines.push('');

  // Budget
  lines.push(`💰 <b>${escapeHtml(project.budget)}</b>`);

  // Skills
  if (project.skills.length > 0) {
    lines.push(`🏷 ${project.skills.map(s => `<code>${escapeHtml(s)}</code>`).join('  ')}`);
  }

  // Category
  if (project.category || project.subcategory) {
    const parts = [project.category, project.subcategory].filter(Boolean);
    lines.push(`📂 ${escapeHtml(parts.join(' → '))}`);
  }

  // Status
  if (project.status) {
    lines.push(`📌 ${escapeHtml(project.status)}`);
  }

  // Stats
  const stats: string[] = [];
  stats.push(`Bids: <b>${project.bidsCount}</b>`);
  if (project.interestedCount > 0) stats.push(`Interested: <b>${project.interestedCount}</b>`);
  if (project.publishedAt) stats.push(`Posted: ${escapeHtml(relativeTimeToAbsolute(project.publishedAt))}`);
  lines.push(`📊 ${stats.join(' · ')}`);
  lines.push('');

  // Separator
  lines.push('─────────────────────');

  // Client info
  const clientLink = project.clientProfileUrl
    ? link(project.clientName, project.clientProfileUrl)
    : escapeHtml(project.clientName);
  lines.push(`👤 <b>${clientLink}</b>  (${escapeHtml(project.clientCountry)})`);

  // Client rating
  if (project.clientRating > 0) {
    lines.push(`   ${starsText(project.clientRating)}`);
  }

  // Client history
  const history: string[] = [];
  history.push(`Published: ${project.clientProjectsPublished}`);
  history.push(`Paid: ${project.clientProjectsPaid}`);
  if (project.clientProjectsPublished > 0) {
    const rate = Math.round((project.clientProjectsPaid / project.clientProjectsPublished) * 100);
    history.push(`(${rate}%)`);
  }
  lines.push(`   📈 ${history.join(' / ')}`);

  if (project.clientMemberSince) {
    lines.push(`   📅 Member since ${escapeHtml(project.clientMemberSince)}`);
  }

  if (project.paymentVerified) {
    lines.push('   ✅ Payment verified');
  }

  lines.push('');

  // Separator
  lines.push('─────────────────────');
  lines.push('📝 <b>Description</b>');
  lines.push('');

  // Full description
  const desc = project.fullDescription || project.descriptionPreview || '';
  if (desc) {
    lines.push(escapeHtml(desc));
  }

  // Reviews
  if (project.clientReviews.length > 0) {
    lines.push('');
    lines.push('─────────────────────');
    lines.push(`💬 <b>Client Reviews</b> (${project.clientReviews.length})`);
    lines.push('');

    for (const review of project.clientReviews) {
      const freelancerLink = review.freelancerProfileUrl
        ? link(review.freelancerName, review.freelancerProfileUrl)
        : escapeHtml(review.freelancerName);

      lines.push(`  ${starsText(review.rating)}  ${freelancerLink}`);
      lines.push(`  🕐 ${escapeHtml(review.timeAgo)}`);

      if (review.projectTitle) {
        lines.push(`  📁 ${escapeHtml(review.projectTitle)}`);
      }

      if (review.comment) {
        lines.push(`  💭 <i>"${escapeHtml(review.comment)}"</i>`);
      }
      lines.push('');
    }
  } else {
    lines.push('');
    lines.push('─────────────────────');
    lines.push('💬 No reviews');
  }

  // Build message without description first to calculate available space
  const withoutDesc = lines.filter((_, i) => {
    // Find description section indices
    const descHeaderIdx = lines.indexOf('📝 <b>Description</b>');
    if (descHeaderIdx < 0) return true;
    const nextSeparatorIdx = lines.indexOf('─────────────────────', descHeaderIdx + 1);
    const descEnd = nextSeparatorIdx > descHeaderIdx ? nextSeparatorIdx : lines.length;
    return i < descHeaderIdx || i >= descEnd;
  }).join('\n');

  const overhead = withoutDesc.length + 30; // 30 for header + newlines
  const available = 4096 - overhead;

  // Replace full description with truncated version if needed
  if (desc && available > 50) {
    const escapedDesc = escapeHtml(desc);
    if (escapedDesc.length > available) {
      // Find and replace the description in lines
      const descIdx = lines.indexOf(escapeHtml(desc));
      if (descIdx >= 0) {
        lines[descIdx] = escapeHtml(desc.substring(0, available - 3)) + '...';
      }
    }
  }

  return lines.join('\n').trim();
}
