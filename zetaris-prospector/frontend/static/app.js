/**
 * Zetaris Prospector — shared Alpine.js utilities
 * Loaded on pages that need shared helpers beyond inline scripts.
 */

/**
 * Render simple Markdown to HTML.
 * Handles: ## headings, **bold**, - lists, line breaks.
 */
function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-5 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-gray-700 mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-gray-600 mb-1">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-gray-600 mb-2">');
  return `<p class="text-sm text-gray-600 mb-2">${html}</p>`;
}

/**
 * Copy text to clipboard with toast feedback.
 */
async function copyText(text, toastFn) {
  try {
    await navigator.clipboard.writeText(text);
    if (toastFn) toastFn('Copied to clipboard');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (toastFn) toastFn('Copied');
  }
}

/**
 * Format ISO date string to readable locale string.
 */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Tier CSS class lookup.
 */
function tierClass(tier) {
  const map = {
    'Hot': 'tier-hot',
    'Warm': 'tier-warm',
    'Cold': 'tier-cold',
    'Disqualified': 'tier-disqualified',
    'Unscored': 'tier-unscored',
  };
  return map[tier] || 'tier-unscored';
}
