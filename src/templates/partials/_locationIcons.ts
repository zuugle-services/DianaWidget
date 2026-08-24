/**
 * Leading glyphs for address-autocomplete rows.
 *
 * The geocoder classifies every suggestion as either a public-transport stop or an
 * address (`diana_properties.location_type`, "station" | "address" — see the Photon
 * provider in DianaProxy), which is exactly the distinction worth showing: a station
 * symbol or a map pin.
 *
 * Deliberately not reusing `getTransportIcon()` from widget.ts: its icons hard-code
 * their own fills (green for vehicles, black for streets), whereas a dropdown row must
 * follow the surrounding text colour in both light and dark consumer themes.
 */

/** Public-transport stop: vehicle body on two wheels. */
const STATION_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><rect x="5" y="3" width="14" height="13" rx="3"></rect><line x1="5" y1="10" x2="19" y2="10"></line><circle cx="8.5" cy="19" r="1.5"></circle><circle cx="15.5" cy="19" r="1.5"></circle><line x1="8" y1="16" x2="6.5" y2="18"></line><line x1="16" y1="16" x2="17.5" y2="18"></line></svg>`;

/** Anything else: a map pin. */
const PIN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`;

/**
 * Returns the inline SVG for a suggestion's location type.
 * Falls back to the pin for unknown or missing types, so a geocoder change can never
 * leave a row without an icon.
 *
 * @param locationType - `diana_properties.location_type` of the suggestion.
 * @returns An inline SVG string, sized 16x16 and drawn in `currentColor`.
 */
export function getLocationTypeIconHTML(locationType?: string | null): string {
    return locationType === 'station' ? STATION_ICON : PIN_ICON;
}
