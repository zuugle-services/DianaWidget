import {DateTime} from 'luxon';
import {formatDateForDisplay, getMonthName, getShortDayName, throttle} from "../utils";
import {convertToUTCMidnightJSDate, formatDatetime} from "../datetimeUtils";

export class SingleCalendar {
    constructor(inputElement, displayElement, initialDate, widgetInstance, onDateSelectCallback, triggerElement, anchorElement) {
        this.inputElement = inputElement; // Hidden input for date value
        this.displayElement = displayElement; // Span inside "Other Date" button for text
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onDateSelectCallback = onDateSelectCallback;

        // `triggerElement` is the specific element that opens the calendar (e.g., "Other Date" button).
        this.triggerElement = triggerElement;
        // `anchorElement` is the element the calendar is positioned relative to (e.g., the button group).
        this.anchorElement = anchorElement || triggerElement; // Fallback to triggerElement if no separate anchor

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
        this._createCalendarContainer();
        this._attachEventListeners();
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
        this.calendarContainer.className = "diana-container calendar-container"; // Ensure it's styled within widget scope
    }

    _render() {
        if (!this.calendarContainer) return;

        const daysInMonth = new Date(this.currentViewYear, this.currentViewMonth + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(this.currentViewYear, this.currentViewMonth, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1; // Adjust for Monday start

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
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Use UTC for comparison to avoid timezone shifts

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, day));
            const isToday = date.getTime() === new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();

            // Ensure selectedDate is also treated as UTC for comparison
            const selectedDateUTC = this.selectedDate && !isNaN(this.selectedDate.getTime())
                ? new Date(Date.UTC(this.selectedDate.getUTCFullYear(), this.selectedDate.getUTCMonth(), this.selectedDate.getUTCDate()))
                : null;

            const isSelected = selectedDateUTC && date.getTime() === selectedDateUTC.getTime();

            let isDisabled = date < today; // Disable past dates

            html += `<div class="calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}" data-day="${day}">${day}</div>`;
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
            e.preventDefault(); // Prevent form submission if calendar is in a form
            e.stopPropagation();
            this.hide();
        });

        this.calendarContainer.querySelector(".calendar-apply-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._updateInputElement(); // Ensure input value is set with the selected date
            if (this.onDateSelectCallback) {
                // Pass a new Date object to avoid mutations if selectedDate is modified elsewhere
                this.onDateSelectCallback(new Date(this.selectedDate.valueOf()));
            }
            this.hide();
            this.widget.clearMessages(); // Clear any widget messages
        });

        this.calendarContainer.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                // When a day is clicked, update selectedDate to UTC to match internal logic
                this.selectedDate = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, parseInt(dayElement.dataset.day)));
                this._render(); // Re-render to show selection
            });
        });
    }

    _attachEventListeners() {
        if (!this.triggerElement) return;

        this.triggerElement.addEventListener("click", (e) => {
            if (window.matchMedia("(max-width: 768px)").matches) {
                // On mobile, widget.js handles showing the native date picker
                // This listener should not interfere.
                return;
            }
            e.stopPropagation();
            if (this.calendarContainer.classList.contains("active")) {
                this.hide();
            } else {
                // Sync calendar with widget's current date before showing
                const currentDateFromWidget = this.widget.state.selectedDate || new Date();
                this.setSelectedDate(currentDateFromWidget, false); // Update date without triggering callback
                this.show();
            }
        });

        document.addEventListener("click", (e) => {
            if (this.calendarContainer && this.calendarContainer.classList.contains("active")) {
                const isClickInsideCalendar = this.calendarContainer.contains(e.target);
                const isClickOnTrigger = this.triggerElement && this.triggerElement.contains(e.target);
                if (!isClickInsideCalendar && !isClickOnTrigger) {
                    this.hide();
                }
            }
        });

        const throttledReposition = throttle(this._reposition.bind(this), 50);
        let scrollableParent = this.anchorElement ? this.anchorElement.parentElement : null;
        while (scrollableParent) {
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
        // This method is called by widget._updateSingleDayDateButtonStates
        // or when the calendar's "Apply" button is clicked.
        // It updates the text of the "Other Date" button.
        if (this.displayElement && this.displayElement === this.widget.elements?.otherDateText) {
            const localeMap = {EN: 'en-GB', DE: 'de-DE'};
            const locale = localeMap[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB');


            if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                // Use Luxon for consistent timezone handling for display checks
                const todayLocal = DateTime.now().setZone(this.config.timezone).startOf('day');
                const tomorrowLocal = todayLocal.plus({days: 1});
                // Convert selectedDate (which is UTC internally) to the display timezone for comparison
                const selectedDateInDisplayZone = DateTime.fromJSDate(this.selectedDate, {zone: 'utc'}).setZone(this.config.timezone).startOf('day');


                if (!selectedDateInDisplayZone.equals(todayLocal) && !selectedDateInDisplayZone.equals(tomorrowLocal)) {
                    this.displayElement.textContent = formatDateForDisplay(this.selectedDate, locale, this.config.timezone);
                    this.displayElement.classList.remove("placeholder");
                } else {
                    // If it IS today or tomorrow, widget._updateSingleDayDateButtonStates handles the "Other Date" text.
                    // We can ensure it's reset to default if the calendar was showing a different date.
                    // this.displayElement.textContent = this.t('otherDate');
                    // this.displayElement.classList.add("placeholder");
                }
            } else {
                this.displayElement.textContent = this.t('otherDate');
                this.displayElement.classList.add("placeholder");
            }
        }
    }


    _updateInputElement() {
        if (this.inputElement) {
            if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                // formatDatetime expects a JS Date and timezone for formatting to YYYY-MM-DD
                // Since selectedDate is UTC, pass 'utc' or the target display timezone if input should reflect that
                this.inputElement.value = formatDatetime(this.selectedDate, 'utc'); // Store as YYYY-MM-DD in UTC
            } else {
                this.inputElement.value = '';
            }
        }
    }

    _reposition() {
        if (!this.calendarContainer || !this.anchorElement || !this.calendarContainer.classList.contains('active')) {
            return;
        }
        const anchorRect = this.anchorElement.getBoundingClientRect();
        const desiredCalendarWidth = Math.max(280, anchorRect.width); // Ensure minimum width
        this.calendarContainer.style.width = `${desiredCalendarWidth}px`;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const gap = 5; // Gap between anchor and calendar

        // Position below the anchor element
        let finalTop = anchorRect.bottom + scrollTop + gap;
        let finalLeft = anchorRect.left + scrollLeft;

        // Adjust if it goes off-screen
        const calendarHeight = this.calendarContainer.offsetHeight;
        const calendarWidth = this.calendarContainer.offsetWidth; // Use actual width after setting it

        if (finalTop + calendarHeight > window.innerHeight + scrollTop) { // Off bottom
            finalTop = anchorRect.top + scrollTop - calendarHeight - gap; // Position above
        }
        if (finalLeft + calendarWidth > window.innerWidth + scrollLeft) { // Off right
            finalLeft = window.innerWidth + scrollLeft - calendarWidth - gap;
        }
        if (finalLeft < scrollLeft + gap) { // Off left
            finalLeft = scrollLeft + gap;
        }


        this.calendarContainer.style.top = `${finalTop}px`;
        this.calendarContainer.style.left = `${finalLeft}px`;
    }

    show() {
        if (!this.calendarContainer) return;

        // Ensure current view is based on the selectedDate (which is UTC)
        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        } else { // Default to current month/year in UTC if no date selected
            const now = new Date();
            this.currentViewMonth = now.getUTCMonth();
            this.currentViewYear = now.getUTCFullYear();
        }
        this._render();
        this.calendarContainer.style.display = 'block';
        this.calendarContainer.classList.add("active");
        this._reposition(); // Reposition after display block to get correct dimensions
    }

    hide() {
        if (!this.calendarContainer) return;
        this.calendarContainer.style.display = 'none';
        this.calendarContainer.classList.remove("active");
    }

    setSelectedDate(date, triggerCallback = true) {
        // Ensure the date is treated as UTC internally for consistency
        this.selectedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        if (!isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        }
        this._updateInputElement();
        // _updateDisplayElement is typically called by the widget's logic (_updateSingleDayDateButtonStates)
        // or by the calendar's apply button. If called programmatically, the widget should handle display update.

        if (this.calendarContainer && this.calendarContainer.classList.contains("active")) {
            this._render(); // Re-render if visible to reflect new date
        }

        // This callback is primarily for when the calendar's "Apply" button is used.
        // Programmatic changes from widget (e.g., Today/Tomorrow buttons) usually don't need to re-trigger this,
        // as the widget itself is initiating the change.
        if (triggerCallback && this.onDateSelectCallback) {
            this.onDateSelectCallback(new Date(this.selectedDate.valueOf())); // Pass a copy
        }
    }
}

export class RangeCalendarModal {
    constructor(initialStartDate, initialEndDate, widgetInstance, onRangeSelectCallback, overrideStartDateStr, overrideEndDateStr, activityDurationDaysFixed) {
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onRangeSelectCallback = onRangeSelectCallback;
        this.activityDurationDaysFixed = activityDurationDaysFixed ? parseInt(activityDurationDaysFixed, 10) : null;

        this.fixedStartDate = overrideStartDateStr ? DateTime.fromISO(overrideStartDateStr, {zone: 'utc'}).startOf('day').toJSDate() : null;
        if (this.fixedStartDate && isNaN(this.fixedStartDate.getTime())) this.fixedStartDate = null;

        this.fixedEndDate = overrideEndDateStr ? DateTime.fromISO(overrideEndDateStr, {zone: 'utc'}).startOf('day').toJSDate() : null;
        if (this.fixedEndDate && isNaN(this.fixedEndDate.getTime())) this.fixedEndDate = null;

        const todayInWidgetZone = DateTime.now().setZone(this.config.timezone);

        if (this.fixedStartDate) {
            this.tempStartDate = new Date(this.fixedStartDate.valueOf());
        } else {
            this.tempStartDate = convertToUTCMidnightJSDate(initialStartDate, todayInWidgetZone, this.config.timezone);
        }

        if (this.fixedEndDate) {
            this.tempEndDate = new Date(this.fixedEndDate.valueOf());
        } else if (this.activityDurationDaysFixed && this.tempStartDate) {
            this.tempEndDate = DateTime.fromJSDate(this.tempStartDate, {zone: 'utc'})
                .plus({days: this.activityDurationDaysFixed - 1})
                .startOf('day') // Ensure it's start of day
                .toJSDate();
        } else {
            const fallbackEndDateBase = this.tempStartDate ? DateTime.fromJSDate(this.tempStartDate, {zone: 'utc'}) : todayInWidgetZone;
            this.tempEndDate = convertToUTCMidnightJSDate(initialEndDate, fallbackEndDateBase, this.config.timezone);
        }

        // Ensure tempEndDate is not before tempStartDate
        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }
        if (this.fixedStartDate && this.fixedEndDate && this.fixedStartDate > this.fixedEndDate) {
            this.fixedEndDate = null;
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        this.currentViewMonth = this.tempStartDate.getUTCMonth();
        this.currentViewYear = this.tempStartDate.getUTCFullYear();

        // Determine initial selection mode
        if (this.fixedStartDate && !this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = false; // Selecting end date
        } else if (!this.fixedStartDate && this.fixedEndDate && !this.activityDurationDaysFixed) {
            this.selectingStartDate = true; // Selecting start date
        } else if (this.fixedStartDate && this.fixedEndDate) {
            this.selectingStartDate = false; // Both fixed, no selection
        } else if (this.activityDurationDaysFixed) {
            this.selectingStartDate = true; // Selecting start date, end date is derived
        } else {
            this.selectingStartDate = true; // Default: selecting start date first
        }

        this.modalOverlay = null;
        this.modalElement = null;
        this.calendarInstance = null;

        this._initDOM();
        this._attachEventListeners();
    }

    _initDOM() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'range-calendar-overlay diana-container'; // Add diana-container for scoping

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'range-calendar-modal';
        this.modalElement.innerHTML = `
            <div class="range-calendar-header">
                <h3>${this.t('selectDateRange')}</h3>
                <button type="button" class="range-calendar-close-btn" aria-label="${this.t('cancel')}">&times;</button>
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
        // Append to the widget's main container to ensure it's within the widget's scope
        this.widget.dianaWidgetRootContainer.appendChild(this.modalOverlay);


        this.calendarInstance = this.modalElement.querySelector('.range-calendar-instance');
        this._renderCalendar();
    }

    _renderCalendar() {
        this._renderMonth(this.currentViewYear, this.currentViewMonth, this.calendarInstance);
    }

    _renderMonth(year, month, targetElement) {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); // Use UTC functions
        let firstDayOfMonthIndex = new Date(Date.UTC(year, month, 1)).getUTCDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1; // Monday start

        targetElement.innerHTML = `
            <div class="calendar-nav">
                <button type="button" class="calendar-nav-btn prev-month-range" aria-label="${this.t('ariaLabels.previousMonthButton')}">&#9664;</button>
                <div class="calendar-month-year">${getMonthName(month, this.t)} ${year}</div>
                <button type="button" class="calendar-nav-btn next-month-range" aria-label="${this.t('ariaLabels.nextMonthButton')}">&#9654;</button>
            </div>
            <div class="calendar-grid">
                ${[0, 1, 2, 3, 4, 5, 6].map(d => `<div class="calendar-day-header">${getShortDayName(d, this.t)}</div>`).join('')}
                ${this._generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month)}
            </div>`;
        this._addRangeCalendarInternalEventListeners(targetElement);
    }

    _generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month) {
        let html = "";
        const todayUTC = DateTime.now().setZone('utc').startOf('day').toJSDate();

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }

        const normTempStartDate = this.tempStartDate;
        const normTempEndDate = this.tempEndDate;
        const normFixedStartDate = this.fixedStartDate;
        const normFixedEndDate = this.fixedEndDate;


        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day)); // This creates a UTC midnight JS Date
            let classes = "calendar-day";

            if (currentDate.getTime() === todayUTC.getTime()) classes += " today";

            let isDisabled = currentDate < todayUTC; // Disable past dates by default

            // Apply fixed date styling and disabled state
            if (normFixedStartDate && currentDate.getTime() === normFixedStartDate.getTime()) {
                classes += " fixed-date start-date selected";
                isDisabled = true;
            } else if (normFixedEndDate && currentDate.getTime() === normFixedEndDate.getTime()) {
                classes += " fixed-date end-date selected";
                isDisabled = true;
            } else {
                // Apply selection styling for temporary dates
                if (normTempStartDate && currentDate.getTime() === normTempStartDate.getTime()) classes += " start-date selected";
                if (normTempEndDate && currentDate.getTime() === normTempEndDate.getTime()) classes += " end-date selected";
                if (normTempStartDate && normTempEndDate && currentDate > normTempStartDate && currentDate < normTempEndDate) classes += " in-range";
            }

            // Additional disabling logic based on fixed dates
            if (normFixedStartDate && !this.fixedEndDate && !this.activityDurationDaysFixed) {
                if (currentDate < normFixedStartDate) isDisabled = true;
            } else if (normFixedEndDate && !this.fixedStartDate && !this.activityDurationDaysFixed) {
                if (currentDate > normFixedEndDate) isDisabled = true;
            }

            if (isDisabled) classes += " disabled";

            html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }
        return html;
    }

    _addRangeCalendarInternalEventListeners(targetElement) {
        const prevBtn = targetElement.querySelector(".prev-month-range");
        if (prevBtn) {
            prevBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.currentViewMonth--;
                if (this.currentViewMonth < 0) {
                    this.currentViewMonth = 11;
                    this.currentViewYear--;
                }
                this._renderCalendar();
            });
        }
        const nextBtn = targetElement.querySelector(".next-month-range");
        if (nextBtn) {
            nextBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.currentViewMonth++;
                if (this.currentViewMonth > 11) {
                    this.currentViewMonth = 0;
                    this.currentViewYear++;
                }
                this._renderCalendar();
            });
        }

        targetElement.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                const [year, monthIdx, day] = dayElement.dataset.date.split('-').map(Number);
                const clickedDate = new Date(Date.UTC(year, monthIdx - 1, day));

                if (this.fixedStartDate && this.fixedEndDate) {
                    return; // Both dates are fixed, no selection possible
                }

                if (this.activityDurationDaysFixed) {
                    // If duration is fixed, clicking a date sets the start date, and end date is derived.
                    // This applies unless one of the dates is already fixed by override.
                    if (!this.fixedStartDate && !this.fixedEndDate) {
                        this.tempStartDate = clickedDate;
                        this.tempEndDate = DateTime.fromJSDate(clickedDate, {zone: 'utc'}).plus({days: this.activityDurationDaysFixed - 1}).toJSDate();
                    } else if (this.fixedStartDate && !this.fixedEndDate) { // Start is fixed, duration sets end
                        // This scenario implies the duration is already accounted for by fixedStartDate + activityDurationDaysFixed
                        // So, no user selection should change this.
                        // However, if we allow picking an end date that respects duration:
                        // this.tempEndDate = clickedDate;
                        // if (DateTime.fromJSDate(clickedDate).diff(DateTime.fromJSDate(this.fixedStartDate), 'days').days + 1 !== this.activityDurationDaysFixed) {
                        // Potentially show error or adjust. For now, assume fixed duration means start date selection only if start isn't fixed.
                        // }
                        return; // Or handle specific logic if start is fixed and duration is fixed.
                    } else if (!this.fixedStartDate && this.fixedEndDate) { // End is fixed, duration sets start
                        // Similar to above, if end is fixed and duration is fixed, start is determined.
                        return;
                    }
                } else if (this.fixedStartDate) { // Start is fixed, selecting end date
                    if (clickedDate >= this.fixedStartDate) {
                        this.tempEndDate = clickedDate;
                    } else {
                        return; // Clicked date is before fixed start date
                    }
                } else if (this.fixedEndDate) { // End is fixed, selecting start date
                    if (clickedDate <= this.fixedEndDate) {
                        this.tempStartDate = clickedDate;
                    } else {
                        return; // Clicked date is after fixed end date
                    }
                } else { // No fixed dates, standard range selection
                    if (this.selectingStartDate || clickedDate < this.tempStartDate) {
                        this.tempStartDate = clickedDate;
                        this.tempEndDate = new Date(clickedDate.valueOf()); // Reset end date
                        this.selectingStartDate = false; // Next click selects end date
                    } else {
                        this.tempEndDate = clickedDate;
                        if (this.tempEndDate < this.tempStartDate) { // Should not happen if logic is correct
                            this.tempStartDate = new Date(this.tempEndDate.valueOf());
                        }
                        this.selectingStartDate = true; // Next click selects start date again
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
            if (e.target === this.modalOverlay) { // Click on overlay itself, not content
                this.hide();
            }
        });
    }

    _handleApply() {
        // Ensure date validity before applying
        if (this.fixedStartDate && this.tempEndDate < this.fixedStartDate) {
            this.tempEndDate = new Date(this.fixedStartDate.valueOf()); // Or show error
        }
        if (this.fixedEndDate && this.tempStartDate > this.fixedEndDate) {
            this.tempStartDate = new Date(this.fixedEndDate.valueOf()); // Or show error
        }
        if (this.tempStartDate && this.tempEndDate && this.tempEndDate < this.tempStartDate) {
            // If end date is somehow before start date, make them the same or show error
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }


        if (this.onRangeSelectCallback) {
            const finalStartDate = this.tempStartDate ? new Date(this.tempStartDate.valueOf()) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())); // Fallback to today UTC
            const finalEndDate = this.tempEndDate ? new Date(this.tempEndDate.valueOf()) : new Date(finalStartDate.valueOf());
            this.onRangeSelectCallback(finalStartDate, finalEndDate);
        }
        this.hide();
        this.widget.clearMessages();
    }

    show(currentStartDate, currentEndDate) {
        const todayInWidgetZone = DateTime.now().setZone(this.config.timezone);

        if (this.fixedStartDate) {
            this.tempStartDate = new Date(this.fixedStartDate.valueOf());
        } else {
            this.tempStartDate = convertToUTCMidnightJSDate(currentStartDate, todayInWidgetZone, this.config.timezone);
        }

        if (this.fixedEndDate) {
            this.tempEndDate = new Date(this.fixedEndDate.valueOf());
        } else if (this.activityDurationDaysFixed && this.tempStartDate) {
            this.tempEndDate = DateTime.fromJSDate(this.tempStartDate, {zone: 'utc'})
                .plus({days: this.activityDurationDaysFixed - 1})
                .startOf('day')
                .toJSDate();
        } else {
            const fallbackEndDateBase = this.tempStartDate ? DateTime.fromJSDate(this.tempStartDate, {zone: 'utc'}) : todayInWidgetZone;
            this.tempEndDate = convertToUTCMidnightJSDate(currentEndDate, fallbackEndDateBase, this.config.timezone);
        }

        // Ensure tempEndDate is not before tempStartDate
        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        // Determine current view and selection mode (this logic should now be more reliable)
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
            this.selectingStartDate = !this.fixedStartDate; // Only allow start date selection if start isn't fixed
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
        if (this.modalOverlay) {
            this.modalOverlay.style.display = 'none';
        }
    }
}

