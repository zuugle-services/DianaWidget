/**
 * Generates the HTML for the "change departure point" dialog used while a shared journey
 * is open. It is opened on demand from the share info banner — never on load, so the
 * recipient always sees the journey they were sent first.
 *
 * Rendered once as a sibling of the modal inside `.diana-container`, so it overlays the
 * whole widget instead of scrolling away with the results page.
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the dialog overlay.
 */
export function getShareOriginDialogHTML(args) {
    const { t } = args;

    return `
        <div id="shareOriginOverlay" class="share-origin-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="shareOriginTitle">
            <div class="share-origin-dialog">
                <div class="share-origin-header">
                    <h3 id="shareOriginTitle">${t('shareOriginDialog.title')}</h3>
                    <button type="button" id="shareOriginCloseBtn" class="share-origin-close-btn" aria-label="${t('cancel')}">&times;</button>
                </div>
                <div class="share-origin-body">
                    <p id="shareOriginText" class="share-origin-hint"></p>
                    <div class="share-origin-search">
                        <div class="input-container">
                            <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
                            <input type="text" class="input-field" id="shareOriginInput" placeholder="${t('enterOrigin')}" aria-label="${t('origin')}" autocomplete="off" aria-autocomplete="list" aria-controls="shareOriginSuggestions" aria-expanded="false">
                            <svg id="shareOriginLocationBtn" class="input-icon-right" style="pointer-events: auto; cursor: pointer;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="${t('useCurrentLocation')}" role="button" tabindex="0">
                                <circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line>
                            </svg>
                        </div>
                        <div id="shareOriginSuggestions" class="suggestions-container" role="listbox"></div>
                    </div>
                    <p id="shareOriginStatus" class="share-origin-status" style="display: none;" role="status"></p>
                </div>
                <div class="share-origin-footer">
                    <button type="button" id="shareOriginCancelBtn" class="share-origin-btn">${t('cancel')}</button>
                </div>
            </div>
        </div>
    `;
}
