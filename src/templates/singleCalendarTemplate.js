import { getMonthName, getShortDayName } from '../utils';

/**
 * Generates the HTML for the single calendar pop-up.
 * @param {object} args - Arguments including t, currentViewMonth, currentViewYear, daysHTML.
 * @returns {string} HTML string for the single calendar.
 */
export function getSingleCalendarHTML(args) {
    const { t, currentViewMonth, currentViewYear, daysHTML } = args;

    return `
        <div class="calendar-header"><p class="calendar-title">${t("datePickerTitle")}</p></div>
        <div class="calendar-body">
            <div class="calendar-nav">
                <button type="button" class="calendar-nav-btn prev-month" aria-label="${t('ariaLabels.previousMonthButton')}">&#9664;</button>
                <div class="calendar-month-year">${getMonthName(currentViewMonth, t)} ${currentViewYear}</div>
                <button type="button" class="calendar-nav-btn next-month" aria-label="${t('ariaLabels.nextMonthButton')}">&#9654;</button>
            </div>
            <div class="calendar-grid">
                ${[0, 1, 2, 3, 4, 5, 6].map(day => `<div class="calendar-day-header">${getShortDayName(day, t)}</div>`).join('')}
                ${daysHTML}
            </div>
        </div>
        <div class="calendar-footer">
            <button type="button" class="calendar-footer-btn calendar-cancel-btn">${t("cancel")}</button>
            <button type="button" class="calendar-footer-btn calendar-apply-btn">${t("apply")}</button>
        </div>
    `;
}
