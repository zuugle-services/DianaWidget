import {DateTime} from 'luxon';
import {
    addDaysIso, countDays, isDayDisabled, pickRangeDay, todayIso,
    type RangeRules, type RangeValue,
} from '../core/dateSelection';
import {formatIsoDay, formatIsoRange, localeForLanguage} from '../utils';
import type {TranslationFunction} from '../types';

export interface CalendarOptions {
    /** 'single' picks one day; 'range' picks a multi-day trip. */
    mode: 'single' | 'range';
    /** Range constraints from the config (range mode only). */
    rules: RangeRules | null;
    language: string;
    timezone: string;
    t: TranslationFunction;
    /** Called with the chosen value when the user presses Apply. */
    onApply: (value: RangeValue) => void;
}

const CLOSE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const PREV_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const NEXT_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

/** Maps a key pressed on a day button to the day focus should move to, or null for other keys. */
function keyTargetDay(key: string, from: string): string | null {
    const dt = DateTime.fromISO(from, {zone: 'utc'});
    switch (key) {
        case 'ArrowLeft': return addDaysIso(from, -1);
        case 'ArrowRight': return addDaysIso(from, 1);
        case 'ArrowUp': return addDaysIso(from, -7);
        case 'ArrowDown': return addDaysIso(from, 7);
        case 'PageUp': return dt.minus({months: 1}).toISODate();
        case 'PageDown': return dt.plus({months: 1}).toISODate();
        default: return null;
    }
}

/**
 * Month calendar shown as an overlay inside the widget, for single days and multi-day trips.
 * One design for every device and embed size; keyboard: arrows / Page Up/Down move between
 * days, Escape closes, Tab stays inside, focus returns to the opener.
 */
export class CalendarOverlay {
    private options: CalendarOptions;
    private overlay: HTMLDivElement;
    private grid: HTMLElement;
    private value: RangeValue = {start: null, end: null, awaitingEnd: false};
    /** First day of the month on screen. */
    private view: DateTime = DateTime.now();
    private opener: HTMLElement | null = null;

    constructor(container: HTMLElement, options: CalendarOptions) {
        this.options = options;
        const {t, mode} = options;
        const titleId = `dianaCalendarTitle_${Math.random().toString(36).slice(2, 8)}`;

        this.overlay = document.createElement('div');
        this.overlay.className = 'calendar-overlay';
        this.overlay.hidden = true;
        this.overlay.innerHTML = `
            <div class="calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
                <div class="calendar-head">
                    <h3 id="${titleId}">${mode === 'range' ? t('selectDateRange') : t('datePickerTitle')}</h3>
                    <button type="button" class="icon-btn calendar-close" aria-label="${t('cancel')}">${CLOSE_ICON}</button>
                </div>
                ${mode === 'range' && !options.rules?.durationDays ? `<p class="calendar-hint">${t('calendarRangeHint')}</p>` : ''}
                <div class="calendar-nav">
                    <button type="button" class="icon-btn calendar-prev" aria-label="${t('ariaLabels.previousMonthButton')}">${PREV_ICON}</button>
                    <div class="calendar-month" aria-live="polite"></div>
                    <button type="button" class="icon-btn calendar-next" aria-label="${t('ariaLabels.nextMonthButton')}">${NEXT_ICON}</button>
                </div>
                <div class="calendar-grid"></div>
                <div class="calendar-foot">
                    <span class="calendar-choice" aria-live="polite"></span>
                    <button type="button" class="calendar-btn calendar-cancel">${t('cancel')}</button>
                    <button type="button" class="calendar-btn calendar-apply">${t('apply')}</button>
                </div>
            </div>`;
        container.appendChild(this.overlay);
        this.grid = this.overlay.querySelector('.calendar-grid') as HTMLElement;

        this.overlay.querySelector('.calendar-close')?.addEventListener('click', () => this.close());
        this.overlay.querySelector('.calendar-cancel')?.addEventListener('click', () => this.close());
        this.overlay.querySelector('.calendar-apply')?.addEventListener('click', () => {
            const value = {...this.value};
            this.close();
            this.options.onApply(value);
        });
        this.overlay.querySelector('.calendar-prev')?.addEventListener('click', () => this._showMonth(this.view.minus({months: 1}), '.calendar-prev'));
        this.overlay.querySelector('.calendar-next')?.addEventListener('click', () => this._showMonth(this.view.plus({months: 1}), '.calendar-next'));
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
        this.overlay.addEventListener('keydown', (e) => this._handleKeydown(e));
        this.grid.addEventListener('click', (e) => {
            const button = (e.target as HTMLElement).closest('button.calendar-day') as HTMLButtonElement | null;
            if (!button || button.disabled || !button.dataset.date) return;
            this._pick(button.dataset.date);
        });
    }

    get isOpen(): boolean {
        return !this.overlay.hidden;
    }

    /**
     * Opens the calendar on the given value.
     * @param fromKeyboard - Opened with Enter/Space: appear without animation.
     */
    open(value: RangeValue, opener: HTMLElement | null, fromKeyboard = false): void {
        this.value = {...value, awaitingEnd: false};
        this.opener = opener;
        const anchor = value.start ?? todayIso(this.options.timezone);
        this.overlay.classList.toggle('no-animation', fromKeyboard);
        this.overlay.hidden = false;
        this._showMonth(DateTime.fromISO(anchor, {zone: 'utc'}).startOf('month'), null, true);
    }

    close(): void {
        if (this.overlay.hidden) return;
        this.overlay.hidden = true;
        this.opener?.focus({preventScroll: true});
    }

    private _pick(iso: string): void {
        if (this.options.mode === 'range' && this.options.rules) {
            this.value = pickRangeDay(this.value, iso, this.options.rules);
        } else {
            this.value = {start: iso, end: iso, awaitingEnd: false};
        }
        this._render(`button.calendar-day[data-date="${iso}"]`);
    }

    private _showMonth(month: DateTime, focusSelector: string | null, focusDay = false): void {
        this.view = month.startOf('month');
        this._render(focusSelector, focusDay);
    }

    /** Rebuilds the grid; `focusSelector` keeps keyboard users in place across the rebuild. */
    private _render(focusSelector: string | null = null, focusDay = false): void {
        const {mode, language, timezone, t} = this.options;
        const rules = mode === 'range' ? this.options.rules : null;
        const locale = localeForLanguage(language);
        const today = todayIso(timezone);
        const {start, end, awaitingEnd} = this.value;

        (this.overlay.querySelector('.calendar-month') as HTMLElement).textContent =
            this.view.setLocale(locale).toLocaleString({month: 'long', year: 'numeric'});
        // No browsing into months that are entirely in the past.
        const prev = this.overlay.querySelector('.calendar-prev') as HTMLButtonElement;
        prev.disabled = this.view.toISODate()! <= DateTime.fromISO(today, {zone: 'utc'}).startOf('month').toISODate()!;

        const monday = DateTime.fromISO('2024-01-01', {zone: 'utc'}).setLocale(locale);
        let html = Array.from({length: 7}, (_, i) =>
            `<div class="calendar-dow" aria-hidden="true">${monday.plus({days: i}).toFormat('ccc').replace('.', '').slice(0, 2)}</div>`
        ).join('');
        html += '<span></span>'.repeat(this.view.weekday - 1);

        const hasBand = mode === 'range' && !!start && !!end && start !== end;
        for (let day = 1; day <= this.view.daysInMonth!; day++) {
            const iso = this.view.set({day}).toISODate() as string;
            const disabled = isDayDisabled(iso, today, rules);
            const isEdge = iso === start || (mode === 'range' && iso === end);
            let cls = 'calendar-day';
            if (iso === today) cls += ' today';
            if (isEdge) cls += ' selected';
            let cell = 'calendar-cell';
            if (hasBand) {
                if (iso === start) cell += ' band-start';
                else if (iso === end) cell += ' band-end';
                else if (iso > start! && iso < end!) cell += ' in-range';
            }
            html += `<div class="${cell}"><button type="button" class="${cls}" data-date="${iso}" tabindex="-1"${disabled ? ' disabled' : ''} aria-pressed="${isEdge}" aria-label="${formatIsoDay(iso, language, 'long')}">${day}</button></div>`;
        }
        this.grid.innerHTML = html;

        let choice: string;
        if (!start) choice = '';
        else if (mode === 'single') choice = formatIsoDay(start, language, 'short');
        else if (awaitingEnd) choice = `${formatIsoDay(start, language, 'short')} – ${t('pickLastDay')}`;
        else choice = `${formatIsoRange(start, end ?? start, language)} · ${String(t('daysCount')).replace('{n}', String(countDays(start, end ?? start)))}`;
        (this.overlay.querySelector('.calendar-choice') as HTMLElement).textContent = choice;
        (this.overlay.querySelector('.calendar-apply') as HTMLButtonElement).disabled = !start || awaitingEnd;

        // Roving tabindex: exactly one day is in the Tab order.
        const days = Array.from(this.grid.querySelectorAll<HTMLButtonElement>('button.calendar-day'));
        const requested = focusSelector ? this.overlay.querySelector(focusSelector) as HTMLElement | null : null;
        const rovingDay = (requested?.classList.contains('calendar-day') && !(requested as HTMLButtonElement).disabled ? requested : null)
            ?? days.find(d => d.classList.contains('selected') && !d.disabled)
            ?? days.find(d => d.classList.contains('today'))
            ?? days.find(d => !d.disabled)
            ?? null;
        days.forEach(d => { d.tabIndex = d === rovingDay ? 0 : -1; });
        if (requested && !requested.classList.contains('calendar-day')) requested.focus({preventScroll: true});
        else if (focusSelector || focusDay) rovingDay?.focus({preventScroll: true});
    }

    private _handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
            return;
        }
        if (e.key === 'Tab') {
            const focusables = Array.from(this.overlay.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])'));
            if (focusables.length === 0) return;
            const active = (this.overlay.getRootNode() as Document | ShadowRoot).activeElement;
            const index = focusables.indexOf(active as HTMLElement);
            if (e.shiftKey && index === 0) {
                e.preventDefault();
                focusables[focusables.length - 1].focus();
            } else if (!e.shiftKey && index === focusables.length - 1) {
                e.preventDefault();
                focusables[0].focus();
            }
            return;
        }

        const dayButton = (e.target as HTMLElement).closest?.('button.calendar-day') as HTMLElement | null;
        if (!dayButton?.dataset.date) return;
        const target = keyTargetDay(e.key, dayButton.dataset.date);
        if (!target) return;
        e.preventDefault();
        if (target < todayIso(this.options.timezone)) return;
        this._showMonth(DateTime.fromISO(target, {zone: 'utc'}), `button.calendar-day[data-date="${target}"]`);
    }
}
