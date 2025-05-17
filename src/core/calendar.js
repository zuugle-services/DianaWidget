// =============== FILE: calendar.js ===============
import { DateTime } from 'luxon';
import { getMonthName, getShortDayName, throttle, formatDateForDisplay } from "../utils";
import { formatDatetime } from "../datetimeUtils"

export class SingleCalendar {
    constructor(inputElement, displayElement, initialDate, widgetInstance, onDateSelectCallback, triggerAndAnchorElement) {
        this.inputElement = inputElement; // Hidden input for date value
        this.displayElement = displayElement; // Span inside "Other Date" button for text OR the button group itself
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onDateSelectCallback = onDateSelectCallback;

        // triggerAndAnchorElement is now the element that triggers the calendar AND is used for positioning.
        // This will typically be the "Other Date" button for desktop, or the button group.
        this.triggerElement = triggerAndAnchorElement;
        this.anchorElement = triggerAndAnchorElement; // Element to anchor the calendar to.

        this.selectedDate = initialDate ? new Date(initialDate.valueOf()) : new Date();
        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        } else {
            const now = new Date();
            this.currentViewMonth = now.getUTCMonth();
            this.currentViewYear = now.getUTCFullYear();
        }

        this.calendarContainer = null;
        this._init();
    }

    _init() {
        // The decision to show custom vs. native picker is now primarily in widget.js.
        // This calendar instance is for the custom UI.
        this._createCalendarContainer();
        this._attachEventListeners(); // Listeners for showing/hiding the custom calendar
        this._updateInputElement();
        this._updateDisplayElement();
    }

    _createCalendarContainer() {
        const calendarContainerId = `calendarContainer_${this.inputElement.id || 'uid'}_${Date.now()}`;
        let existingContainer = document.getElementById(calendarContainerId);

        if (existingContainer) {
            if (existingContainer.parentElement === document.body) {
                this.calendarContainer = existingContainer;
            } else {
                existingContainer.remove();
                this.calendarContainer = document.createElement("div");
                this.calendarContainer.id = calendarContainerId;
                document.body.appendChild(this.calendarContainer);
            }
        } else {
            this.calendarContainer = document.createElement("div");
            this.calendarContainer.id = calendarContainerId;
            document.body.appendChild(this.calendarContainer);
        }

        this.calendarContainer.style.position = 'absolute';
        this.calendarContainer.style.zIndex = '1050';
        this.calendarContainer.style.display = 'none';
        this.calendarContainer.className = "diana-container calendar-container";
    }

    _render() {
        if (!this.calendarContainer) return;

        const daysInMonth = new Date(this.currentViewYear, this.currentViewMonth + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(this.currentViewYear, this.currentViewMonth, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1;

        this.calendarContainer.innerHTML = `
            <div class="calendar-header"><p class="calendar-title">${this.t("datePickerTitle")}</p></div>
            <div class="calendar-body">
                <div class="calendar-nav">
                    <button type="button" class="calendar-nav-btn prev-month" aria-label="${this.t('ariaLabels.previousMonthButton')}">&#9664;</button>
                    <div class="calendar-month-year">${getMonthName(this.currentViewMonth, this.t)} ${this.currentViewYear}</div>
                    <button type="button" class="calendar-nav-btn next-month" aria-label="${this.t('ariaLabels.nextMonthButton')}">&#9654;</button>
                </div>
                <div class="calendar-grid">
                    ${[0, 1, 2, 3, 4, 5, 6].map(day => `<div class="calendar-day-header">${getShortDayName(day, this.t)}</div>`).join('')}
                    ${this._generateDaysHTML(daysInMonth, firstDayOfMonthIndex)}
                </div>
            </div>
            <div class="calendar-footer">
                <button type="button" class="calendar-footer-btn calendar-cancel-btn">${this.t("cancel")}</button>
                <button type="button" class="calendar-footer-btn calendar-apply-btn">${this.t("apply")}</button>
            </div>`;

        this._addCalendarInternalEventListeners();
    }

    _generateDaysHTML(daysInMonth, firstDayOfMonthIndex) {
        let html = "";
        const today = new Date(); today.setUTCHours(0,0,0,0);

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, day));
            const isToday = date.getTime() === new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();
            const isSelected = this.selectedDate && !isNaN(this.selectedDate.getTime()) &&
              date.getFullYear() === this.selectedDate.getFullYear() &&
              date.getMonth() === this.selectedDate.getMonth() &&
              date.getDate() === this.selectedDate.getDate();

            html += `<div class="calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}" data-day="${day}">${day}</div>`;
        }
        return html;
    }

    _addCalendarInternalEventListeners() {
        this.calendarContainer.querySelector(".prev-month").addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentViewMonth--;
            if (this.currentViewMonth < 0) {
                this.currentViewMonth = 11;
                this.currentViewYear--;
            }
            this._render();
        });

        this.calendarContainer.querySelector(".next-month").addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentViewMonth++;
            if (this.currentViewMonth > 11) {
                this.currentViewMonth = 0;
                this.currentViewYear++;
            }
            this._render();
        });

        this.calendarContainer.querySelector(".calendar-cancel-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        });

        this.calendarContainer.querySelector(".calendar-apply-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._updateInputElement();
            // this._updateDisplayElement(); // Display element update is handled by widget's _updateSingleDayDateButtonStates
            if (this.onDateSelectCallback) {
                this.onDateSelectCallback(new Date(this.selectedDate.valueOf()));
            }
            this.hide();
            this.widget.clearMessages();
        });

        this.calendarContainer.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectedDate = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, parseInt(dayElement.dataset.day)));
                this._render();
            });
        });
    }

    _attachEventListeners() {
        // This listener is for the element that triggers the CUSTOM calendar (e.g., "Other Date" button on desktop)
        if (!this.triggerElement) return;

        this.triggerElement.addEventListener("click", (e) => {
            // This event should only be attached if this custom calendar is supposed to be shown.
            // Widget.js will control whether this listener is effectively active for the "Other Date" button
            // by deciding when to show this calendar vs. native.
            e.stopPropagation();
            if (this.calendarContainer.classList.contains("active")) {
                this.hide();
            } else {
                // Before showing, ensure the calendar is up-to-date with the widget's selectedDate
                const currentDateFromWidget = this.widget.state.selectedDate || new Date();
                this.setSelectedDate(currentDateFromWidget, false); // Update internal date without calling callback
                this.show();
            }
        });

        // Hide calendar when clicking outside
        document.addEventListener("click", (e) => {
            if (this.calendarContainer && this.calendarContainer.classList.contains("active") &&
                this.triggerElement && !this.triggerElement.contains(e.target) &&
                !this.calendarContainer.contains(e.target)) {
                this.hide();
            }
        });

        const throttledReposition = throttle(this._reposition.bind(this), 50);
        let scrollableParent = this.anchorElement ? this.anchorElement.parentElement : null;
        while(scrollableParent) {
            if (scrollableParent.scrollHeight > scrollableParent.clientHeight || scrollableParent.scrollWidth > scrollableParent.clientWidth) {
                 scrollableParent.addEventListener('scroll', throttledReposition, true);
            }
            if (scrollableParent === document.body) break;
            scrollableParent = scrollableParent.parentElement;
        }
        window.addEventListener('scroll', throttledReposition, true);
        window.addEventListener('resize', throttledReposition);
    }

    _updateDisplayElement() {
        // This method is responsible for updating the text of the `displayElement` (span in "Other Date" button).
        // It's called internally by SingleCalendar and also by DianaWidget._updateSingleDayDateButtonStates.
        // The DianaWidget function will handle setting "Other Date" or the formatted date.
        // This internal update should primarily ensure the date is formatted if a specific date is selected
        // and the displayElement is indeed the one for the "Other Date" button's text.

        if (this.displayElement && this.displayElement === this.widget.elements?.otherDateText) {
            const localeMap = { EN: 'en-GB', DE: 'de-DE' };
            const locale = localeMap[this.config.language] || 'en-GB';

            if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                const today = DateTime.now().setZone(this.config.timezone).startOf('day').toJSDate();
                const tomorrow = DateTime.now().setZone(this.config.timezone).plus({ days: 1 }).startOf('day').toJSDate();
                const selectedJSDate = DateTime.fromJSDate(this.selectedDate).setZone(this.config.timezone).startOf('day').toJSDate();

                // If the selected date is today or tomorrow, the widget's _updateSingleDayDateButtonStates
                // will set the text to "Other Date" and highlight the respective button.
                // So, we only set the formatted date here if it's NOT today or tomorrow.
                if (selectedJSDate.getTime() !== today.getTime() && selectedJSDate.getTime() !== tomorrow.getTime()) {
                    this.displayElement.textContent = formatDateForDisplay(this.selectedDate, locale, this.config.timezone);
                    this.displayElement.classList.remove("placeholder");
                } else {
                    // If it IS today or tomorrow, _updateSingleDayDateButtonStates handles the "Other Date" text.
                    // We ensure it's not showing a formatted date from a previous "other" selection.
                    // this.displayElement.textContent = this.t('otherDate'); // This line is now handled by _updateSingleDayDateButtonStates
                }
            } else {
                this.displayElement.textContent = this.t('selectDate'); // Or 'otherDate' if that's the default
                this.displayElement.classList.add("placeholder");
            }
        }
    }


    _updateInputElement() {
        if (this.inputElement) {
            if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                this.inputElement.value = formatDatetime(this.selectedDate, this.config.timezone);
            } else {
                this.inputElement.value = '';
            }
        }
    }

    _reposition() {
        if (!this.calendarContainer || !this.anchorElement || !this.calendarContainer.classList.contains('active')) {
            return;
        }

        const anchorRect = this.anchorElement.getBoundingClientRect(); // Use anchorElement for positioning
        const desiredCalendarWidth = Math.max(280, anchorRect.width); // Example: min-width of 280px or anchor width
        this.calendarContainer.style.width = `${desiredCalendarWidth}px`;


        const calendarHeight = this.calendarContainer.offsetHeight;
        const calendarWidth = this.calendarContainer.offsetWidth;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const gap = 5;

        let finalTop = anchorRect.bottom + scrollTop + gap;
        if (anchorRect.bottom + gap + calendarHeight > viewportHeight &&
            anchorRect.top - calendarHeight - gap > scrollTop) {
            finalTop = anchorRect.top + scrollTop - calendarHeight - gap;
        } else if (anchorRect.bottom + gap + calendarHeight > viewportHeight) {
            if (finalTop + calendarHeight > scrollTop + viewportHeight) {
                 finalTop = scrollTop + viewportHeight - calendarHeight - gap;
            }
            if (finalTop < scrollTop) finalTop = scrollTop + gap;
        }

        let finalLeft = anchorRect.left + scrollLeft;
        if (anchorRect.left + calendarWidth > viewportWidth) {
            finalLeft = anchorRect.right + scrollLeft - calendarWidth;
        }
        if (finalLeft < scrollLeft) {
            finalLeft = scrollLeft;
        }

        this.calendarContainer.style.top = `${finalTop}px`;
        this.calendarContainer.style.left = `${finalLeft}px`;
    }

    show() {
        if (!this.calendarContainer) return;

        // Sync current view with selectedDate before rendering
        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        } else { // Default to current month if no date selected
            const now = new Date();
            this.currentViewMonth = now.getUTCMonth();
            this.currentViewYear = now.getUTCFullYear();
        }
        this._render();
        this.calendarContainer.style.display = 'block';
        this.calendarContainer.classList.add("active");
        this._reposition();
    }

    hide() {
        if (!this.calendarContainer) return;
        this.calendarContainer.style.display = 'none';
        this.calendarContainer.classList.remove("active");
    }

    setSelectedDate(date, triggerCallback = true) {
        this.selectedDate = new Date(date.valueOf());
        if (!isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        }
        this._updateInputElement();
        // this._updateDisplayElement(); // Display update is handled by widget's _updateSingleDayDateButtonStates
                                     // or by the calendar apply button's callback.

        if (this.calendarContainer && this.calendarContainer.classList.contains("active")) {
            this._render(); // Re-render calendar if visible to reflect the new date
        }
        if (triggerCallback && this.onDateSelectCallback) {
            // This callback is usually for when the *calendar itself* makes a selection.
            // If widget.js is setting the date (e.g. from "Today" button), it handles its own logic.
            // this.onDateSelectCallback(new Date(this.selectedDate.valueOf()));
        }
    }
}

// RangeCalendarModal remains unchanged for this request
export class RangeCalendarModal {
    constructor(initialStartDate, initialEndDate, widgetInstance, onRangeSelectCallback, overrideStartDateStr, overrideEndDateStr, activityDurationDaysFixed) {
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onRangeSelectCallback = onRangeSelectCallback;
        this.activityDurationDaysFixed = activityDurationDaysFixed ? parseInt(activityDurationDaysFixed, 10) : null;

        this.fixedStartDate = overrideStartDateStr ? DateTime.fromISO(overrideStartDateStr, { zone: 'utc' }).toJSDate() : null;
        if (this.fixedStartDate && isNaN(this.fixedStartDate.getTime())) this.fixedStartDate = null;
        if (this.fixedStartDate) this.fixedStartDate.setUTCHours(0,0,0,0);

        this.fixedEndDate = overrideEndDateStr ? DateTime.fromISO(overrideEndDateStr, { zone: 'utc' }).toJSDate() : null;
        if (this.fixedEndDate && isNaN(this.fixedEndDate.getTime())) this.fixedEndDate = null;
        if (this.fixedEndDate) this.fixedEndDate.setUTCHours(0,0,0,0);

        const today = new Date(); today.setUTCHours(0,0,0,0);

        this.tempStartDate = this.fixedStartDate
                             ? new Date(this.fixedStartDate.valueOf())
                             : (initialStartDate && !isNaN(new Date(initialStartDate.valueOf()))
                                ? new Date(initialStartDate.valueOf())
                                : new Date(today.valueOf()));
        this.tempStartDate.setUTCHours(0,0,0,0);

        this.tempEndDate = this.fixedEndDate
                           ? new Date(this.fixedEndDate.valueOf())
                           : (initialEndDate && !isNaN(new Date(initialEndDate.valueOf()))
                              ? new Date(initialEndDate.valueOf())
                              : new Date(this.tempStartDate.valueOf()));
        this.tempEndDate.setUTCHours(0,0,0,0);

        if (this.activityDurationDaysFixed && !this.fixedStartDate && !this.fixedEndDate) {
            this.tempEndDate = DateTime.fromJSDate(this.tempStartDate).plus({ days: this.activityDurationDaysFixed - 1 }).toJSDate();
        }

        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }
        if (this.fixedStartDate && this.fixedEndDate && this.fixedStartDate > this.fixedEndDate) {
            this.fixedEndDate = null;
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        this.currentViewMonth = this.tempStartDate.getUTCMonth();
        this.currentViewYear = this.tempStartDate.getUTCFullYear();

        if (this.fixedStartDate && !this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = false;
        } else if (!this.fixedStartDate && this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = true;
        } else if (this.fixedStartDate && this.fixedEndDate) {
            this.selectingStartDate = false;
        } else if (this.activityDurationDaysFixed) {
            this.selectingStartDate = true;
        } else {
            this.selectingStartDate = true;
        }

        this.modalOverlay = null;
        this.modalElement = null;
        this.calendarInstance = null;

        this._initDOM();
        this._attachEventListeners();
    }

    _initDOM() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'range-calendar-overlay';

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'range-calendar-modal';
        this.modalElement.innerHTML = `
            <div class="range-calendar-header">
                <h3>${this.t('selectDateRange')}</h3>
                <button type="button" class="range-calendar-close-btn">&times;</button>
            </div>
            <div class="range-calendar-body">
                <div class="range-calendar-instance" id="rangeCalendarInstance_${Date.now()}"></div>
            </div>
            <div class="range-calendar-footer">
                <button type="button" class="calendar-footer-btn range-calendar-cancel-btn">${this.t("cancel")}</button>
                <button type="button" class="calendar-footer-btn calendar-apply-btn range-calendar-apply-btn">${this.t("apply")}</button>
            </div>
        `;

        this.modalOverlay.appendChild(this.modalElement);
        this.widget.container.appendChild(this.modalOverlay);

        this.calendarInstance = this.modalElement.querySelector('.range-calendar-instance');
        this._renderCalendar();
    }

    _renderCalendar() {
        this._renderMonth(this.currentViewYear, this.currentViewMonth, this.calendarInstance);
    }

    _renderMonth(year, month, targetElement) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(year, month, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1;

        targetElement.innerHTML = `
            <div class="calendar-nav">
                <button type="button" class="calendar-nav-btn prev-month-range" aria-label="${this.t('ariaLabels.previousMonthButton')}">&#9664;</button>
                <div class="calendar-month-year">${getMonthName(month, this.t)} ${year}</div>
                <button type="button" class="calendar-nav-btn next-month-range" aria-label="${this.t('ariaLabels.nextMonthButton')}">&#9654;</button>
            </div>
            <div class="calendar-grid">
                ${[0,1,2,3,4,5,6].map(d => `<div class="calendar-day-header">${getShortDayName(d, this.t)}</div>`).join('')}
                ${this._generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month)}
            </div>`;
        this._addRangeCalendarInternalEventListeners(targetElement);
    }

    _generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month) {
        let html = "";
        const today = new Date(); today.setUTCHours(0,0,0,0);

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));
            let classes = "calendar-day";

            const normTempStartDate = this.tempStartDate ? new Date(Date.UTC(this.tempStartDate.getUTCFullYear(), this.tempStartDate.getUTCMonth(), this.tempStartDate.getUTCDate())) : null;
            const normTempEndDate = this.tempEndDate ? new Date(Date.UTC(this.tempEndDate.getUTCFullYear(), this.tempEndDate.getUTCMonth(), this.tempEndDate.getUTCDate())) : null;
            const normFixedStartDate = this.fixedStartDate ? new Date(Date.UTC(this.fixedStartDate.getUTCFullYear(), this.fixedStartDate.getUTCMonth(), this.fixedStartDate.getUTCDate())) : null;
            const normFixedEndDate = this.fixedEndDate ? new Date(Date.UTC(this.fixedEndDate.getUTCFullYear(), this.fixedEndDate.getUTCMonth(), this.fixedEndDate.getUTCDate())) : null;

            if (currentDate.getTime() === today.getTime()) classes += " today";

            let isDisabled = currentDate < today;

            if (normFixedStartDate && currentDate.getTime() === normFixedStartDate.getTime()) {
                classes += " fixed-date start-date selected";
                isDisabled = true;
            } else if (normFixedEndDate && currentDate.getTime() === normFixedEndDate.getTime()) {
                classes += " fixed-date end-date selected";
                isDisabled = true;
            } else {
                if (normTempStartDate && currentDate.getTime() === normTempStartDate.getTime()) classes += " start-date selected";
                if (normTempEndDate && currentDate.getTime() === normTempEndDate.getTime()) classes += " end-date selected";
                if (normTempStartDate && normTempEndDate && currentDate > normTempStartDate && currentDate < normTempEndDate) classes += " in-range";
            }

            if (normFixedStartDate && !this.fixedEndDate && !this.activityDurationDaysFixed) {
                if (currentDate < normFixedStartDate) isDisabled = true;
            } else if (normFixedEndDate && !this.fixedStartDate && !this.activityDurationDaysFixed) {
                if (currentDate > normFixedEndDate) isDisabled = true;
            } else if (this.activityDurationDaysFixed && normTempStartDate) {
                //
            }

            if(isDisabled) classes += " disabled";

            html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }
        return html;
    }

    _addRangeCalendarInternalEventListeners(targetElement) {
        const prevBtn = targetElement.querySelector(".prev-month-range");
        if (prevBtn) {
            prevBtn.addEventListener("click", (e) => {
                e.stopPropagation(); this.currentViewMonth--;
                if (this.currentViewMonth < 0) { this.currentViewMonth = 11; this.currentViewYear--; }
                this._renderCalendar();
            });
        }
        const nextBtn = targetElement.querySelector(".next-month-range");
        if (nextBtn) {
            nextBtn.addEventListener("click", (e) => {
                e.stopPropagation(); this.currentViewMonth++;
                if (this.currentViewMonth > 11) { this.currentViewMonth = 0; this.currentViewYear++; }
                this._renderCalendar();
            });
        }

        targetElement.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                const [year, month, day] = dayElement.dataset.date.split('-').map(Number);
                const clickedDate = new Date(Date.UTC(year, month - 1, day));

                if (this.fixedStartDate && this.fixedEndDate) {
                    return;
                }

                if (this.activityDurationDaysFixed && !this.fixedStartDate && !this.fixedEndDate) {
                    this.tempStartDate = clickedDate;
                    this.tempEndDate = DateTime.fromJSDate(clickedDate).plus({ days: this.activityDurationDaysFixed - 1 }).toJSDate();
                }
                else if (this.fixedStartDate) {
                    if (clickedDate >= this.fixedStartDate) {
                        this.tempEndDate = clickedDate;
                    } else {
                        return;
                    }
                }
                else if (this.fixedEndDate) {
                    if (clickedDate <= this.fixedEndDate) {
                        this.tempStartDate = clickedDate;
                    } else {
                        return;
                    }
                }
                else {
                    if (this.selectingStartDate || clickedDate < this.tempStartDate) {
                        this.tempStartDate = clickedDate;
                        this.tempEndDate = new Date(clickedDate.valueOf());
                        this.selectingStartDate = false;
                    } else {
                        this.tempEndDate = clickedDate;
                        if (this.tempEndDate < this.tempStartDate) {
                            this.tempStartDate = new Date(this.tempEndDate.valueOf());
                        }
                        this.selectingStartDate = true;
                    }
                }
                this._renderCalendar();
            });
        });
    }

    _attachEventListeners() {
        this.modalElement.querySelector('.range-calendar-close-btn').addEventListener('click', () => this.hide());
        this.modalElement.querySelector('.range-calendar-cancel-btn').addEventListener('click', () => this.hide());
        this.modalElement.querySelector('.range-calendar-apply-btn').addEventListener('click', () => this._handleApply());
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.hide();
            }
        });
    }

    _handleApply() {
        if (this.fixedStartDate && this.tempEndDate < this.fixedStartDate) {
            this.tempEndDate = new Date(this.fixedStartDate.valueOf());
        }
        if (this.fixedEndDate && this.tempStartDate > this.fixedEndDate) {
            this.tempStartDate = new Date(this.fixedEndDate.valueOf());
        }
        if (this.tempStartDate && this.tempEndDate && this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        if (this.onRangeSelectCallback) {
            const finalStartDate = this.tempStartDate ? new Date(this.tempStartDate.valueOf()) : new Date();
            const finalEndDate = this.tempEndDate ? new Date(this.tempEndDate.valueOf()) : new Date(finalStartDate.valueOf());
            this.onRangeSelectCallback(finalStartDate, finalEndDate);
        }
        this.hide();
        this.widget.clearMessages();
    }

    show(currentStartDate, currentEndDate) {
        const today = new Date(); today.setUTCHours(0,0,0,0);

        if (this.fixedStartDate) {
            this.tempStartDate = new Date(this.fixedStartDate.valueOf());
        } else if (currentStartDate && !isNaN(new Date(currentStartDate.valueOf()))) {
            this.tempStartDate = new Date(currentStartDate.valueOf());
        } else {
            this.tempStartDate = new Date(today.valueOf());
        }
        this.tempStartDate.setUTCHours(0,0,0,0);

        if (this.fixedEndDate) {
            this.tempEndDate = new Date(this.fixedEndDate.valueOf());
        } else if (this.activityDurationDaysFixed && this.tempStartDate) {
             this.tempEndDate = DateTime.fromJSDate(this.tempStartDate).plus({ days: this.activityDurationDaysFixed - 1 }).toJSDate();
        } else if (currentEndDate && !isNaN(new Date(currentEndDate.valueOf()))) {
            this.tempEndDate = new Date(currentEndDate.valueOf());
        } else {
            this.tempEndDate = this.fixedStartDate
                               ? DateTime.fromJSDate(this.fixedStartDate).plus({ days: (this.activityDurationDaysFixed || 1) -1 }).toJSDate()
                               : new Date(this.tempStartDate.valueOf());
        }
        this.tempEndDate.setUTCHours(0,0,0,0);

        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        if (this.fixedStartDate && !this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = false;
            this.currentViewMonth = this.tempEndDate.getUTCMonth();
            this.currentViewYear = this.tempEndDate.getUTCFullYear();
        } else if (!this.fixedStartDate && this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = true;
            this.currentViewMonth = this.tempStartDate.getUTCMonth();
            this.currentViewYear = this.tempStartDate.getUTCFullYear();
        } else if (this.fixedStartDate && this.fixedEndDate) {
            this.selectingStartDate = false;
            this.currentViewMonth = this.fixedStartDate.getUTCMonth();
            this.currentViewYear = this.fixedStartDate.getUTCFullYear();
        } else if (this.activityDurationDaysFixed) {
            this.selectingStartDate = true;
            this.currentViewMonth = this.tempStartDate.getUTCMonth();
            this.currentViewYear = this.tempStartDate.getUTCFullYear();
        } else {
            this.selectingStartDate = true;
            this.currentViewMonth = this.tempStartDate.getUTCMonth();
            this.currentViewYear = this.tempStartDate.getUTCFullYear();
        }

        this._renderCalendar();
        this.modalOverlay.style.display = 'flex';
    }

    hide() {
        this.modalOverlay.style.display = 'none';
    }
}