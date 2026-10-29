/**
 * ConnectionRenderer - Handles rendering of connection details and related UI elements
 * 
 * Extracted from widget.ts to improve maintainability
 */

import { DateTime } from 'luxon';
import {
    calculateTimeDifference,
    calculateDurationLocalWithDates,
    convertUTCToLocalTime,
    formatLegDateForDisplay,
    getTimeFormatFromMinutes
} from '../datetimeUtils';
import { DIRECTION_ARROW_ICON } from './transportIcons';

import type {
    WidgetConfig,
    WidgetState,
    Connection,
    ConnectionElement,
    TicketshopSegment
} from '../types';
import {
    escapeHtml,
    hasBooking,
    isUrgentAlert,
    renderLegAlerts,
    renderLegBooking,
    renderSummaryBadges,
    safeHttpUrl,
    type LegInfoContext
} from './legInfo';
import {
    getConnectionRealtime,
    renderDelayHint,
    renderLegArrivalTime,
    renderLegDepartureTime,
    renderLegRealtimeNotices,
    renderPlatform
} from './realtime';

/**
 * Interface for translation function
 */
export type TranslationFunction = (key: string, replacements?: Record<string, string>) => string;

/** How the timeline rail is drawn between two stops */
type RailKind = 'transit' | 'walk' | 'transfer' | 'wait';

/** A ticketshop segment plus its position in `connection_ticketshop_segments` (the API's `segment_index`) */
type TicketSegmentRef = TicketshopSegment & {index?: number};

/** How ticketshop providers are written for travellers */
const PROVIDER_NAMES: Record<string, string> = {
    OEBB: 'ÖBB',
    SBB: 'SBB',
    TRAIVELLING: 'Traivelling',
};

const TICKET_ICON = '<svg class="ticket-button__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20 12.5C20 11.12 20.83 10 22 10V8C22 6.9 21.1 6 20 6H4C2.9 6 2 6.9 2 8V10C3.17 10 4 11.12 4 12.5C4 13.88 3.17 15 2 15V17C2 18.1 2.9 19 4 19H20C21.1 19 22 18.1 22 17V15C20.83 15 20 13.88 20 12.5ZM11.5 16H9.5V15H11.5V16ZM11.5 14H9.5V13H11.5V14ZM11.5 12H9.5V11H11.5V12ZM11.5 10H9.5V9H11.5V10ZM14.5 16H12.5V15H14.5V16ZM14.5 14H12.5V13H14.5V14ZM14.5 12H12.5V11H14.5V12ZM14.5 10H12.5V9H14.5V10Z"></path></svg>';

/**
 * Interface for elements needed by the renderer
 */
export interface RendererElements {
    originInput?: HTMLInputElement | null;
}

/**
 * Configuration for the ConnectionRenderer
 */
export interface ConnectionRendererConfig {
    config: WidgetConfig;
    t: TranslationFunction;
    getTransportIcon: (type: string | number) => string;
    getTransportName: (type: string | number) => string;
}

/**
 * ConnectionRenderer class for rendering connection details
 */
export class ConnectionRenderer {
    private config: WidgetConfig;
    private t: TranslationFunction;
    private getTransportIcon: (type: string | number) => string;
    private getTransportName: (type: string | number) => string;

    constructor(rendererConfig: ConnectionRendererConfig) {
        this.config = rendererConfig.config;
        this.t = rendererConfig.t;
        this.getTransportIcon = rendererConfig.getTransportIcon;
        this.getTransportName = rendererConfig.getTransportName;
    }

    /**
     * Updates the config reference (needed when config changes)
     */
    updateConfig(config: WidgetConfig): void {
        this.config = config;
    }

    /** Context for rendering alerts, booking and on-demand information. */
    private legInfoContext(): LegInfoContext {
        return {
            t: (key, replacements) => this.t(key, replacements),
            timezone: this.config.timezone,
            language: this.config.language,
        };
    }

    /**
     * Renders a compact summary of a connection for the collapsible header.
     * @param connection - The connection object.
     * @param type - 'to' or 'from'.
     * @param elements - DOM elements reference.
     * @returns HTML string for the summary.
     */
    renderConnectionSummary(connection: Connection, type: string, elements: RendererElements): string {
        if (!connection || !connection.connection_elements || connection.connection_elements.length === 0) return '';

        const startTimeLocal = convertUTCToLocalTime(connection.connection_start_timestamp, this.config.timezone);
        const endTimeLocal = convertUTCToLocalTime(connection.connection_end_timestamp, this.config.timezone);
        const duration = calculateTimeDifference(connection.connection_start_timestamp, connection.connection_end_timestamp, (key) => this.t(key));
        const transfers = connection.connection_transfers;

        let fromLocation: string;
        let toLocation: string;

        if (type === 'to') {
            fromLocation = elements.originInput?.value ?? '';
            toLocation = connection.connection_elements[connection.connection_elements.length - 1].to_location ?? '';
        } else { // 'from'
            fromLocation = connection.connection_elements[0].from_location ?? '';
            toLocation = elements.originInput?.value ?? '';
        }

        const mainTransports = connection.connection_elements
            .filter(el => el.type === 'JNY' && el.vehicle_type !== undefined)
            .map(el => ({type: el.vehicle_type as string, realtime: !!el.realtime}));

        if (connection.connection_anytime || (connection.connection_elements.length > 0 && connection.connection_elements.every(el => el.type === 'WALK'))) {
            if (!mainTransports.some(m => m.type === 'WALK')) {
                mainTransports.unshift({type: 'WALK', realtime: false});
            }
        }

        const liveLabel = this.t('realtime.liveData');
        const iconsHTML = mainTransports.slice(0, 4).map(({type: t, realtime}) => {
            const name = realtime ? `${this.getTransportName(t)} · ${liveLabel}` : this.getTransportName(t);
            return `<span class="summary-icon${realtime ? ' summary-icon--live' : ''}" title="${name}" alt="${name}">${this.getTransportIcon(t)}</span>`;
        }).join('');

        const ctx = this.legInfoContext();
        const {departureDelay, arrivalDelay} = getConnectionRealtime(connection);
        const badgesHTML = renderSummaryBadges(connection, ctx);
        const statusHTML = badgesHTML ? `<span class="summary-status">${badgesHTML}</span>` : '';

        return `
            <div class="summary-line-1">
                <strong>${type === "to" ? this.t("journeyToActivity") + "  " : this.t("journeyFromActivity") + "  "}${startTimeLocal}${renderDelayHint(departureDelay, 'departure', ctx)} - ${endTimeLocal}${renderDelayHint(arrivalDelay, 'arrival', ctx)}</strong>
                <div class="summary-icons">${iconsHTML}</div>
            </div>
            <div class="summary-line-2">
                ${fromLocation} - ${toLocation}
            </div>
            <div class="summary-line-3">
                <span>${duration} &bull; ${transfers} ${this.t(transfers === 1 ? 'transferSg' : 'transfers')}</span>
                ${statusHTML}
            </div>
        `;
    }

    /**
     * Renders detailed connection information as a timeline: one row per stop and one
     * row per leg, laid out in a time | rail | content grid so every stop lines up.
     * @param connections - Array of connections to render
     * @param type - 'to' or 'from'
     * @param state - Current widget state
     * @param elements - DOM elements reference
     * @returns HTML string for the connection details
     */
    renderConnectionDetails(connections: Connection[], type: string, state: WidgetState, elements: RendererElements): string {
        if (!connections || connections.length === 0) {
            return `<div>${this.t('noConnectionDetails')}</div>`;
        }

        return connections.map(conn => {
            if (!conn.connection_elements || conn.connection_elements.length === 0) {
                return `<div>${this.t('noConnectionElements')}</div>`;
            }

            // The connection_elements array is now pre-filtered by _processAndFilterConnections.
            const legs = conn.connection_elements;

            if (legs.length === 0) { // If filtering removed all elements (edge case)
                return `<div>${this.t('noConnectionElements')}</div>`;
            }

            const tickets = this._ticketPlan(conn);

            const ctx = this.legInfoContext();
            const rails = legs.map(leg => this._railKind(leg));
            const last = legs.length - 1;

            // Alerts are shown once per connection, at the first leg they apply to.
            const shownAlerts = new Set<string>();

            // A day row goes above the first stop and above every stop on a new day.
            let currentDay = '';
            const dayRow = (iso: string, rail?: RailKind): string => {
                const day = DateTime.fromISO(iso, {zone: 'utc'}).setZone(this.config.timezone).toISODate() ?? '';
                if (day === currentDay) return '';
                currentDay = day;
                const label = formatLegDateForDisplay(iso, this.config.timezone, this.config.language);
                return `
                <li class="journey-day">
                    <span class="journey-time">${label}</span>
                    <span class="journey-marker" aria-hidden="true">${rail ? this._rail(rail) : ''}</span>
                    <span class="journey-body"></span>
                </li>`;
            };

            // Waiting after the activity ends (for 'from' connections)
            const waitBefore = (type === 'from' && state.activityTimes.end) ? this._renderWaitingRowAfterActivity(legs, state) : '';
            // Waiting before the activity starts (for 'to' connections)
            const waitAfter = (type === 'to' && state.activityTimes.start) ? this._renderWaitingRowBeforeActivity(legs, state) : '';

            let html = `<div class="connection-details-wrapper"><ol class="journey connection-elements">`;
            html += dayRow(legs[0].departure_time);
            html += waitBefore;

            legs.forEach((leg, index) => {
                const incoming = index > 0 ? rails[index - 1] : (waitBefore ? 'wait' : undefined);
                html += dayRow(leg.departure_time, incoming);
                html += this._renderStopRow({
                    time: renderLegDepartureTime(leg, legs[index - 1], ctx),
                    name: this._stopName(leg.from_location, index === 0 && leg.isOriginalFirst, 'first', type, elements),
                    platform: renderPlatform(leg.platform_orig, leg.platform_orig_scheduled, ctx),
                    endpoint: index === 0,
                    incoming,
                    outgoing: rails[index],
                    departureCancelled: leg.cancelled,
                });
                const segment = tickets.perSegment ? tickets.segments.find(s => s.leg_from === index) : undefined;
                // A leg with its own booking card already says how to get a ride; a
                // "no online ticket" note above it would read as a contradiction.
                const ticketHTML = segment && (segment.provider || !hasBooking(leg)) ? this._renderSegmentTicket(segment, legs, type) : '';
                html += this._renderLegRow(leg, index, legs, type, conn, elements, state.activityTimes.start, shownAlerts, ticketHTML);
            });

            // After the last leg, display the final arrival.
            const lastLeg = legs[last];
            html += dayRow(lastLeg.arrival_time, rails[last]);
            html += this._renderStopRow({
                time: renderLegArrivalTime(lastLeg, ctx),
                name: this._stopName(lastLeg.to_location, lastLeg.isOriginalLast, 'last', type, elements),
                platform: renderPlatform(lastLeg.platform_dest, lastLeg.platform_dest_scheduled, ctx),
                endpoint: true,
                incoming: rails[last],
                outgoing: waitAfter ? 'wait' : undefined,
            });
            html += waitAfter;

            html += `</ol>`;
            // One ticket for the whole trip: buy it after reading the journey, below the timeline.
            if (tickets.single) html += this._renderJourneyTicket(tickets.single, type);
            html += `</div>`;
            return html;
        }).join('');
    }

    /**
     * Decides where ticket buttons go. A single provider segment gets one button below
     * the timeline; several segments (e.g. Traivelling, which sells no bus legs) get a
     * button, or a "no online ticket" note, at the first leg of each segment.
     */
    private _ticketPlan(conn: Connection): {single?: TicketSegmentRef; perSegment: boolean; segments: TicketSegmentRef[]} {
        const segments: TicketSegmentRef[] = (conn.connection_ticketshop_segments ?? [])
            .map((segment, index) => ({...segment, index}));
        if (segments.length === 0) {
            // Older responses only name the provider; the link then covers the whole trip.
            const provider = conn.connection_ticketshop_provider;
            return provider ? {single: {provider, leg_from: 0, leg_to: (conn.connection_elements?.length ?? 1) - 1}, perSegment: false, segments} : {perSegment: false, segments};
        }
        if (segments.length === 1) {
            return segments[0].provider ? {single: segments[0], perSegment: false, segments} : {perSegment: false, segments};
        }
        return {perSegment: true, segments};
    }

    private _providerName(provider: string): string {
        return PROVIDER_NAMES[provider.toUpperCase()] ?? provider;
    }

    private _ticketButton(segment: TicketSegmentRef, type: string, label: string, modifier: string): string {
        const content = `
                ${TICKET_ICON}
                <span class="ticket-button__label">${escapeHtml(label)} <span class="ticket-button__provider">${escapeHtml(this._providerName(segment.provider as string))}</span></span>`;
        // A segment that already carries its link (a leg's own ticket link) needs no
        // /generate-ticketshop-link call: link to it directly.
        const url = safeHttpUrl(segment.url);
        if (url) {
            return `
            <a class="ticket-button ticket-button--${modifier}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${content}
                <span class="visually-hidden"> (${escapeHtml(this.t('opensInNewTab'))})</span>
            </a>`;
        }
        const segmentAttr = segment.index !== undefined ? ` data-segment-index="${segment.index}"` : '';
        return `
            <button type="button" class="ticket-button ticket-button--${modifier}" data-conn-type="${type}"${segmentAttr}>${content}
            </button>`;
    }

    private _renderJourneyTicket(segment: TicketSegmentRef, type: string): string {
        return `<div class="journey-ticket">${this._ticketButton(segment, type, this.t('buyTicket'), 'block')}</div>`;
    }

    /** Ticket action of one segment, shown at its first leg; names the stop the ticket runs to. */
    private _renderSegmentTicket(segment: TicketSegmentRef, legs: ConnectionElement[], type: string): string {
        if (!segment.provider) {
            return `<p class="journey-leg__no-ticket">${TICKET_ICON}<span>${escapeHtml(this.t('journey.noOnlineTicket'))}</span></p>`;
        }
        // Where the segment's last ride arrives; leg_to can point past the last leg (the
        // API counts a trailing walk it has already dropped), so clamp to the real legs.
        let until = '';
        for (let i = Math.min(segment.leg_to, legs.length - 1); i >= segment.leg_from && !until; i--) {
            if (legs[i].type === 'JNY') until = legs[i].to_location ?? '';
        }
        const label = until ? this.t('journey.ticketUntil', {stop: until}) : this.t('buyTicket');
        return this._ticketButton(segment, type, label, 'inline');
    }

    /** How the rail between two stops is drawn: solid ride, dotted walk, dashed transfer. */
    private _railKind(leg: ConnectionElement): RailKind {
        if (leg.type === 'WALK') return 'walk';
        if (leg.type === 'TRSF') return 'transfer';
        return 'transit';
    }

    private _rail(kind: RailKind, position?: 'top' | 'bottom'): string {
        return `<span class="journey-rail journey-rail--${kind}${position ? ` journey-rail--${position}` : ''}"></span>`;
    }

    /**
     * Display name of a stop. The connection's own start and end are shown as the
     * names the user and the activity know them by, not the routing provider's.
     */
    private _stopName(
        location: string | undefined,
        isOriginalEnd: boolean | undefined,
        end: 'first' | 'last',
        type: string,
        elements: RendererElements
    ): string {
        if (!isOriginalEnd) return escapeHtml(location ?? '');
        // The user's origin is where a 'to' connection starts and a 'from' connection ends.
        if ((type === 'to') === (end === 'first')) return escapeHtml(elements.originInput?.value ?? '');
        return escapeHtml(end === 'first'
            ? (this.config.activityEndLocationDisplayName || this.config.activityEndLocation)
            : (this.config.activityStartLocationDisplayName || this.config.activityStartLocation));
    }

    /** A stop: time, node on the rail, station name and platform. */
    private _renderStopRow(stop: {
        time: string;
        name: string;
        platform: string;
        endpoint: boolean;
        incoming?: RailKind;
        outgoing?: RailKind;
        /** The ride leaving this stop is cancelled: its departure time no longer holds */
        departureCancelled?: boolean;
    }): string {
        const modifiers = (stop.endpoint ? ' journey-stop--endpoint' : '')
            + (stop.departureCancelled ? ' journey-stop--departure-cancelled' : '');
        return `
            <li class="journey-stop${modifiers}">
                <span class="journey-time">${stop.time}</span>
                <span class="journey-marker" aria-hidden="true">
                    ${stop.incoming ? this._rail(stop.incoming, 'top') : ''}
                    <span class="journey-node"></span>
                    ${stop.outgoing ? this._rail(stop.outgoing, 'bottom') : ''}
                </span>
                <span class="journey-body">
                    <span class="journey-station">${stop.name}</span>
                    ${stop.platform}
                </span>
            </li>`;
    }

    /**
     * A leg between two stops: what it is (line, walk or transfer) plus its alerts,
     * booking rules and realtime notices.
     */
    private _renderLegRow(
        leg: ConnectionElement,
        index: number,
        legs: ConnectionElement[],
        type: string,
        conn: Connection,
        elements: RendererElements,
        activityStartTime: string,
        shownAlerts: Set<string>,
        ticketHTML = ''
    ): string {
        const ctx = this.legInfoContext();
        const kind = this._railKind(leg);
        const duration = calculateTimeDifference(leg.departure_time, leg.arrival_time, (key) => this.t(key));

        let content: string;
        if (kind === 'walk') {
            content = this._renderWalk(leg, duration, type, conn, elements, activityStartTime);
        } else if (kind === 'transfer') {
            content = this._renderTransfer(duration, legs[index - 1], legs[index + 1]);
        } else {
            content = this._renderTransit(leg, duration);
        }

        return `
            <li class="journey-leg journey-leg--${kind}${leg.cancelled ? ' journey-leg--cancelled' : ''}">
                <span class="journey-time"></span>
                <span class="journey-marker" aria-hidden="true">${this._rail(kind)}</span>
                <div class="journey-body">
                    ${content}
                    ${ticketHTML}
                    ${renderLegRealtimeNotices(leg, ctx)}
                    ${renderLegAlerts(leg, ctx, shownAlerts, isUrgentAlert)}
                    ${renderLegBooking(leg, ctx)}
                    ${renderLegAlerts(leg, ctx, shownAlerts, alert => !isUrgentAlert(alert))}
                </div>
            </li>`;
    }

    /** Transit leg: "Zug WB 1000", "→ Wien Hauptbahnhof", "1:19h · 3 stops". */
    private _renderTransit(leg: ConnectionElement, duration: string): string {
        const vehicleType = (leg.type !== 'JNY') ? (leg.type || 'DEFAULT') : (leg.vehicle_type || 'DEFAULT');
        const transportName = leg.flex ? this.t('flex.label') : this.getTransportName(vehicleType);
        const lineName = (leg.vehicle_name ?? '').trim();
        // Providers often name the line with its mode already ("Bus 341"); don't say it twice.
        let title = transportName;
        if (lineName) {
            title = lineName.toLowerCase().startsWith(transportName.toLowerCase()) ? lineName : `${transportName} ${lineName}`;
        }

        const meta = [duration];
        const stops = (leg.n_intermediate_stops ?? -1) + 1; // n_intermediate_stops seems to be exclusive of final stop
        if (stops > 0) meta.push(`${stops} ${this.t(stops === 1 ? 'stopSg' : 'stopPl')}`);

        const direction = leg.direction ? `
                <span class="journey-leg__direction">${DIRECTION_ARROW_ICON}<span aria-hidden="true">${escapeHtml(leg.direction)}</span><span class="visually-hidden">${escapeHtml(this.t('journey.towards', {direction: leg.direction}))}</span></span>
                <span class="journey-leg__sep" aria-hidden="true">·</span>` : '';

        return `
            <p class="journey-leg__title">
                <span class="journey-leg__icon" title="${escapeHtml(transportName)}">${this.getTransportIcon(vehicleType)}</span>
                <span class="journey-leg__name">${escapeHtml(title)}</span>
            </p>
            <p class="journey-leg__meta">${direction}
                <span class="journey-leg__stats">${meta.join(' · ')}</span>
            </p>`;
    }

    /** Walk leg: "Walk (17 min)", for anytime connections with when to leave / where to. */
    private _renderWalk(
        leg: ConnectionElement,
        duration: string,
        type: string,
        conn: Connection,
        elements: RendererElements,
        activityStartTime: string
    ): string {
        let durationText = duration;
        let hint = '';
        if (conn.connection_anytime && conn.connection_elements) {
            const durationMinutes = conn.connection_elements[0].duration ?? 0;
            durationText = getTimeFormatFromMinutes(durationMinutes, (k) => this.t(k));
            if (type === 'to') {
                if (activityStartTime) {
                    const leaveByTime = DateTime.fromFormat(activityStartTime, 'HH:mm', {zone: this.config.timezone})
                        .minus({minutes: durationMinutes})
                        .toFormat('HH:mm');
                    hint = this.t('anytimeLeaveBy', {time: leaveByTime});
                }
            } else { // type === 'from'
                hint = this.t('anytimeWalkTo', {destination: elements.originInput?.value ?? ''});
            }
        }

        return `
            <p class="journey-leg__title">
                <span class="journey-leg__icon">${this.getTransportIcon(leg.type)}</span>
                <span class="journey-leg__name">${escapeHtml(this.getTransportName('WALK'))} (${durationText})</span>
            </p>
            ${hint ? `<p class="journey-leg__meta">${escapeHtml(hint)}</p>` : ''}`;
    }

    /** Transfer: "Transfer (5 min), from platform 3 to platform 5" in one quiet line. */
    private _renderTransfer(duration: string, previous?: ConnectionElement, next?: ConnectionElement): string {
        const from = previous?.type === 'JNY' ? previous.platform_dest : undefined;
        const to = next?.type === 'JNY' ? next.platform_orig : undefined;
        let platforms = '';
        if (from && to) platforms = this.t('journey.platformFromTo', {from, to});
        else if (from) platforms = this.t('journey.platformFrom', {from});
        else if (to) platforms = this.t('journey.platformTo', {to});

        return `
            <p class="journey-leg__title">
                <span class="journey-leg__icon">${this.getTransportIcon('TRSF')}</span>
                <span class="journey-leg__name">${escapeHtml(this.getTransportName('TRSF'))} (${duration})${platforms ? `, ${escapeHtml(platforms)}` : ''}</span>
            </p>`;
    }

    /** Waiting row between the activity's end and the first departure (for 'from' connections). */
    private _renderWaitingRowAfterActivity(legs: ConnectionElement[], state: WidgetState): string {
        const firstLegDepartureDateTime = DateTime.fromISO(legs[0].departure_time, {
            zone: 'utc'
        }).setZone(this.config.timezone);

        // Construct activity end time, assuming it's on the same day as the return journey starts
        let activityEndDateTime = DateTime.fromFormat(state.activityTimes.end, 'HH:mm', {
            zone: this.config.timezone
        })
            .set({
                year: firstLegDepartureDateTime.year,
                month: firstLegDepartureDateTime.month,
                day: firstLegDepartureDateTime.day
            });

        if (activityEndDateTime > firstLegDepartureDateTime) {
            activityEndDateTime = activityEndDateTime.minus({
                days: 1
            });
        }

        if (activityEndDateTime.isValid && firstLegDepartureDateTime.isValid && firstLegDepartureDateTime > activityEndDateTime) {
            const waitDuration = calculateDurationLocalWithDates(activityEndDateTime, firstLegDepartureDateTime, (key) => this.t(key));
            if (waitDuration.totalMinutes > 0) {
                return this._renderWaitingRow(state.activityTimes.end, this.t('waiting.afterActivity'), waitDuration.text, 'bottom');
            }
        }
        return '';
    }

    /** Waiting row between the last arrival and the activity's start (for 'to' connections). */
    private _renderWaitingRowBeforeActivity(legs: ConnectionElement[], state: WidgetState): string {
        const lastLegArrivalTimeISO = legs[legs.length - 1].arrival_time;

        if (lastLegArrivalTimeISO) { // Ensure lastLegArrivalTimeISO is valid
            const connectionEndDateTime = DateTime.fromISO(lastLegArrivalTimeISO, {zone: 'utc'}).setZone(this.config.timezone);
            // Ensure activityActualStartDateTime is on the same day as connectionEndDateTime for correct diff
            let activityActualStartDateTime = DateTime.fromFormat(state.activityTimes.start, 'HH:mm', {zone: this.config.timezone})
                .set({
                    year: connectionEndDateTime.year,
                    month: connectionEndDateTime.month,
                    day: connectionEndDateTime.day
                });

            if (activityActualStartDateTime < connectionEndDateTime) {
                activityActualStartDateTime = activityActualStartDateTime.plus({days: 1});
            }

            if (connectionEndDateTime.isValid && activityActualStartDateTime.isValid && activityActualStartDateTime > connectionEndDateTime) {
                const waitDuration = calculateDurationLocalWithDates(connectionEndDateTime, activityActualStartDateTime, (key) => this.t(key));
                if (waitDuration.totalMinutes > 0) { // Only show if there's actual waiting time
                    return this._renderWaitingRow(state.activityTimes.start, this.t('waiting.beforeActivity'), waitDuration.text, 'top');
                }
            }
        }
        return '';
    }

    /** The activity end of the timeline: its time, a muted node and how long the wait is. */
    private _renderWaitingRow(time: string, label: string, duration: string, railPosition: 'top' | 'bottom'): string {
        return `
            <li class="journey-wait">
                <span class="journey-time">${time}</span>
                <span class="journey-marker" aria-hidden="true">
                    ${railPosition === 'top' ? this._rail('wait', 'top') : ''}
                    <span class="journey-node"></span>
                    ${railPosition === 'bottom' ? this._rail('wait', 'bottom') : ''}
                </span>
                <span class="journey-body">
                    <span class="journey-leg__title">
                        <span class="journey-leg__icon" title="${escapeHtml(this.t('waiting.title'))}">${this.getTransportIcon('WAIT')}</span>
                        <span class="journey-leg__name">${escapeHtml(label)}</span>
                    </span>
                    <span class="journey-leg__meta">${duration}</span>
                </span>
            </li>`;
    }
}
