/**
 * Generates the HTML for the range calendar modal.
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the range calendar modal.
 */
export function getRangeCalendarModalHTML(args) {
    const { t } = args;

    return `
        <div class="range-calendar-header">
            <h3>${t('selectDateRange')}</h3>
            <button type="button" class="range-calendar-close-btn" aria-label="${t('cancel')}">&times;</button>
        </div>
        <div class="range-calendar-body">
            <div class="range-calendar-instance" id="rangeCalendarInstance_${Date.now()}"></div>
        </div>
        <div class="range-calendar-footer">
            <button type="button" class="calendar-footer-btn range-calendar-cancel-btn">${t("cancel")}</button>
            <button type="button" class="calendar-footer-btn calendar-apply-btn range-calendar-apply-btn">${t("apply")}</button>
        </div>
    `;
}
