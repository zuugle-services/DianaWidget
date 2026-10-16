/**
 * legInfo - Passenger information attached to connection legs:
 * service alerts, on-demand (FLEX) service details and booking rules.
 *
 * Everything here is pure string rendering (no DOM access) so it can run in the
 * Shadow DOM widget as well as in unit tests. All provider data is untrusted:
 * texts are HTML-escaped, and only http(s), tel and mailto links are produced.
 */

import { DateTime } from 'luxon';

import type {
    AlertSeverity,
    AlertTimeRange,
    BookingRule,
    Connection,
    ConnectionElement,
    FlexInfo,
    TransportAlert
} from '../types';

export type LegInfoTranslate = (key: string, replacements?: Record<string, string>) => string;

export interface LegInfoContext {
    t: LegInfoTranslate;
    /** IANA timezone used to display times */
    timezone: string;
    /** Widget language code (e.g. 'DE') */
    language: string;
    /** Reference time for booking deadlines; defaults to now */
    now?: DateTime;
}

/* ------------------------------------------------------------------------ */
/* Escaping & icons                                                          */
/* ------------------------------------------------------------------------ */

export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const svg = (body: string, extraClass = ''): string =>
    `<svg class="leg-info-icon ${extraClass}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const LEG_INFO_ICONS = {
    info: () => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/>'),
    warning: () => svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    severe: () => svg('<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
    phone: () => svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    calendar: () => svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>'),
    clock: () => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    external: () => svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', 'leg-info-icon--inline'),
    chevron: () => svg('<polyline points="6 9 12 15 18 9"/>', 'leg-info-icon--chevron'),
};

/* ------------------------------------------------------------------------ */
/* Links                                                                     */
/* ------------------------------------------------------------------------ */

const SAFE_URL_RE = /^https?:\/\/[^\s<>"']+$/i;

/** Returns the URL if it is an absolute http(s) URL, otherwise null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return SAFE_URL_RE.test(trimmed) ? trimmed : null;
}

/** tel: href for a human-written phone number ("+43 50 422 422" -> "tel:+4350422422"). */
export function telHref(phone: string): string | null {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 3 || digits.length > 17) return null;
    return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** Short, readable label for a URL: host + path without protocol / "www." / trailing slash. */
export function formatUrlLabel(url: string, maxLength = 42): string {
    let label = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    label = label.replace(/\/$/, '');
    if (label.length > maxLength) {
        label = `${label.slice(0, maxLength - 1)}…`;
    }
    return label;
}

function externalLink(href: string, label: string, t: LegInfoTranslate, className = 'leg-info-link'): string {
    return `<a class="${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(href)}">`
        + `${escapeHtml(label)}<span class="visually-hidden"> (${escapeHtml(t('opensInNewTab'))})</span></a>`;
}

// Top-level domains accepted for bare domains like "montafon.at/wanderbus". Kept to a
// list so abbreviations ("z.B.", "St.Anton") are not turned into links.
const BARE_DOMAIN_TLDS = [
    'at', 'de', 'ch', 'li', 'it', 'fr', 'es', 'si', 'cz', 'sk', 'hu', 'pl', 'nl', 'be', 'lu', 'dk', 'se', 'no',
    'fi', 'pt', 'gr', 'hr', 'uk', 'eu', 'th', 'com', 'org', 'net', 'info', 'travel', 'tirol', 'wien', 'bayern',
    'swiss', 'shop', 'app', 'ski', 'bike', 'online', 'io', 'co',
].join('|');

const LINK_RE = new RegExp(
    [
        // 1: explicit URL
        String.raw`(https?:\/\/[^\s<>"']+)`,
        // 2: e-mail address
        String.raw`([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})`,
        // 3: phone number: starts with + or 0, digits with spaces / slashes / dashes / (0)
        String.raw`((?:\+|0)\d(?:[\d \/-]|\(\d{1,4}\)){4,}\d)`,
        // 4: bare domain (labels of at least two characters) with optional path
        String.raw`((?:www\.)?(?:[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]\.)+(?:${BARE_DOMAIN_TLDS})(?![A-Za-z0-9-])(?:\/[^\s<>"']*)?)`,
    ].join('|'),
    'gi'
);

const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}'"»]+$/;

// Characters that must not directly precede a phone number / bare domain. Checked in
// code rather than with regex lookbehind, which older Safari versions cannot parse.
const PHONE_BLOCKED_PREFIX_RE = /[\w.,:]/;
const DOMAIN_BLOCKED_PREFIX_RE = /[\w@./-]/;

/**
 * Escapes plain text and turns URLs, bare domains, e-mail addresses and phone
 * numbers into links. Line breaks are kept as-is (render with `white-space: pre-line`).
 */
export function linkifyText(text: string | null | undefined, t: LegInfoTranslate): string {
    if (!text) return '';
    let html = '';
    let lastIndex = 0;
    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(text)) !== null) {
        const previousChar = match.index > 0 ? text[match.index - 1] : '';
        if ((match[3] && PHONE_BLOCKED_PREFIX_RE.test(previousChar))
            || (match[4] && DOMAIN_BLOCKED_PREFIX_RE.test(previousChar))) {
            // Part of a longer token (e.g. digits inside a date): resume right after
            // its first character so later, real tokens are still found.
            LINK_RE.lastIndex = match.index + 1;
            continue;
        }
        let token = match[0];
        let trailing = '';
        const punct = token.match(TRAILING_PUNCTUATION_RE);
        if (punct && (match[1] || match[4])) {
            trailing = punct[0];
            token = token.slice(0, -trailing.length);
        }

        let link: string | null = null;
        if (match[1]) {
            link = externalLink(token, formatUrlLabel(token), t);
        } else if (match[2]) {
            link = `<a class="leg-info-link" href="mailto:${escapeHtml(token)}">${escapeHtml(token)}</a>`;
        } else if (match[3]) {
            const digitCount = token.replace(/\D/g, '').length;
            const href = digitCount >= 7 && digitCount <= 15 ? telHref(token) : null;
            link = href
                ? `<a class="leg-info-link leg-info-link--phone" href="${escapeHtml(href)}" aria-label="${escapeHtml(t('booking.call', {number: token}))}">${escapeHtml(token)}</a>`
                : null;
        } else if (match[4]) {
            link = externalLink(`https://${token}`, formatUrlLabel(token), t);
        }

        if (link === null) continue;
        html += escapeHtml(text.slice(lastIndex, match.index)) + link + escapeHtml(trailing);
        lastIndex = match.index + match[0].length;
    }
    html += escapeHtml(text.slice(lastIndex));
    return html;
}

/* ------------------------------------------------------------------------ */
/* Date formatting                                                           */
/* ------------------------------------------------------------------------ */

const LOCALES: Record<string, string> = {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'};

function toLocal(iso: string | null | undefined, ctx: LegInfoContext): DateTime | null {
    if (!iso) return null;
    const dt = DateTime.fromISO(iso, {zone: 'utc'});
    if (!dt.isValid) return null;
    return dt.setZone(ctx.timezone).setLocale(LOCALES[ctx.language?.toUpperCase()] ?? 'en-GB');
}

function formatTime(iso: string | null | undefined, ctx: LegInfoContext): string | null {
    const dt = toLocal(iso, ctx);
    return dt ? dt.toFormat('HH:mm') : null;
}

/** "Mon, 18 Oct, 17:00" in the widget language and timezone. */
export function formatDateTime(iso: string | null | undefined, ctx: LegInfoContext): string | null {
    const dt = toLocal(iso, ctx);
    if (!dt) return null;
    return dt.toLocaleString({weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
}

function formatDate(iso: string | null | undefined, ctx: LegInfoContext): string | null {
    const dt = toLocal(iso, ctx);
    return dt ? dt.toLocaleString({day: 'numeric', month: 'short', year: 'numeric'}) : null;
}

/* ------------------------------------------------------------------------ */
/* Alerts                                                                    */
/* ------------------------------------------------------------------------ */

const SEVERITY_RANK: Record<AlertSeverity, number> = {info: 0, warning: 1, severe: 2};

// Mirrors the backend mapping so older backends without `severity` still render sensibly.
const EFFECT_SEVERITY: Record<string, AlertSeverity> = {
    NO_SERVICE: 'severe',
    REDUCED_SERVICE: 'warning',
    SIGNIFICANT_DELAYS: 'warning',
    DETOUR: 'warning',
    MODIFIED_SERVICE: 'warning',
    STOP_MOVED: 'warning',
    ACCESSIBILITY_ISSUE: 'warning',
};

export function getAlertSeverity(alert: TransportAlert): AlertSeverity {
    if (alert.severity && alert.severity in SEVERITY_RANK) return alert.severity;
    return EFFECT_SEVERITY[(alert.effect ?? '').toUpperCase()] ?? 'info';
}

function hasContent(alert: TransportAlert): boolean {
    return Boolean(alert.header_text?.trim() || alert.description_text?.trim() || safeHttpUrl(alert.url));
}

export function alertKey(alert: TransportAlert): string {
    return [alert.header_text?.trim() ?? '', alert.description_text?.trim() ?? '', alert.url ?? ''].join('␟');
}

/** Displayable alerts of a leg, most severe first, without duplicates. */
export function getLegAlerts(element: ConnectionElement): TransportAlert[] {
    const seen = new Set<string>();
    const result: TransportAlert[] = [];
    for (const alert of element.alerts ?? []) {
        if (!alert || !hasContent(alert)) continue;
        const key = alertKey(alert);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(alert);
    }
    return result.sort((a, b) => SEVERITY_RANK[getAlertSeverity(b)] - SEVERITY_RANK[getAlertSeverity(a)]);
}

/** Texts longer than this get a "show more" toggle and are clamped to three lines. */
const CLAMP_MIN_LENGTH = 160;
const CLAMP_MIN_LINES = 4;

function needsClamp(text: string): boolean {
    return text.length > CLAMP_MIN_LENGTH || text.split('\n').length >= CLAMP_MIN_LINES;
}

let uidCounter = 0;

function nextId(prefix: string): string {
    uidCounter += 1;
    return `${prefix}-${uidCounter}`;
}

function formatValidity(periods: readonly AlertTimeRange[] | undefined, ctx: LegInfoContext): string | null {
    const period = periods?.[0];
    if (!period) return null;
    const start = formatDate(period.start, ctx);
    const end = formatDate(period.end, ctx);
    if (start && end) return start === end ? start : ctx.t('alert.validBetween', {start, end});
    if (end) return ctx.t('alert.validUntil', {date: end});
    if (start) return ctx.t('alert.validFrom', {date: start});
    return null;
}

function renderAlert(alert: TransportAlert, ctx: LegInfoContext): string {
    const {t} = ctx;
    const severity = getAlertSeverity(alert);
    const header = alert.header_text?.trim() ?? '';
    const description = alert.description_text?.trim() ?? '';
    const url = safeHttpUrl(alert.url);

    const stopContext = alert.stop_name && alert.scope && alert.scope !== 'trip'
        ? ` <span class="leg-notice__context">· ${escapeHtml(t('alert.atStop', {stop: alert.stop_name}))}</span>`
        : '';

    // A description that is nothing but the alert's own URL adds no information.
    const showDescription = description && !(url && description === url);
    const clamp = showDescription && needsClamp(description);
    const textId = nextId('leg-notice-text');

    let body = '';
    if (header) {
        body += `<p class="leg-notice__title">${linkifyText(header, t)}</p>`;
    }
    if (showDescription) {
        body += `<p class="leg-notice__text${clamp ? ' is-clamped' : ''}" id="${textId}">${linkifyText(description, t)}</p>`;
    }

    const footer: string[] = [];
    if (clamp) {
        footer.push(`<button type="button" class="leg-notice__toggle" aria-expanded="false" aria-controls="${textId}" `
            + `data-label-more="${escapeHtml(t('alert.showMore'))}" data-label-less="${escapeHtml(t('alert.showLess'))}">`
            + `<span class="leg-notice__toggle-label">${escapeHtml(t('alert.showMore'))}</span>${LEG_INFO_ICONS.chevron()}</button>`);
    }
    if (url) {
        footer.push(externalLink(url, t('alert.moreInfo'), t, 'leg-info-link leg-notice__more'));
    }
    const validity = formatValidity(alert.impact_period, ctx);
    if (validity) {
        footer.push(`<span class="leg-notice__validity">${escapeHtml(validity)}</span>`);
    }

    return `
        <li class="leg-notice leg-notice--${severity}">
            <span class="leg-notice__icon">${LEG_INFO_ICONS[severity]()}</span>
            <div class="leg-notice__body">
                <p class="leg-notice__label">${escapeHtml(t(`alert.severity.${severity}`))}${stopContext}</p>
                ${body}
                ${footer.length ? `<div class="leg-notice__footer">${footer.join('')}</div>` : ''}
            </div>
        </li>`;
}

/** Warnings and disruptions, which are shown before booking information. */
export const isUrgentAlert = (alert: TransportAlert): boolean => getAlertSeverity(alert) !== 'info';

/**
 * Renders the notices of a leg. Alerts whose key is already in `seen` (because an
 * earlier leg of the same connection showed them) are skipped; shown keys are added.
 * `filter` restricts which of the leg's alerts are rendered by this call.
 */
export function renderLegAlerts(
    element: ConnectionElement,
    ctx: LegInfoContext,
    seen?: Set<string>,
    filter?: (alert: TransportAlert) => boolean
): string {
    const alerts = getLegAlerts(element).filter(alert => {
        if (filter && !filter(alert)) return false;
        const key = alertKey(alert);
        if (seen?.has(key)) return false;
        seen?.add(key);
        return true;
    });
    if (alerts.length === 0) return '';
    return `<ul class="leg-notices" role="list" aria-label="${escapeHtml(ctx.t('alert.listLabel'))}">${alerts.map(a => renderAlert(a, ctx)).join('')}</ul>`;
}

/* ------------------------------------------------------------------------ */
/* Booking & FLEX                                                            */
/* ------------------------------------------------------------------------ */

export type BookingState = 'open' | 'not_yet_open' | 'expired';

export interface BookingStatus {
    state: BookingState;
    /** Translated, ready-to-display status line (may be null if nothing is known) */
    text: string | null;
}

export function getBookingStatus(rule: BookingRule, ctx: LegInfoContext): BookingStatus {
    const now = ctx.now ?? DateTime.now();
    const latest = rule.latest_booking_time ? DateTime.fromISO(rule.latest_booking_time, {zone: 'utc'}) : null;
    const earliest = rule.earliest_booking_time ? DateTime.fromISO(rule.earliest_booking_time, {zone: 'utc'}) : null;

    if (latest?.isValid && now > latest) {
        return {state: 'expired', text: ctx.t('booking.expired', {datetime: formatDateTime(rule.latest_booking_time, ctx) ?? ''})};
    }
    if (earliest?.isValid && now < earliest) {
        return {state: 'not_yet_open', text: ctx.t('booking.opensAt', {datetime: formatDateTime(rule.earliest_booking_time, ctx) ?? ''})};
    }
    if (rule.booking_type === 'real_time') {
        return {state: 'open', text: ctx.t('booking.deadlineRealTime')};
    }
    if (latest?.isValid) {
        return {state: 'open', text: ctx.t('booking.deadline', {datetime: formatDateTime(rule.latest_booking_time, ctx) ?? ''})};
    }
    return {state: 'open', text: null};
}

function ruleIdentity(rule: BookingRule, messageField: 'pickup_message' | 'drop_off_message'): string {
    return JSON.stringify([rule.booking_type, rule[messageField] ?? rule.message, rule.phone_number, rule.booking_url,
        rule.info_url, rule.latest_booking_time, rule.earliest_booking_time]);
}

interface BookingPart {
    label: string | null;
    rule: BookingRule;
    message: string | undefined;
}

/** The booking rules of a leg that need to be shown (identical pickup / drop-off rules are merged). */
function getBookingParts(element: ConnectionElement, t: LegInfoTranslate): BookingPart[] {
    const pickup = element.booking?.pickup;
    const dropOff = element.booking?.drop_off;
    if (pickup && dropOff && ruleIdentity(pickup, 'pickup_message') !== ruleIdentity(dropOff, 'drop_off_message')) {
        return [
            {label: t('booking.pickup'), rule: pickup, message: pickup.pickup_message ?? pickup.message},
            {label: t('booking.dropOff'), rule: dropOff, message: dropOff.drop_off_message ?? dropOff.message},
        ];
    }
    if (pickup) return [{label: null, rule: pickup, message: pickup.pickup_message ?? pickup.message}];
    if (dropOff) return [{label: null, rule: dropOff, message: dropOff.drop_off_message ?? dropOff.message}];
    return [];
}

export function hasBooking(element: ConnectionElement): boolean {
    return Boolean(element.booking?.pickup || element.booking?.drop_off);
}

function renderBookingPart(part: BookingPart, ctx: LegInfoContext): string {
    const {t} = ctx;
    const {rule} = part;
    const status = getBookingStatus(rule, ctx);
    const bookingUrl = safeHttpUrl(rule.booking_url);
    const infoUrl = safeHttpUrl(rule.info_url);
    const phoneHref = rule.phone_number ? telHref(rule.phone_number) : null;

    const actions: string[] = [];
    if (bookingUrl && status.state !== 'expired') {
        actions.push(`<a class="leg-action leg-action--primary" href="${escapeHtml(bookingUrl)}" target="_blank" rel="noopener noreferrer">`
            + `${escapeHtml(t('booking.bookOnline'))}${LEG_INFO_ICONS.external()}<span class="visually-hidden"> (${escapeHtml(t('opensInNewTab'))})</span></a>`);
    }
    if (phoneHref && rule.phone_number) {
        actions.push(`<a class="leg-action" href="${escapeHtml(phoneHref)}" aria-label="${escapeHtml(t('booking.call', {number: rule.phone_number}))}">`
            + `${LEG_INFO_ICONS.phone()}<span>${escapeHtml(rule.phone_number)}</span></a>`);
    }
    if (infoUrl) {
        actions.push(externalLink(infoUrl, t('booking.info'), t, 'leg-info-link leg-booking__info'));
    }

    return `
        <div class="leg-booking__part">
            ${part.label ? `<p class="leg-booking__part-label">${escapeHtml(part.label)}</p>` : ''}
            ${status.text ? `<p class="leg-booking__status leg-booking__status--${status.state}">${LEG_INFO_ICONS.clock()}<span>${escapeHtml(status.text)}</span></p>` : ''}
            ${part.message ? `<p class="leg-booking__message">${linkifyText(part.message, t)}</p>` : ''}
            ${actions.length ? `<div class="leg-booking__actions">${actions.join('')}</div>` : ''}
        </div>`;
}

function flexAvailability(flex: FlexInfo, ctx: LegInfoContext): string | null {
    const start = formatTime(flex.pickup_window_start, ctx);
    const end = formatTime(flex.pickup_window_end, ctx);
    return start && end ? ctx.t('flex.availability', {start, end}) : null;
}

/**
 * Booking card and on-demand service details for a leg. Empty when the leg has
 * neither booking rules nor FLEX information.
 */
export function renderLegBooking(element: ConnectionElement, ctx: LegInfoContext): string {
    const {t} = ctx;
    const parts = getBookingParts(element, t);
    const flex = element.flex;
    if (parts.length === 0 && !flex) return '';

    const flexMeta: string[] = [];
    if (flex) {
        flexMeta.push(escapeHtml(t('flex.label')));
        const availability = flexAvailability(flex, ctx);
        if (availability) flexMeta.push(escapeHtml(availability));
    }

    if (parts.length === 0) {
        // FLEX leg without booking rules: say what we know, and that booking may be needed.
        return `
        <div class="leg-flex">
            ${LEG_INFO_ICONS.info()}
            <p><span class="leg-flex__meta">${flexMeta.join(' · ')}</span> <span class="leg-flex__hint">${escapeHtml(t('flex.bookingHint'))}</span></p>
        </div>`;
    }

    const expired = parts.every(p => getBookingStatus(p.rule, ctx).state === 'expired');
    return `
        <section class="leg-booking${expired ? ' leg-booking--expired' : ''}" aria-label="${escapeHtml(t('booking.sectionLabel'))}">
            <div class="leg-booking__head">
                <span class="leg-booking__icon">${LEG_INFO_ICONS.calendar()}</span>
                <p class="leg-booking__title">${escapeHtml(t('booking.title'))}</p>
                ${flexMeta.length ? `<p class="leg-booking__meta">${flexMeta.join(' · ')}</p>` : ''}
            </div>
            ${parts.map(p => renderBookingPart(p, ctx)).join('')}
        </section>`;
}

/* ------------------------------------------------------------------------ */
/* Connection-level helpers                                                  */
/* ------------------------------------------------------------------------ */

export interface ConnectionNotices {
    alertCount: number;
    maxSeverity: AlertSeverity | null;
    bookingRequired: boolean;
    /** True if every booking-required leg is past its booking deadline */
    bookingExpired: boolean;
    /** Online booking link of the first leg that can still be booked */
    bookingUrl: string | null;
}

export function getConnectionNotices(connection: Connection, ctx: LegInfoContext): ConnectionNotices {
    const keys = new Set<string>();
    let maxSeverity: AlertSeverity | null = null;
    let bookingRequired = false;
    let anyBookable = false;
    let bookingUrl: string | null = null;

    for (const element of connection.connection_elements ?? []) {
        for (const alert of getLegAlerts(element)) {
            keys.add(alertKey(alert));
            const severity = getAlertSeverity(alert);
            if (maxSeverity === null || SEVERITY_RANK[severity] > SEVERITY_RANK[maxSeverity]) maxSeverity = severity;
        }
        for (const part of getBookingParts(element, ctx.t)) {
            bookingRequired = true;
            if (getBookingStatus(part.rule, ctx).state !== 'expired') {
                anyBookable = true;
                bookingUrl = bookingUrl ?? safeHttpUrl(part.rule.booking_url);
            }
        }
    }
    return {
        alertCount: keys.size,
        maxSeverity,
        bookingRequired,
        bookingExpired: bookingRequired && !anyBookable,
        bookingUrl,
    };
}

/** Small status icons for the collapsed connection summary. */
export function renderSummaryBadges(connection: Connection, ctx: LegInfoContext): string {
    const {t} = ctx;
    const notices = getConnectionNotices(connection, ctx);
    const badges: string[] = [];

    if (notices.alertCount > 0 && notices.maxSeverity) {
        const label = notices.alertCount === 1
            ? t('alert.summaryOne')
            : t('alert.summaryMany', {count: String(notices.alertCount)});
        badges.push(`<span class="summary-badge summary-badge--${notices.maxSeverity}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">`
            + `${LEG_INFO_ICONS[notices.maxSeverity]()}${notices.alertCount > 1 ? `<span class="summary-badge__count" aria-hidden="true">${notices.alertCount}</span>` : ''}</span>`);
    }
    if (notices.bookingRequired) {
        const label = notices.bookingExpired ? t('booking.summaryExpired') : t('booking.summary');
        badges.push(`<span class="summary-badge summary-badge--booking${notices.bookingExpired ? ' summary-badge--expired' : ''}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">`
            + `${LEG_INFO_ICONS.calendar()}</span>`);
    }
    return badges.join('');
}

/** "Book trip" call-to-action for the connection details header, if a leg can be booked online. */
export function renderBookingHeaderAction(connection: Connection, ctx: LegInfoContext): string {
    const {bookingUrl} = getConnectionNotices(connection, ctx);
    if (!bookingUrl) return '';
    return `<a class="booking-cta" href="${escapeHtml(bookingUrl)}" target="_blank" rel="noopener noreferrer">`
        + `${LEG_INFO_ICONS.calendar()}<span>${escapeHtml(ctx.t('booking.headerButton'))}</span>`
        + `<span class="visually-hidden"> (${escapeHtml(ctx.t('opensInNewTab'))})</span></a>`;
}
