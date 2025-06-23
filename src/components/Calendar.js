import {DateTime} from 'luxon';
import {formatDateForDisplay, getMonthName, getShortDayName, throttle} from "../utils";
import {convertToUTCMidnightJSDate, formatDatetime} from "../datetimeUtils";
import { getSingleCalendarHTML } from '../templates/singleCalendarTemplate.js';
import { getRangeCalendarModalHTML } from '../templates/rangeCalendarModalTemplate.js';

export class SingleCalendar {
    constructor(inputElement, displayElement, initialDate, widgetInstance, onDateSelectCallback, triggerElement, anchorElement, styles) {
        this.inputElement = inputElement; // Hidden input for date value
        this.displayElement = displayElement; // Span inside "Other Date" button for text
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onDateSelectCallback = onDateSelectCallback;
        this.styles = styles;

        this.triggerElement = triggerElement;
        this.anchorElement = anchorElement || triggerElement;

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
        this.shadowRoot = null;
        this.calendarContentWrapper = null;
        this._init();
    }

    _init() {
        this._createCalendarContainer();
        this._attachEventListeners();
        this._updateInputElement();
        this._updateDisplayElement();
        this._applyTheming();
    }

    _applyTheming() {
        const themableProperties = [
            '--primary-color', '--secondary-color', '--success-color', '--warning-color', '--error-color',
            '--wait-color', '--text-primary', '--text-secondary', '--text-tertiary', '--text-muted',
            '--text-disabled', '--text-error', '--text-info', '--text-warning', '--icon-input-color',
            '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover', '--bg-error', '--bg-info',
            '--bg-transparent', '--bg-waiting-block', '--border-primary', '--border-secondary',
            '--border-tertiary', '--border-error', '--border-info', '--shadow-verylight', '--shadow-light',
            '--shadow-medium', '--shadow-dark', '--shadow-gray'
        ];

        if (!this.widget.container || !this.calendarContentWrapper) {
            return;
        }

        const hostStyles = getComputedStyle(this.widget.container);

        themableProperties.forEach(prop => {
            const value = hostStyles.getPropertyValue(prop).trim();
            if (value) {
                this.calendarContentWrapper.style.setProperty(prop, value);
            }
        });
    }

    _createCalendarContainer() {
        const calendarContainerId = `dianaSingleCalendarFor_${this.widget.container.id}`;

        let existingContainer = document.getElementById(calendarContainerId);
        if (existingContainer) existingContainer.remove();

        this.calendarContainer = document.createElement("div");
        this.calendarContainer.id = calendarContainerId;

        this.calendarContainer.style.position = 'absolute';
        this.calendarContainer.style.zIndex = '1050';
        this.calendarContainer.style.display = 'none';

        document.body.appendChild(this.calendarContainer);

        this.shadowRoot = this.calendarContainer.attachShadow({ mode: 'open' });

        const styleTag = document.createElement('style');
        styleTag.textContent = this.styles;
        this.shadowRoot.appendChild(styleTag);

        this.calendarContentWrapper = document.createElement('div');
        this.calendarContentWrapper.className = 'diana-container calendar-container';
        this.shadowRoot.appendChild(this.calendarContentWrapper);
    }

    _render() {
        if (!this.calendarContentWrapper) return;

        const daysInMonth = new Date(this.currentViewYear, this.currentViewMonth + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(this.currentViewYear, this.currentViewMonth, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1;
        const daysHTML = this._generateDaysHTML(daysInMonth, firstDayOfMonthIndex);

        this.calendarContentWrapper.innerHTML = getSingleCalendarHTML({
            t: this.t,
            currentViewMonth: this.currentViewMonth,
            currentViewYear: this.currentViewYear,
            daysHTML
        });

        this._addCalendarInternalEventListeners();
    }

    _generateDaysHTML(daysInMonth, firstDayOfMonthIndex) {
        let html = "";
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, day));
            const isToday = date.getTime() === new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();

            const selectedDateUTC = this.selectedDate && !isNaN(this.selectedDate.getTime())
                ? new Date(Date.UTC(this.selectedDate.getUTCFullYear(), this.selectedDate.getUTCMonth(), this.selectedDate.getUTCDate()))
                : null;

            const isSelected = selectedDateUTC && date.getTime() === selectedDateUTC.getTime();
            let isDisabled = date < today;

            html += `<div class="calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}" data-day="${day}">${day}</div>`;
        }
        return html;
    }

    _addCalendarInternalEventListeners() {
        this.shadowRoot.querySelector(".prev-month").addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentViewMonth--;
            if (this.currentViewMonth < 0) {
                this.currentViewMonth = 11;
                this.currentViewYear--;
            }
            this._render();
        });

        this.shadowRoot.querySelector(".next-month").addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentViewMonth++;
            if (this.currentViewMonth > 11) {
                this.currentViewMonth = 0;
                this.currentViewYear++;
            }
            this._render();
        });

        this.shadowRoot.querySelector(".calendar-cancel-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        });

        this.shadowRoot.querySelector(".calendar-apply-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._updateInputElement();
            if (this.onDateSelectCallback) {
                this.onDateSelectCallback(new Date(this.selectedDate.valueOf()));
            }
            this.hide();
            this.widget.clearMessages();
        });

        this.shadowRoot.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectedDate = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, parseInt(dayElement.dataset.day)));
                this._render();
            });
        });
    }

    _attachEventListeners() {
        if (!this.triggerElement) return;

        this.triggerElement.addEventListener("click", (e) => {
            if (window.matchMedia("(max-width: 768px)").matches) {
                return;
            }
            e.stopPropagation();
            if (this.calendarContainer.style.display !== 'none') {
                this.hide();
            } else {
                const currentDateFromWidget = this.widget.state.selectedDate || new Date();
                this.setSelectedDate(currentDateFromWidget, false);
                this.show();
            }
        });

        document.addEventListener("click", (e) => {
            if (this.calendarContainer && this.calendarContainer.style.display !== 'none') {
                const path = e.composedPath();
                const isClickInsideCalendar = path.includes(this.calendarContainer);
                const isClickOnTrigger = this.triggerElement && path.includes(this.triggerElement);

                if (!isClickInsideCalendar && !isClickOnTrigger) {
                    this.hide();
                }
            }
        });

        const throttledReposition = throttle(this._reposition.bind(this), 50);
        window.addEventListener('scroll', throttledReposition, true);
        window.addEventListener('resize', throttledReposition);
    }

    _updateDisplayElement() {
        if (this.displayElement && this.displayElement === this.widget.elements?.otherDateText) {
            const localeMap = {EN: 'en-GB', DE: 'de-DE'};
            const locale = localeMap[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB');

            if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                const todayLocal = DateTime.now().setZone(this.config.timezone).startOf('day');
                const tomorrowLocal = todayLocal.plus({days: 1});
                const selectedDateInDisplayZone = DateTime.fromJSDate(this.selectedDate, {zone: 'utc'}).setZone(this.config.timezone).startOf('day');

                if (!selectedDateInDisplayZone.equals(todayLocal) && !selectedDateInDisplayZone.equals(tomorrowLocal)) {
                    this.displayElement.textContent = formatDateForDisplay(this.selectedDate, locale, this.config.timezone);
                    this.displayElement.classList.remove("placeholder");
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
                this.inputElement.value = formatDatetime(this.selectedDate, 'utc');
            } else {
                this.inputElement.value = '';
            }
        }
    }

    _reposition() {
        if (!this.calendarContainer || !this.anchorElement || this.calendarContainer.style.display === 'none') {
            return;
        }
        const anchorRect = this.anchorElement.getBoundingClientRect();
        const desiredCalendarWidth = Math.max(280, anchorRect.width); // Ensure minimum width
        this.calendarContentWrapper.style.width = `${desiredCalendarWidth}px`;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const gap = 5; // Gap between anchor and calendar

        // Position below the anchor element
        let finalTop = anchorRect.bottom + scrollTop + gap;
        let finalLeft = anchorRect.left + scrollLeft;

        // Adjust if it goes off-screen
        const calendarHeight = this.calendarContainer.offsetHeight;
        const calendarWidth = this.calendarContainer.offsetWidth;

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

        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        } else {
            const now = new Date();
            this.currentViewMonth = now.getUTCMonth();
            this.currentViewYear = now.getUTCFullYear();
        }
        this._render();
        this.calendarContainer.style.display = 'block';
        this._reposition();
    }

    hide() {
        if (!this.calendarContainer) return;
        this.calendarContainer.style.display = 'none';
    }

    setSelectedDate(date, triggerCallback = true) {
        this.selectedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        if (!isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        }
        this._updateInputElement();

        if (this.calendarContainer && this.calendarContainer.style.display !== 'none') {
            this._render();
        }

        if (triggerCallback && this.onDateSelectCallback) {
            this.onDateSelectCallback(new Date(this.selectedDate.valueOf()));
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
                .startOf('day')
                .toJSDate();
        } else {
            const fallbackEndDateBase = this.tempStartDate ? DateTime.fromJSDate(this.tempStartDate, {zone: 'utc'}) : todayInWidgetZone;
            this.tempEndDate = convertToUTCMidnightJSDate(initialEndDate, fallbackEndDateBase, this.config.timezone);
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
        this.modalOverlay.className = 'range-calendar-overlay diana-container';

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'range-calendar-modal';
        this.modalElement.innerHTML = getRangeCalendarModalHTML({ t: this.t });

        this.modalOverlay.appendChild(this.modalElement);
        this.widget.dianaWidgetRootContainer.appendChild(this.modalOverlay);

        this.calendarInstance = this.modalElement.querySelector('.range-calendar-instance');
        this._renderCalendar();
    }

    _renderCalendar() {
        this._renderMonth(this.currentViewYear, this.currentViewMonth, this.calendarInstance);
    }

    _renderMonth(year, month, targetElement) {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        let firstDayOfMonthIndex = new Date(Date.UTC(year, month, 1)).getUTCDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1;

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
            const currentDate = new Date(Date.UTC(year, month, day));
            let classes = "calendar-day";

            if (currentDate.getTime() === todayUTC.getTime()) classes += " today";

            let isDisabled = currentDate < todayUTC;

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
                    return;
                }

                if (this.activityDurationDaysFixed) {
                    if (!this.fixedStartDate && !this.fixedEndDate) {
                        this.tempStartDate = clickedDate;
                        this.tempEndDate = DateTime.fromJSDate(clickedDate, {zone: 'utc'}).plus({days: this.activityDurationDaysFixed - 1}).toJSDate();
                    } else {
                        return;
                    }
                } else if (this.fixedStartDate) {
                    if (clickedDate >= this.fixedStartDate) {
                        this.tempEndDate = clickedDate;
                    } else {
                        return;
                    }
                } else if (this.fixedEndDate) {
                    if (clickedDate <= this.fixedEndDate) {
                        this.tempStartDate = clickedDate;
                    } else {
                        return;
                    }
                } else {
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
            const finalStartDate = this.tempStartDate ? new Date(this.tempStartDate.valueOf()) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
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
            this.selectingStartDate = !this.fixedStartDate;
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