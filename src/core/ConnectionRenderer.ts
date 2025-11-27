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

import type {
    WidgetConfig,
    WidgetState,
    Connection,
    ConnectionElement
} from '../types';

/**
 * Interface for translation function
 */
export type TranslationFunction = (key: string, replacements?: Record<string, string>) => string;

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

        const mainTransportTypes = [...connection.connection_elements
            .filter(el => el.type === 'JNY')
            .map(el => el.vehicle_type)
        ].filter((t): t is string => t !== undefined);

        if (connection.connection_anytime || (connection.connection_elements.length > 0 && connection.connection_elements.every(el => el.type === 'WALK'))) {
            if (!mainTransportTypes.includes('WALK')) {
                mainTransportTypes.unshift('WALK');
            }
        }

        const iconsHTML = mainTransportTypes.slice(0, 4).map(t => `<span title="${this.getTransportName(t)}" alt="${this.getTransportName(t)}">${this.getTransportIcon(t)}</span>`).join('');

        const isLive = connection.connection_elements && connection.connection_elements.length > 0 && connection.connection_elements.every(el => el.provider === 'live');
        const liveIndicatorHTML = isLive ? `<span class="live-indicator">${this.t('live')}</span>` : '';

        return `
            <div class="summary-line-1">
                <strong>${type === "to" ? this.t("journeyToActivity") + "  " : this.t("journeyFromActivity") + "  "}${startTimeLocal} - ${endTimeLocal}</strong>
                <div class="summary-icons">${iconsHTML}</div>
            </div>
            <div class="summary-line-2">
                ${fromLocation} - ${toLocation}
            </div>
            <div class="summary-line-3">
                <span>${duration} &bull; ${transfers} ${this.t('transfers')}</span>
                ${liveIndicatorHTML}
            </div>
        `;
    }

    /**
     * Renders detailed connection information
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
            const filteredElements = conn.connection_elements;

            if (filteredElements.length === 0) { // If filtering removed all elements (edge case)
                return `<div>${this.t('noConnectionElements')}</div>`;
            }

            const isLive = conn.connection_elements && conn.connection_elements.length > 0 && conn.connection_elements.every(el => el.provider === 'live');
            const liveIndicatorHTML = isLive ? `<div class="live-indicator-details"><span class="live-dot"></span>${this.t('liveConnection')}</div>` : '';

            const ticketButtonHTML = conn.connection_ticketshop_provider ? `
            <button class="ticket-button" data-conn-type="${type}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 12.5C20 11.12 20.83 10 22 10V8C22 6.9 21.1 6 20 6H4C2.9 6 2 6.9 2 8V10C3.17 10 4 11.12 4 12.5C4 13.88 3.17 15 2 15V17C2 18.1 2.9 19 4 19H20C21.1 19 22 18.1 22 17V15C20.83 15 20 13.88 20 12.5ZM11.5 16H9.5V15H11.5V16ZM11.5 14H9.5V13H11.5V14ZM11.5 12H9.5V11H11.5V12ZM11.5 10H9.5V9H11.5V10ZM14.5 16H12.5V15H14.5V16ZM14.5 14H12.5V13H14.5V14ZM14.5 12H12.5V11H14.5V12ZM14.5 10H12.5V9H14.5V10Z"></path></svg>
                ${this.t('buyTicket')} (${conn.connection_ticketshop_provider})
            </button>
            ` : '';

            const headerDetailsHTML = (liveIndicatorHTML || ticketButtonHTML) ? `
            <div class="connection-details-header">
                ${liveIndicatorHTML}
                ${ticketButtonHTML}
            </div>
            ` : '';

            let html = `<div class="connection-details-wrapper">${headerDetailsHTML}<div class="connection-elements">`;

            // Display waiting time after activity ends (for 'from' connections)
            if (type === 'from' && state.activityTimes.end && filteredElements.length > 0) {
                html += this._renderWaitingBlockAfterActivity(filteredElements, state);
            }

            filteredElements.forEach((element, index) => {
                html += this._renderConnectionElement(element, index, filteredElements, type, conn, elements, state.activityTimes.start);
            });

            // Display waiting time before activity starts (for 'to' connections)
            if (type === 'to' && state.activityTimes.start && filteredElements.length > 0) {
                html += this._renderWaitingBlockBeforeActivity(filteredElements, state);
            }

            html += `</div></div>`;
            return html;
        }).join('');
    }

    /**
     * Renders a single connection element
     */
    private _renderConnectionElement(
        element: ConnectionElement,
        index: number,
        filteredElements: ConnectionElement[],
        type: string,
        conn: Connection,
        elements: RendererElements,
        activityStartTime: string
    ): string {
        const departureTime = convertUTCToLocalTime(element.departure_time, this.config.timezone);
        const arrivalTime = convertUTCToLocalTime(element.arrival_time, this.config.timezone);
        const durationDisplayString = calculateTimeDifference(element.departure_time, element.arrival_time, (key) => this.t(key));

        const vehicleType = (element.type !== 'JNY') ? (element.type || 'DEFAULT') : (element.vehicle_type || 'DEFAULT');
        const icon = this.getTransportIcon(vehicleType);
        const transportName = this.getTransportName(vehicleType);

        // Date display logic
        let dateDisplay = '';
        const departureDate = DateTime.fromISO(element.departure_time, {
            zone: this.config.timezone
        }).startOf('day');
        const arrivalDate = DateTime.fromISO(element.arrival_time, {
            zone: this.config.timezone
        }).startOf('day');

        const datesToShow: string[] = [];
        // Show departure date for the first leg
        if (index === 0) {
            datesToShow.push(formatLegDateForDisplay(element.departure_time, this.config.timezone, this.config.language));
        }
        // Show arrival date if it's on a new day
        if (arrivalDate > departureDate) {
            const arrivalDateStr = formatLegDateForDisplay(element.arrival_time, this.config.timezone, this.config.language);
            // Prevent showing the same date twice
            if (!datesToShow.includes(arrivalDateStr)) {
                datesToShow.push(arrivalDateStr);
            }
        }

        if (datesToShow.length > 0) {
            dateDisplay = `<span class="connection-leg-date-display">${datesToShow.join('<br>')}</span>`;
        }

        let fromLocationDisplay = element.from_location;
        if (element.isOriginalFirst) {
            if (type === "to") {
                fromLocationDisplay = elements.originInput?.value ?? '';
            } else { // type === "from"
                fromLocationDisplay = this.config.activityEndLocationDisplayName || this.config.activityEndLocation;
            }
        }

        let html = `
          <div class="connection-element">
            <div class="connection-element-content">
              <div class="element-time-location-group">
                  <span class="element-time">${departureTime}</span>
                  <span class="element-location">${fromLocationDisplay}</span>
                  ${element.platform_orig ? `<span class="element-platform">${this.t("platform")} ${element.platform_orig}</span>` : ''}
              </div>
              <div id="eleCont" ${dateDisplay !== "" ? 'style="margin-right: 70px;"' : ''}>
                <div class="element-circle"></div>
                <span class="element-icon" title="${transportName}" alt="${transportName}">${icon}</span>
                <span class="element-duration">${this.getDurationString(index, type, element, durationDisplayString, conn, elements, activityStartTime)}</span>
              </div>
              ${dateDisplay}
            </div>
            ${this.renderAlert(element)}
          </div>
        `;

        // After the last leg, display the final arrival.
        if (index === filteredElements.length - 1) {
            let toLocationDisplay = element.to_location;
            if (element.isOriginalLast) {
                if (type === "to") {
                    toLocationDisplay = this.config.activityStartLocationDisplayName || this.config.activityStartLocation;
                } else { // type === "from"
                    toLocationDisplay = elements.originInput?.value ?? '';
                }
            }

            html += `
            <div class="connection-element">
              <div class="connection-element-content">
                <div class="element-time-location-group">
                  <span class="element-time">${arrivalTime}</span>
                  <span class="element-location">${toLocationDisplay}</span>
                  ${element.platform_dest ? `<span class="element-platform">${this.t('platform')} ${element.platform_dest}</span>` : ''}
                </div>
                <div class="element-circle-wrapper">
                  <div class="element-circle"></div>
                </div>
              </div>
            </div>
          `;
        }

        return html;
    }

    /**
     * Renders waiting block after activity (for 'from' connections)
     */
    private _renderWaitingBlockAfterActivity(filteredElements: ConnectionElement[], state: WidgetState): string {
        const firstEffectiveLegDepartureISO = filteredElements[0].departure_time;
        const firstLegDepartureDateTime = DateTime.fromISO(firstEffectiveLegDepartureISO, {
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
                return `
                  <div class="connection-element waiting-block">
                      <div class="element-time">
                      <span>${state.activityTimes.end}</span>
                      ${this.t('waiting.afterActivity')}
                      </div>
                      <div id="eleCont">
                      <span class="element-icon" title="${this.t('waiting.title')}" alt="${this.t('waiting.title')}">${this.getTransportIcon('WAIT')}</span>
                      <span class="element-duration">
                          ${waitDuration.text}
                      </span>
                      </div>
                  </div>`;
            }
        }
        return '';
    }

    /**
     * Renders waiting block before activity (for 'to' connections)
     */
    private _renderWaitingBlockBeforeActivity(filteredElements: ConnectionElement[], state: WidgetState): string {
        const lastLegArrivalTimeISO = filteredElements[filteredElements.length - 1].arrival_time;

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
                    return `
                      <div class="connection-element waiting-block">
                          <div class="element-time">
                          <span>${convertUTCToLocalTime(lastLegArrivalTimeISO, this.config.timezone)}</span>
                          ${this.t('waiting.beforeActivity')}
                          </div>
                          <div id="eleCont">
                          <span class="element-icon" title="${this.t('waiting.title')}" alt="${this.t('waiting.title')}">${this.getTransportIcon('WAIT')}</span>
                          <span class="element-duration">
                              ${waitDuration.text}
                          </span>
                          </div>
                      </div>`;
                }
            }
        }
        return '';
    }

    /**
     * Renders alert information for a connection element if alerts are present.
     * @param element - The connection element containing potential alerts.
     * @returns HTML string for the alert display, or empty string if no alerts.
     */
    renderAlert(element: ConnectionElement): string {
        if (!element.alerts || element.alerts.length === 0) {
            return '';
        }

        // Only show the first alert as per requirements
        const alert = element.alerts[0];
        
        const alertIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

        // Escape HTML to prevent XSS, but allow links in description
        const escapeHtml = (text: string | undefined): string => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // Escape for use in HTML attributes (more strict escaping)
        const escapeAttr = (text: string | undefined): string => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        // Convert URLs to clickable links in description
        const linkifyDescription = (text: string | undefined): string => {
            if (!text) return '';
            const escaped = escapeHtml(text);
            // Match URLs and convert to links
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        };

        // Access alert properties - alerts may use title/description or header_text/description_text
        const alertAny = alert as { title?: string; description?: string; header_text?: string; description_text?: string };
        const headerText = alertAny.header_text ? escapeHtml(alertAny.header_text) : (alertAny.title ? escapeHtml(alertAny.title) : '');
        const descriptionText = alertAny.description_text ? linkifyDescription(alertAny.description_text) : (alertAny.description ? linkifyDescription(alertAny.description) : '');

        // Build the alert HTML - using data-expandable class for event delegation
        // Note: Alerts are expanded by default. To revert to collapsed by default,
        // remove "expanded" class from "alert-header-text" and "alert-description" elements below.
        let alertHTML = `
            <div class="connection-element-alert">
                <div class="alert-header">
                    <span class="alert-icon">${alertIcon}</span>
                    <span>${this.t('alert.label')}</span>
                </div>`;

        if (headerText) {
            const titleForAttr = alertAny.header_text || alertAny.title || '';
            alertHTML += `
                <div class="alert-header-text expandable expanded" title="${escapeAttr(titleForAttr)}">${headerText}</div>`;
        }

        if (descriptionText) {
            const descForAttr = alertAny.description_text || alertAny.description || '';
            alertHTML += `
                <div class="alert-description expandable expanded" title="${escapeAttr(descForAttr)}">${descriptionText}</div>`;
        }

        alertHTML += `
            </div>`;

        return alertHTML;
    }

    /**
     * Gets the duration string for a connection element
     */
    getDurationString(_index: number, type: string, element: ConnectionElement, duration: string, conn: Connection, elements: RendererElements, activityStartTime: string): string {
        if (conn && conn.connection_anytime && element.type === "WALK" && conn.connection_elements) {
            const durationMinutes = conn.connection_elements[0].duration ?? 0;
            const durationText = getTimeFormatFromMinutes(durationMinutes, (k) => this.t(k));
            if (type === 'to') {
                if (activityStartTime) {
                    const leaveByTime = DateTime.fromFormat(
                        activityStartTime,
                        'HH:mm',
                        {zone: this.config.timezone}
                    ).minus({
                        minutes: durationMinutes
                    }).toFormat('HH:mm');
                    return `${durationText} - ${this.t('anytimeLeaveBy', { time: leaveByTime })}`;
                }
                return `${durationText}`;
            } else { // type === 'from'
                const destination = elements.originInput?.value ?? '';
                return `${durationText} - ${this.t('anytimeWalkTo', { destination: destination })}`;
            }
        }

        let durationString = "";
        if (element.vehicle_name && element.type === "JNY") {
            const n_intermediate_stops = (element.n_intermediate_stops ?? -1) + 1; // n_intermediate_stops seems to be exclusive of final stop
            const stopString = n_intermediate_stops !== 1 ? `, ${n_intermediate_stops} ${this.t("stopPl")})` : `, ${n_intermediate_stops} ${this.t("stopSg")})`;
            durationString = `${element.vehicle_name} -> ${element.direction} (${duration}`;
            durationString += (n_intermediate_stops > 0) ? `${stopString}` : `)`; // Only add stop string if stops > 0
            return durationString;
        } else {
            durationString = `${duration}`;
        }
        if (element.type === "TRSF") durationString += ` ${this.t("durationTransferTime")}`;
        return durationString;
    }
}
