import { getTransportIcon } from '../../core/transportIcons';

/**
 * Leading glyphs for address-autocomplete rows.
 *
 * The geocoder classifies every suggestion as either a public-transport stop or an
 * address (`diana_properties.location_type`, "station" | "address" — see the Photon
 * provider in DianaProxy), which is exactly the distinction worth showing: a station
 * symbol or a map pin.
 *
 * Stations reuse the train from `getTransportIcon()` (core/transportIcons.ts), so the
 * dropdown and the connection details draw a station the same way. All glyphs follow the
 * dropdown's text colour.
 */

/** Public-transport stop: the same train as the connection details (transportIcons). */
const STATION_ICON = getTransportIcon(1);

/** Anything else: a map pin. */
const PIN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`;

/** Clock, for a starting point the user picked before. */
const RECENT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>`;

/**
 * Returns the inline SVG for a suggestion's location type.
 * Falls back to the pin for unknown or missing types, so a geocoder change can never
 * leave a row without an icon.
 *
 * @param locationType - `diana_properties.location_type` of the suggestion.
 * @returns An inline SVG string, sized 16x16 and drawn in `currentColor`.
 */
export function getLocationTypeIconHTML(locationType?: string | null): string {
    if (locationType === 'recent') return RECENT_ICON;
    return locationType === 'station' ? STATION_ICON : PIN_ICON;
}
