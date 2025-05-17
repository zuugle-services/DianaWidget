import { DateTime } from 'luxon';
import { getMonthName, getShortDayName, throttle, formatDateForDisplay } from "../utils";

export class SingleCalendar {
    constructor(inputElement, displayElement, initialDate, widgetInstance, onDateSelectCallback) {
        this.inputElement = inputElement; // The hidden input type="date"
        this.displayElement = displayElement; // The span showing the formatted date
        this.dateInputContainer = this.inputElement.closest('.date-input-container');
        this.widget = widgetInstance; // Instance of DianaWidget
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onDateSelectCallback = onDateSelectCallback;

        this.selectedDate = initialDate ? new Date(initialDate.valueOf()) : new Date();
        // Initialize view month/year based on selectedDate or current date
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

        // Explicitly set position and z-index via JS
        this.calendarContainer.style.position = 'absolute';
        this.calendarContainer.style.zIndex = '1050'; // Ensure it's above most other content, adjust if needed
        this.calendarContainer.style.display = 'none'; // Initially hidden

        // Add class for other visual styles (background, padding, font, etc.)
        // These styles should be defined in your CSS, ideally not dependent on .diana-container parent
        // if the calendar is on the body. If they ARE scoped, you might need to adjust CSS.
        this.calendarContainer.className = "diana-container calendar-container";
    }

    _render() {
        if (!this.calendarContainer || window.matchMedia("(max-width: 768px)").matches) return;

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(this.currentViewYear, this.currentViewMonth, day));
            const isToday = date.getTime() === new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();
            const isSelected = this.selectedDate && !isNaN(this.selectedDate.getTime()) &&
                               date.getTime() === new Date(Date.UTC(this.selectedDate.getUTCFullYear(), this.selectedDate.getUTCMonth(), this.selectedDate.getUTCDate())).getTime();

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
                this._render();
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

        const throttledReposition = throttle(this._reposition.bind(this), 50);

        let scrollableParent = this.dateInputContainer.parentElement;
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

        const inputRect = this.dateInputContainer.getBoundingClientRect();

        this.calendarContainer.style.width = `${inputRect.width}px`;
        const calendarHeight = this.calendarContainer.offsetHeight;
        const calendarWidth = this.calendarContainer.offsetWidth;

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        const gap = 5;

        let finalTop = inputRect.bottom + scrollTop + gap;

        if (inputRect.bottom + gap + calendarHeight > viewportHeight && inputRect.top - calendarHeight - gap > scrollTop) {
            // If overflows below AND there's space above (and above is not off-screen due to scroll)
            finalTop = inputRect.top + scrollTop - calendarHeight - gap;
        } else if (inputRect.bottom + gap + calendarHeight > viewportHeight) {
            // Overflows below, and not enough space above or placing above would be off-screen
            // Try to align with bottom of viewport if input is very low, otherwise default to below (might be clipped)
            if (inputRect.top > viewportHeight / 2) { // Heuristic: if input is in lower half
                 // finalTop = scrollTop + viewportHeight - calendarHeight - gap; // Align bottom with small gap
            }
             // Ensure it's not positioned above the current scroll view if it has to be clipped
            if (finalTop < scrollTop) finalTop = scrollTop + gap;

        }

        let finalLeft = inputRect.left + scrollLeft;

        if (inputRect.left + calendarWidth > viewportWidth) {
            finalLeft = inputRect.right + scrollLeft - calendarWidth;
        }
        if (finalLeft < scrollLeft) {
            finalLeft = scrollLeft;
        }

        this.calendarContainer.style.top = `${finalTop}px`;
        this.calendarContainer.style.left = `${finalLeft}px`;
    }

    show() {
        if (window.matchMedia("(max-width: 768px)").matches) return;

        if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        } else {
            const now = new Date();
            this.currentViewMonth = now.getUTCMonth();
            this.currentViewYear = now.getUTCFullYear();
        }

        this._render();
        // Ensure display is 'block' or similar *before* repositioning to get correct offsetHeight
        this.calendarContainer.style.display = 'block';
        this.calendarContainer.classList.add("active");
        this._reposition();
    }

    hide() {
        if (window.matchMedia("(max-width: 768px)").matches || !this.calendarContainer) return;
        this.calendarContainer.style.display = 'none'; // Hide it
        this.calendarContainer.classList.remove("active");
    }

    setSelectedDate(date) {
        this.selectedDate = new Date(date.valueOf());
        if (!isNaN(this.selectedDate.getTime())) {
            this.currentViewMonth = this.selectedDate.getUTCMonth();
            this.currentViewYear = this.selectedDate.getUTCFullYear();
        }
        this._updateInputElement();
        this._updateDisplayElement();
        if (this.calendarContainer && this.calendarContainer.classList.contains("active")) {
            this._render();
        }
    }
}

export class RangeCalendarModal {
    constructor(initialStartDate, initialEndDate, widgetInstance, onRangeSelectCallback) {
        this.widget = widgetInstance;
        this.config = widgetInstance.config;
        this.t = widgetInstance.t.bind(widgetInstance);
        this.onRangeSelectCallback = onRangeSelectCallback;

        // Ensure initial dates are valid or default to today
        const today = new Date();
        today.setUTCHours(0,0,0,0);

        this.tempStartDate = initialStartDate && !isNaN(new Date(initialStartDate.valueOf()))
                             ? new Date(initialStartDate.valueOf())
                             : new Date(today.valueOf());
        this.tempStartDate.setUTCHours(0,0,0,0);

        this.tempEndDate = initialEndDate && !isNaN(new Date(initialEndDate.valueOf()))
                           ? new Date(initialEndDate.valueOf())
                           : new Date(this.tempStartDate.valueOf());
        this.tempEndDate.setUTCHours(0,0,0,0);

        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        // Renamed for clarity as there's only one calendar view now
        this.currentViewMonth = this.tempStartDate.getUTCMonth();
        this.currentViewYear = this.tempStartDate.getUTCFullYear();

        this.selectingStartDate = true;

        this.modalOverlay = null;
        this.modalElement = null;
        this.calendarInstance = null; // Only one calendar instance

        this._initDOM();
        this._attachEventListeners();
    }

    _initDOM() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'range-calendar-overlay';

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'range-calendar-modal'; // CSS makes this smaller for single view
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

        this._renderCalendar(); // Render the single calendar
    }

    _renderCalendar() { // Renamed from _renderCalendars
        this._renderMonth(this.currentViewYear, this.currentViewMonth, this.calendarInstance);
    }

    _renderMonth(year, month, targetElement) { // Removed 'side' parameter
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
                ${[0, 1, 2, 3, 4, 5, 6].map(day => `<div class="calendar-day-header">${getShortDayName(day, this.t)}</div>`).join('')}
                ${this._generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month)}
            </div>
        `;
        this._addRangeCalendarInternalEventListeners(targetElement); // Removed 'side'
    }

    _generateRangeDaysHTML(daysInMonth, firstDayOfMonthIndex, year, month) {
        let html = "";
        const today = new Date();
        today.setUTCHours(0,0,0,0); // Compare with UTC dates

        for (let i = 0; i < firstDayOfMonthIndex; i++) {
            html += "<div class='calendar-day empty'></div>";
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));

            let classes = "calendar-day";
            if (currentDate.getTime() === today.getTime()) classes += " today";

            const normTempStartDate = this.tempStartDate ? new Date(Date.UTC(this.tempStartDate.getUTCFullYear(), this.tempStartDate.getUTCMonth(), this.tempStartDate.getUTCDate())) : null;
            const normTempEndDate = this.tempEndDate ? new Date(Date.UTC(this.tempEndDate.getUTCFullYear(), this.tempEndDate.getUTCMonth(), this.tempEndDate.getUTCDate())) : null;

            if (normTempStartDate && currentDate.getTime() === normTempStartDate.getTime()) classes += " start-date selected";
            if (normTempEndDate && currentDate.getTime() === normTempEndDate.getTime()) classes += " end-date selected";
            if (normTempStartDate && normTempEndDate && currentDate > normTempStartDate && currentDate < normTempEndDate) classes += " in-range";

            const todayUTCForDisable = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
            if (currentDate < todayUTCForDisable) { // Disable dates strictly before today UTC midnight
                 classes += " disabled";
            }

            html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
        }
        return html;
    }

    _addRangeCalendarInternalEventListeners(targetElement) { // Removed 'side'
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
                const [year, month, day] = dayElement.dataset.date.split('-').map(Number);
                const clickedDate = new Date(Date.UTC(year, month - 1, day));

                if (this.selectingStartDate || clickedDate < this.tempStartDate) {
                    this.tempStartDate = clickedDate;
                    this.tempEndDate = new Date(clickedDate.valueOf()); // Reset end date
                    this.selectingStartDate = false;
                } else { // Selecting end date
                    this.tempEndDate = clickedDate;
                    // If end date is before start date after this click, make start date same as end date
                    if (this.tempEndDate < this.tempStartDate) {
                        this.tempStartDate = new Date(this.tempEndDate.valueOf());
                    }
                    this.selectingStartDate = true; // Next click will be start date again
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
        // Ensure tempEndDate is not before tempStartDate before applying
        if (this.tempStartDate && this.tempEndDate && this.tempEndDate < this.tempStartDate) {
            // This case should ideally be handled during date selection,
            // but as a safeguard, we can swap them or alert the user.
            // For now, let's ensure start is not after end by setting end to start if it is.
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
             console.warn("RangeCalendar: End date was before start date. Corrected.");
        }

        if (this.onRangeSelectCallback) {
            // Ensure we pass valid, new Date objects
            const finalStartDate = this.tempStartDate ? new Date(this.tempStartDate.valueOf()) : new Date();
            const finalEndDate = this.tempEndDate ? new Date(this.tempEndDate.valueOf()) : new Date(finalStartDate.valueOf());

            this.onRangeSelectCallback(finalStartDate, finalEndDate);
        }
        this.hide();
        this.widget.clearMessages();
    }

    show(currentStartDate, currentEndDate) {
        const today = new Date();
        today.setUTCHours(0,0,0,0);

        this.tempStartDate = currentStartDate && !isNaN(new Date(currentStartDate.valueOf()))
                             ? new Date(currentStartDate.valueOf())
                             : new Date(today.valueOf());
        this.tempStartDate.setUTCHours(0,0,0,0);

        this.tempEndDate = currentEndDate && !isNaN(new Date(currentEndDate.valueOf()))
                           ? new Date(currentEndDate.valueOf())
                           : new Date(this.tempStartDate.valueOf());
        this.tempEndDate.setUTCHours(0,0,0,0);

        if (this.tempEndDate < this.tempStartDate) {
            this.tempEndDate = new Date(this.tempStartDate.valueOf());
        }

        // Set the view to the month/year of the start date
        this.currentViewMonth = this.tempStartDate.getUTCMonth();
        this.currentViewYear = this.tempStartDate.getUTCFullYear();

        this.selectingStartDate = true;

        this._renderCalendar();
        this.modalOverlay.style.display = 'flex';
    }

    hide() {
        this.modalOverlay.style.display = 'none';
    }
}