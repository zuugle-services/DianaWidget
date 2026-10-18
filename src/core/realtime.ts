/**
 * realtime - Live data of connection legs: delays, platform changes, cancellations.
 *
 * Realtime is reported per leg by the API (`ConnectionElement.realtime`); there is
 * no connection-level live flag. `departure_time` / `arrival_time` are always the
 * actual times, the timetable values come along only for realtime legs.
 *
 * Pure string rendering (no DOM access), like legInfo.ts.
 */

import { convertUTCToLocalTime } from '../datetimeUtils';
import type { Connection, ConnectionElement } from '../types';
import { escapeHtml, LEG_INFO_ICONS, type LegInfoContext } from './legInfo';

/** ontime: early or at most 1 min late, minor: 2-4 min, major: 5+ min */
export type DelayLevel = 'ontime' | 'minor' | 'major';

export function getDelayLevel(delay: number | undefined): DelayLevel {
    if (delay === undefined || delay <= 1) return 'ontime';
    return delay < 5 ? 'minor' : 'major';
}

const hidden = (text: string): string => `<span class="visually-hidden">${escapeHtml(text)}</span>`;

/**
 * Renders a clock time. Without live data this is the plain time. With live data the
 * time is coloured by delay, and a changed time shows the struck-through timetable time.
 */
export function renderRealtimeTime(
    actualIso: string,
    scheduledIso: string | undefined,
    delay: number | undefined,
    realtime: boolean,
    ctx: LegInfoContext
): string {
    const actual = convertUTCToLocalTime(actualIso, ctx.timezone);
    if (!realtime) return actual;

    const scheduled = scheduledIso ? convertUTCToLocalTime(scheduledIso, ctx.timezone) : actual;
    const level = getDelayLevel(delay);
    if (scheduled === actual) {
        return `<span class="rt-time rt-time--${level}">${actual}${hidden(`, ${ctx.t('realtime.onTime')}`)}</span>`;
    }
    return `<span class="rt-time rt-time--${level}">`
        + `<s class="rt-time__scheduled" aria-hidden="true">${scheduled}</s>`
        + `<span class="rt-time__actual" aria-hidden="true">${actual}</span>`
        + hidden(ctx.t('realtime.timeChanged', {scheduled, actual}))
        + `</span>`;
}

/**
 * Departure time of a leg row. A walk or transfer that starts right where a realtime
 * leg ends shows that leg's arrival, so the arrival delay at a transfer stays visible.
 */
export function renderLegDepartureTime(
    element: ConnectionElement,
    previous: ConnectionElement | undefined,
    ctx: LegInfoContext
): string {
    if (element.realtime) {
        return renderRealtimeTime(element.departure_time, element.departure_time_scheduled, element.departure_delay, true, ctx);
    }
    if (previous?.realtime && previous.arrival_time === element.departure_time) {
        return renderRealtimeTime(element.departure_time, previous.arrival_time_scheduled, previous.arrival_delay, true, ctx);
    }
    return renderRealtimeTime(element.departure_time, undefined, undefined, false, ctx);
}

/** Arrival time of a leg (used for the final arrival row). */
export function renderLegArrivalTime(element: ConnectionElement, ctx: LegInfoContext): string {
    return renderRealtimeTime(element.arrival_time, element.arrival_time_scheduled, element.arrival_delay, !!element.realtime, ctx);
}

/** Platform badge; a live platform change shows the struck-through timetable platform. */
export function renderPlatform(current: string | undefined, scheduled: string | undefined, ctx: LegInfoContext): string {
    if (!current) return '';
    const label = escapeHtml(ctx.t('platform'));
    if (!scheduled || scheduled === current) {
        return `<span class="element-platform">${label} ${escapeHtml(current)}</span>`;
    }
    return `<span class="element-platform element-platform--changed">${label} `
        + `<s aria-hidden="true">${escapeHtml(scheduled)}</s> <span aria-hidden="true">${escapeHtml(current)}</span>`
        + hidden(ctx.t('realtime.platformChanged', {scheduled, actual: current}))
        + `</span>`;
}

function notice(severity: 'info' | 'severe', title: string, text?: string): string {
    return `
        <li class="leg-notice leg-notice--${severity}">
            <span class="leg-notice__icon">${LEG_INFO_ICONS[severity]()}</span>
            <div class="leg-notice__body">
                <p class="leg-notice__title">${escapeHtml(title)}</p>
                ${text ? `<p class="leg-notice__text">${escapeHtml(text)}</p>` : ''}
            </div>
        </li>`;
}

/** Notices for a cancelled trip or an additional service. */
export function renderLegRealtimeNotices(element: ConnectionElement, ctx: LegInfoContext): string {
    const items: string[] = [];
    if (element.cancelled) {
        items.push(notice('severe', ctx.t('realtime.cancelled'), ctx.t('realtime.cancelledText')));
    } else if (element.additional_service) {
        items.push(notice('info', ctx.t('realtime.additionalService')));
    }
    return items.length ? `<ul class="leg-notices">${items.join('')}</ul>` : '';
}

export interface ConnectionRealtime {
    /** Departure delay of the first transit leg, if it has live data */
    departureDelay?: number;
    /** Arrival delay of the last transit leg, if it has live data */
    arrivalDelay?: number;
}

/**
 * Delays at the connection's ends. Walks around the transit legs are never realtime,
 * but their times move with the transit legs, so the first / last transit leg decides.
 */
export function getConnectionRealtime(connection: Connection): ConnectionRealtime {
    const transit = (connection.connection_elements ?? []).filter(el => el.type === 'JNY');
    const first = transit[0];
    const last = transit[transit.length - 1];
    return {
        departureDelay: first?.realtime ? first.departure_delay : undefined,
        arrivalDelay: last?.realtime ? last.arrival_delay : undefined,
    };
}

/** Compact "+5" hint next to a summary time; empty when on schedule or unknown. */
export function renderDelayHint(delay: number | undefined, kind: 'departure' | 'arrival', ctx: LegInfoContext): string {
    if (!delay) return '';
    const minutes = String(Math.abs(delay));
    const text = delay > 0 ? `+${minutes}` : `−${minutes}`;
    const label = ctx.t(`realtime.${kind}${delay > 0 ? 'Late' : 'Early'}`, {minutes});
    return `<span class="rt-delay rt-delay--${getDelayLevel(delay)}" title="${escapeHtml(label)}">`
        + `<span aria-hidden="true">${text}</span>${hidden(label)}</span>`;
}
