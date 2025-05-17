import { DateTime } from 'luxon';
import { getMonthName, getShortDayName, throttle, formatDateForDisplay } from "../utils";

export class SingleCalendar {
    constructor(inputElement, displayElement, initialDate, widgetInstance, onDateSelectCallback) {
        this.inputElement = inputElement; // The hidden input type="date"
        this.displayElement = displayElement; // The span showing the formatted date
        this.dateInputContainer = this.inputElement.closest('.date-input-container');
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onDateSelectCallback = onDateSelectCallback;

        this.selectedDate = initialDate ? new Date(initialDate.valueOf()) : new Date();
        this.currentViewMonth = this.selectedDate.getMonth();
        this.currentViewYear = this.selectedDate.getFullYear();

        this.calendarContainer = null;
        this._init();
    }

    _init() {
        if (window.matchMedia("(max-width: 768px)").matches) {
            // Mobile: Use native date input
            this.inputElement.style.display = 'block';
            if (this.displayElement.closest('.date-input')) {
                 this.displayElement.closest('.date-input').style.display = 'none';
            }
            this.inputElement.addEventListener("change", (e) => {
                const [year, month, day] = e.target.value.split('-').map(Number);
                const newSelectedDate = new Date(Date.UTC(year, month - 1, day));
                this.selectedDate = newSelectedDate;
                this._updateInputElement();
                this._updateDisplayElement();
                if (this.onDateSelectCallback) {
                    this.onDateSelectCallback(newSelectedDate);
                }
                this.widget.clearMessages();
            });
            this._updateInputElement();
            this._updateDisplayElement();
            return;
        }

        // Desktop: Custom Calendar
        this._createCalendarContainer();
        this._attachEventListeners();
        this._updateInputElement(); // Ensure hidden input has initial value
        this._updateDisplayElement(); // Ensure display span has initial value
    }

    _createCalendarContainer() {
        const calendarContainerId = `calendarContainer_${this.inputElement.id || Date.now()}`;
        this.calendarContainer = document.getElementById(calendarContainerId);
        if (!this.calendarContainer) {
            this.calendarContainer = document.createElement("div");
            this.calendarContainer.id = calendarContainerId;
            // Added diana-container class for consistent styling context
            this.calendarContainer.className = "diana-container calendar-container"; // Existing class for dropdown
            document.body.appendChild(this.calendarContainer);
        }
    }

    _render() {
        if (!this.calendarContainer || window.matchMedia("(max-width: 768px)").matches) return;

        const daysInMonth = new Date(this.currentViewYear, this.currentViewMonth + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(this.currentViewYear, this.currentViewMonth, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1; // Adjust to Mon=0, Sun=6

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
        today.setHours(0, 0, 0, 0); // Normalize today for comparison

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, day));
            const isToday = date.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(); // Compare UTC dates
            const isSelected = this.selectedDate && date.getTime() === new Date(Date.UTC(this.selectedDate.getUTCFullYear(), this.selectedDate.getUTCMonth(), this.selectedDate.getUTCDate())).getTime();

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
            // selectedDate is already updated by day click, so just apply
            this._updateInputElement();
            this._updateDisplayElement();
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
                this._render(); // Re-render to show selection
            });
        });
    }

    _attachEventListeners() {
        if (!this.dateInputContainer || window.matchMedia("(max-width: 768px)").matches) return;

        this.dateInputContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.calendarContainer.classList.contains("active")) {
                this.hide();
            } else {
                this.show();
            }
        });

        document.addEventListener("click", (e) => {
            if (this.calendarContainer && this.calendarContainer.classList.contains("active") &&
                !this.dateInputContainer.contains(e.target) &&
                !this.calendarContainer.contains(e.target)) {
                this.hide();
            }
        });

        const throttledReposition = throttle(this._reposition.bind(this), 100);
        window.addEventListener('scroll', () => { if (this.calendarContainer && this.calendarContainer.classList.contains('active')) throttledReposition(); }, true);
        window.addEventListener('resize', () => { if (this.calendarContainer && this.calendarContainer.classList.contains('active')) throttledReposition(); });
    }

    _updateDisplayElement() {
        const localeMap = { EN: 'en-GB', DE: 'de-DE' };
        const locale = localeMap[this.config.language] || 'en-GB';
        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.displayElement.textContent = formatDateForDisplay(this.selectedDate, locale, 'UTC');
            this.displayElement.classList.remove("placeholder");
        } else {
            this.displayElement.textContent = this.t('selectDate');
            this.displayElement.classList.add("placeholder");
        }
    }

    _updateInputElement() {
        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
             // Format as YYYY-MM-DD for the input type="date"
            const year = this.selectedDate.getUTCFullYear();
            const month = String(this.selectedDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(this.selectedDate.getUTCDate()).padStart(2, '0');
            this.inputElement.value = `${year}-${month}-${day}`;
        } else {
            this.inputElement.value = '';
        }
    }

    _reposition() {
        if (!this.calendarContainer || !this.dateInputContainer || !this.calendarContainer.classList.contains('active')) {
            return;
        }
        const rect = this.dateInputContainer.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        this.calendarContainer.style.top = `${rect.bottom + scrollTop + 5}px`;
        this.calendarContainer.style.left = `${rect.left + scrollLeft}px`;
        this.calendarContainer.style.width = `${rect.width}px`;
    }

    show() {
        if (window.matchMedia("(max-width: 768px)").matches) return;

        // Reset view to currently selected date
        this.currentViewMonth = this.selectedDate.getMonth();
        this.currentViewYear = this.selectedDate.getFullYear();

        this._render();
        this.calendarContainer.classList.add("active");
        this._reposition(); // Position it correctly
    }

    hide() {
        if (window.matchMedia("(max-width: 768px)").matches) return;
        this.calendarContainer.classList.remove("active");
    }

    setSelectedDate(date) {
        this.selectedDate = new Date(date.valueOf());
        this.currentViewMonth = this.selectedDate.getMonth();
        this.currentViewYear = this.selectedDate.getFullYear();
        this._updateInputElement();
        this._updateDisplayElement();
        if (this.calendarContainer && this.calendarContainer.classList.contains("active")) {
            this._render(); // Re-render if visible
        }
    }
}

export class RangeCalendarModal {
    constructor(initialStartDate, initialEndDate, widgetInstance, onRangeSelectCallback) {
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onRangeSelectCallback = onRangeSelectCallback;

        this.tempStartDate = initialStartDate ? new Date(initialStartDate.valueOf()) : new Date();
        this.tempEndDate = initialEndDate ? new Date(initialEndDate.valueOf()) : (initialStartDate ? new Date(initialStartDate.valueOf()) : new Date());

        // Ensure end date is not before start date
        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        this.currentViewMonthLeft = this.tempStartDate.getMonth();
        this.currentViewYearLeft = this.tempStartDate.getFullYear();

        let rightCalendarDate = new Date(this.currentViewYearLeft, this.currentViewMonthLeft + 1, 1);
        this.currentViewMonthRight = rightCalendarDate.getMonth();
        this.currentViewYearRight = rightCalendarDate.getFullYear();

        this.selectingStartDate = true; // True if next click sets start date, false for end date

        this.modalOverlay = null;
        this.modalElement = null;
        this.calendarLeftInstance = null;
        this.calendarRightInstance = null;

        this._initDOM();
        this._attachEventListeners();
    }

    _initDOM() {
        // Create overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'range-calendar-overlay';

        // Create modal
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'diana-container range-calendar-modal';
        this.modalElement.innerHTML = `
            <div class="range-calendar-header">
                <h3>${this.t('selectDateRange')}</h3> 
                <button type="button" class="range-calendar-close-btn">&times;</button>
            </div>
            <div class="range-calendar-body">
                <div class="range-calendar-instance" id="rangeCalendarLeft"></div>
                <div class="range-calendar-instance" id="rangeCalendarRight"></div>
            </div>
            <div class="range-calendar-footer">
                <button type="button" class="calendar-footer-btn range-calendar-cancel-btn">${this.t("cancel")}</button>
                <button type="button" class="calendar-footer-btn calendar-apply-btn range-calendar-apply-btn">${this.t("apply")}</button>
            </div>
        `; // Assuming selectDateRange is a new translation key

        this.modalOverlay.appendChild(this.modalElement);
        document.body.appendChild(this.modalOverlay);

        this.calendarLeftInstance = this.modalElement.querySelector('#rangeCalendarLeft');
        this.calendarRightInstance = this.modalElement.querySelector('#rangeCalendarRight');

        this._renderCalendars();
    }

    _renderCalendars() {
        this._renderMonth(this.currentViewYearLeft, this.currentViewMonthLeft, this.calendarLeftInstance, 'left');
        this._renderMonth(this.currentViewYearRight, this.currentViewMonthRight, this.calendarRightInstance, 'right');
    }

    _renderMonth(year, month, targetElement, side) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let firstDayOfMonthIndex = new Date(year, month, 1).getDay();
        firstDayOfMonthIndex = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1;

        let prevMonthLabel = side === 'left' ? this.t('ariaLabels.previousMonthButton') : '';
        let nextMonthLabel = side === 'right' ? this.t('ariaLabels.nextMonthButton') : '';

        targetElement.innerHTML = `
            <div class="calendar-nav">
                ${side === 'left' ? `<button type="button" class="calendar-nav-btn prev-month-range" aria-label="${prevMonthLabel}">&#9664;</button>` : '<div></div>'}
                <div class="calendar-month-year">${getMonthName(month, this.t)} ${year}</div>
                ${side === 'right' ? `<button type="button" class="calendar-nav-btn next-month-range" aria-label="${nextMonthLabel}">&#9654;</button>` : '<div></div>'}
            </div>
            <div class="calendar-grid">
                ${[0, 1, 2, 3, 4, 5, 6].map(day => `<div class="calendar-day-header">${getShortDayName(day, this.t)}</div>`).join('')}
                ${this._generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month)}
            </div>
        `;
        this._addRangeCalendarInternalEventListeners(targetElement, side);
    }

    _generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month) {
        let html = "";
        const today = new Date(); today.setHours(0,0,0,0);

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));
            const currentDateLocalMidnight = new Date(year, month, day);


            let classes = "calendar-day";
            if (currentDateLocalMidnight.getTime() === today.getTime()) classes += " today";

            // Normalize tempStartDate and tempEndDate to UTC midnight for comparison
            const normTempStartDate = this.tempStartDate ? new Date(Date.UTC(this.tempStartDate.getUTCFullYear(), this.tempStartDate.getUTCMonth(), this.tempStartDate.getUTCDate())) : null;
            const normTempEndDate = this.tempEndDate ? new Date(Date.UTC(this.tempEndDate.getUTCFullYear(), this.tempEndDate.getUTCMonth(), this.tempEndDate.getUTCDate())) : null;

            if (normTempStartDate && currentDate.getTime() === normTempStartDate.getTime()) classes += " start-date selected";
            if (normTempEndDate && currentDate.getTime() === normTempEndDate.getTime()) classes += " end-date selected";
            if (normTempStartDate && normTempEndDate && currentDate > normTempStartDate && currentDate < normTempEndDate) classes += " in-range";

            // Disable past dates
            if (currentDateLocalMidnight < today && currentDate.getTime() !== today.getTime()) classes += " disabled";


            html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }
        return html;
    }

    _addRangeCalendarInternalEventListeners(targetElement, side) {
         if (side === 'left') {
            const prevBtn = targetElement.querySelector(".prev-month-range");
            if (prevBtn) {
                prevBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.currentViewMonthLeft--;
                    if (this.currentViewMonthLeft < 0) {
                        this.currentViewMonthLeft = 11;
                        this.currentViewYearLeft--;
                    }
                    // Adjust right calendar to be the month after the new left calendar month
                    let newRightDate = new Date(this.currentViewYearLeft, this.currentViewMonthLeft + 1, 1);
                    this.currentViewMonthRight = newRightDate.getMonth();
                    this.currentViewYearRight = newRightDate.getFullYear();
                    this._renderCalendars();
                });
            }
        }

        if (side === 'right') {
            const nextBtn = targetElement.querySelector(".next-month-range");
            if (nextBtn) {
                nextBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.currentViewMonthRight++;
                    if (this.currentViewMonthRight > 11) {
                        this.currentViewMonthRight = 0;
                        this.currentViewYearRight++;
                    }
                     // Adjust left calendar to be the month before the new right calendar month
                    let newLeftDate = new Date(this.currentViewYearRight, this.currentViewMonthRight - 1, 1);
                    this.currentViewMonthLeft = newLeftDate.getMonth();
                    this.currentViewYearLeft = newLeftDate.getFullYear();
                    this._renderCalendars();
                });
            }
        }

        targetElement.querySelectorAll(".calendar-day:not(.empty):not(.disabled)").forEach(dayElement => {
            dayElement.addEventListener("click", (e) => {
                e.stopPropagation();
                const [year, month, day] = dayElement.dataset.date.split('-').map(Number);
                const clickedDate = new Date(Date.UTC(year, month - 1, day));

                if (this.selectingStartDate || clickedDate < this.tempStartDate) {
                    this.tempStartDate = clickedDate;
                    this.tempEndDate = new Date(clickedDate.valueOf()); // Reset end date or set to same as start
                    this.selectingStartDate = false;
                } else {
                    this.tempEndDate = clickedDate;
                    this.selectingStartDate = true; // Ready for new start date selection or modify current
                }
                this._renderCalendars();
            });
        });
    }


    _attachEventListeners() {
        this.modalElement.querySelector('.range-calendar-close-btn').addEventListener('click', () => this.hide());
        this.modalElement.querySelector('.range-calendar-cancel-btn').addEventListener('click', () => this.hide());
        this.modalElement.querySelector('.range-calendar-apply-btn').addEventListener('click', () => this._handleApply());

        // Close on overlay click
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.hide();
            }
        });
    }

    _handleApply() {
        if (this.onRangeSelectCallback) {
            this.onRangeSelectCallback(new Date(this.tempStartDate.valueOf()), new Date(this.tempEndDate.valueOf()));
        }
        this.hide();
        this.widget.clearMessages();
    }

    show(currentStartDate, currentEndDate) {
        this.tempStartDate = currentStartDate ? new Date(currentStartDate.valueOf()) : new Date();
        this.tempEndDate = currentEndDate ? new Date(currentEndDate.valueOf()) : new Date(this.tempStartDate.valueOf());
         if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        this.currentViewMonthLeft = this.tempStartDate.getUTCMonth(); // Use UTC month
        this.currentViewYearLeft = this.tempStartDate.getUTCFullYear(); // Use UTC year

        let rightCalendarDate = new Date(Date.UTC(this.currentViewYearLeft, this.currentViewMonthLeft + 1, 1));
        this.currentViewMonthRight = rightCalendarDate.getUTCMonth();
        this.currentViewYearRight = rightCalendarDate.getUTCFullYear();

        this.selectingStartDate = true; // Reset selection mode

        this._renderCalendars();
        this.modalOverlay.style.display = 'flex';
    }

    hide() {
        this.modalOverlay.style.display = 'none';
    }
}
