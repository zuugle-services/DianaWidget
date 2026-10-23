import {CalendarOverlay} from './Calendar';
import {
    addDaysIso, countDays, firstSelectableDay, isDayDisabled, pickRangeDay, todayIso,
    type RangeRules, type RangeValue,
} from '../core/dateSelection';
import {formatIsoDay, formatIsoRange} from '../utils';
import type {TranslationFunction} from '../types';

/** Days shown in the strip; narrow widgets hide the last ones via container queries. */
const STRIP_DAYS = 7;

const CALENDAR_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const LOCK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export interface DateFieldOptions {
    multiday: boolean;
    /** Range constraints (multi-day only). */
    rules: RangeRules | null;
    /** The date is decided by the config: show it, but don't offer a choice. */
    locked: boolean;
    language: string;
    timezone: string;
    t: TranslationFunction;
    /** Element the calendar overlay is placed in (covers the whole widget). */
    overlayContainer: HTMLElement;
    onChange: (value: RangeValue) => void;
}

/**
 * The form's date field: a strip of the next days (one tap for most searches), a calendar
 * button for later dates, and a line spelling out the choice. Multi-day trips use the same
 * strip: tap the first day, then the last.
 */
export class DateField {
    private root: HTMLElement;
    private options: DateFieldOptions;
    private value: RangeValue = {start: null, end: null, awaitingEnd: false};
    private calendar: CalendarOverlay | null = null;
    /** The last interaction with the strip came from the keyboard: don't slide the highlight. */
    private fromKeyboard = false;
    private disabled = false;

    constructor(root: HTMLElement, options: DateFieldOptions) {
        this.root = root;
        this.options = options;
        if (!options.locked) {
            this.calendar = new CalendarOverlay(options.overlayContainer, {
                mode: options.multiday ? 'range' : 'single',
                rules: options.rules,
                language: options.language,
                timezone: options.timezone,
                t: options.t,
                onApply: (value) => this._commit(value),
            });
        }
        this.root.addEventListener('keydown', () => { this.fromKeyboard = true; });
        this.root.addEventListener('pointerdown', () => { this.fromKeyboard = false; });
        this.root.addEventListener('click', (e) => this._handleClick(e as MouseEvent));
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => this._positionPill(false)).observe(this.root);
        }
    }

    getValue(): RangeValue {
        return {...this.value};
    }

    /** Sets the value from outside (initial state, shared journey, host API) without notifying. */
    setValue(value: RangeValue): void {
        this.value = {...value};
        this.render();
    }

    setDisabled(disabled: boolean): void {
        this.disabled = disabled;
        this.root.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = disabled || b.dataset.blocked === 'true'; });
    }

    render(): void {
        const {t, language, multiday, locked} = this.options;
        const {start, end} = this.value;
        const summary = this.root.querySelector('.date-summary') as HTMLElement | null;
        const area = this.root.querySelector('.date-area') as HTMLElement | null;
        if (!area) return;

        if (locked) {
            const text = !start ? '' : multiday && end && end !== start
                ? `${formatIsoDay(start, language, 'short')} – ${formatIsoDay(end, language, 'short')}`
                : formatIsoDay(start, language, 'long');
            area.innerHTML = `<div class="locked-date">${LOCK_ICON}<span>${text}</span></div>`;
            if (summary) summary.textContent = '';
            return;
        }

        const today = todayIso(this.options.timezone);
        const rules = multiday ? this.options.rules : null;
        const first = firstSelectableDay(today, rules);
        const days = Array.from({length: STRIP_DAYS}, (_, i) => addDaysIso(first, i));
        const last = days[days.length - 1];
        const beyondStrip = !!start && (multiday ? (end ?? start) > last : start > last);

        const buttons = days.map(iso => {
            const blocked = isDayDisabled(iso, today, rules);
            const isEdge = iso === start || (multiday && iso === end);
            const inRange = multiday && !!start && !!end && iso > start && iso < end;
            let cls = 'day-btn';
            if (isEdge) cls += multiday ? ' range-edge' : ' selected';
            if (inRange) cls += ' in-range';
            // Only "Today" gets a word; every other day shows its weekday, which works in every language.
            const label = iso === today ? t('today') : formatIsoDay(iso, language, 'weekday');
            return `<button type="button" class="${cls}" data-date="${iso}" aria-pressed="${isEdge}" aria-label="${formatIsoDay(iso, language, 'long')}"${blocked ? ' data-blocked="true" disabled' : ''}><span class="day-btn-dow">${label}</span><span class="day-btn-num">${Number(iso.slice(8, 10))}</span></button>`;
        }).join('');

        const calCls = beyondStrip ? (multiday ? ' range-edge' : ' selected') : '';
        area.innerHTML = `<div class="day-strip">
            <span class="day-strip-pill" aria-hidden="true"></span>
            ${buttons}
            <button type="button" class="day-btn day-btn-calendar${calCls}" data-action="calendar" aria-haspopup="dialog" aria-label="${t('moreDates')}">${CALENDAR_ICON}</button>
        </div>`;

        if (summary) summary.textContent = this._summaryText();
        if (this.disabled) this.setDisabled(true);
        this._positionPill(false);
    }

    private _summaryText(): string {
        const {t, language, multiday} = this.options;
        const {start, end, awaitingEnd} = this.value;
        if (!start) return '';
        if (!multiday) return formatIsoDay(start, language, 'long');
        if (awaitingEnd) return `${formatIsoDay(start, language, 'long')} – ${t('pickLastDay')}`;
        const last = end ?? start;
        return `${formatIsoRange(start, last, language)} · ${String(t('daysCount')).replace('{n}', String(countDays(start, last)))}`;
    }

    private _handleClick(e: MouseEvent): void {
        const button = (e.target as HTMLElement).closest('button.day-btn') as HTMLButtonElement | null;
        if (!button || button.disabled || this.disabled) return;
        if (button.dataset.action === 'calendar') {
            // detail === 0: activated with Enter/Space, so the calendar opens without animation.
            this.calendar?.open(this.value, button, e.detail === 0);
            return;
        }
        const iso = button.dataset.date;
        if (!iso) return;

        if (this.options.multiday && this.options.rules) {
            this.value = pickRangeDay(this.value, iso, this.options.rules);
            this.render();
            (this.root.querySelector(`button.day-btn[data-date="${iso}"]`) as HTMLElement | null)?.focus({preventScroll: true});
            this.options.onChange(this.getValue());
            return;
        }

        // Single day: move the highlight instead of re-rendering, so it can slide.
        this.value = {start: iso, end: iso, awaitingEnd: false};
        this.root.querySelectorAll<HTMLButtonElement>('button.day-btn').forEach(b => {
            const on = b === button;
            b.classList.toggle('selected', on);
            b.setAttribute('aria-pressed', String(on));
        });
        const summary = this.root.querySelector('.date-summary') as HTMLElement | null;
        if (summary) summary.textContent = this._summaryText();
        this._positionPill(!this.fromKeyboard);
        this.options.onChange(this.getValue());
    }

    private _commit(value: RangeValue): void {
        this.value = {...value, awaitingEnd: false};
        this.render();
        this.options.onChange(this.getValue());
    }

    /** One highlight slides between days (single-day mode); keyboard changes jump. */
    private _positionPill(animate: boolean): void {
        const strip = this.root.querySelector('.day-strip') as HTMLElement | null;
        const pill = strip?.querySelector('.day-strip-pill') as HTMLElement | null;
        if (!strip || !pill) return;
        // A chosen day hidden by a narrow widget is represented by the calendar button.
        const hiddenChoice = Array.from(strip.querySelectorAll<HTMLElement>('.day-btn.selected:not(.day-btn-calendar), .day-btn.range-edge:not(.day-btn-calendar)'))
            .some(b => b.offsetParent === null);
        strip.querySelector('.day-btn-calendar')?.classList.toggle('holds-choice', hiddenChoice && strip.clientWidth > 0);
        const active = this.options.multiday ? null : strip.querySelector('.day-btn.selected:not(.day-btn-calendar)') as HTMLElement | null;
        if (!active || active.offsetParent === null || strip.clientWidth === 0) {
            pill.classList.remove('is-visible');
            return;
        }
        const left = active.offsetLeft;
        const right = strip.clientWidth - left - active.offsetWidth;
        const jump = !animate || !pill.classList.contains('is-visible');
        pill.classList.toggle('no-transition', jump);
        pill.style.clipPath = `inset(0 ${right}px 0 ${left}px round var(--radius-md))`;
        pill.classList.add('is-visible');
        if (jump) {
            void pill.offsetWidth; // Commit the jump before transitions come back.
            pill.classList.remove('no-transition');
        }
    }
}
