/**
 * Placeholder that stands in for the results page while connections are being fetched.
 *
 * Shaped like the page it replaces — a row of time-slot chips, a connection card, a
 * second chip row — so the layout does not jump when the real content arrives. Shown by
 * adding `is-loading` to `#resultsPage`, which hides the real sliders and content area.
 *
 * Used twice: while a shared journey loads (so the recipient never sees the search form)
 * and while a shared journey is re-planned from a new departure point.
 *
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the skeleton.
 */
export function getResultsSkeletonHTML(args) {
    const { t } = args;

    const chipRow = `
        <div class="skeleton-chip-row">
            ${Array.from({length: 6}, () => '<span class="skeleton-block skeleton-chip"></span>').join('')}
        </div>`;

    return `
      <div id="resultsSkeleton" class="results-skeleton" role="status" aria-live="polite">
        <span class="skeleton-sr-only">${t('loadingStateSearching')}</span>
        ${chipRow}
        <div class="skeleton-card">
            <span class="skeleton-block skeleton-line skeleton-line-lg"></span>
            <span class="skeleton-block skeleton-line skeleton-line-sm"></span>
            <span class="skeleton-block skeleton-line skeleton-line-md"></span>
        </div>
        ${chipRow}
      </div>
    `;
}
