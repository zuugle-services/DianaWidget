/**
 * transportIcons - One outline icon set for every transport mode and leg type.
 *
 * All icons share a 24x24 grid, a 2px round stroke and `currentColor`, so their colour
 * comes from CSS (accent for transit, muted for transfers) and follows host theming.
 * Shapes follow Lucide (ISC licence); walk, monorail, cog railway, funicular and the
 * fallback are drawn to match.
 */

const svg = (body: string): string =>
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const TRAIN = svg('<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>');
const BUS = svg('<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>');
const TRAM = svg('<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>');
const SUBWAY = svg('<path d="M2 22V12a10 10 0 1 1 20 0v10"/><path d="M15 6.8v1.4a3 2.8 0 1 1-6 0V6.8"/><path d="M10 15h.01"/><path d="M14 15h.01"/><path d="M10 19a4 4 0 0 1-4-4v-3a6 6 0 1 1 12 0v3a4 4 0 0 1-4 4Z"/><path d="m9 19-2 3"/><path d="m15 19 2 3"/>');
// Monorail: a car riding on a single beam held up by a pillar
const MONORAIL = svg('<rect width="14" height="11" x="5" y="3" rx="3"/><path d="M5 8.5h14"/><path d="M9 11.5h.01"/><path d="M15 11.5h.01"/><path d="M2 18h20"/><path d="M12 14v8"/>');
// Cog railway: a car on a slope with the rack's teeth under the rail
const COG_RAILWAY = svg('<path d="M2 22 22 8"/><path d="m4 20.6.9 1.3"/><path d="m8 17.8.9 1.3"/><path d="m12 15 .9 1.3"/><path d="m16 12.2.9 1.3"/><path d="m20 9.4.9 1.3"/><path d="M5 18.4V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5Z"/><path d="M5 9h12"/>');
// Funicular or rack railway (GTFS 7 covers both): a car on a steep track
const FUNICULAR = svg('<path d="M2 22 22 8"/><path d="M5 18.4V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5Z"/><path d="M5 9h12"/>');
const AERIAL_LIFT = svg('<path d="M10 3h.01"/><path d="M14 2h.01"/><path d="m2 9 20-5"/><path d="M12 12V6.5"/><rect width="16" height="10" x="4" y="12" rx="3"/><path d="M9 12v5"/><path d="M15 12v5"/><path d="M4 17h16"/>');
const FERRY = svg('<path d="M12 10.189V14"/><path d="M12 2v3"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>');
// On-demand (Rufbus, Anrufsammeltaxi, GTFS-Flex): a bus you have to call
const ON_DEMAND = svg('<rect width="12" height="12" x="2" y="2" rx="2"/><path d="M2 8h12"/><path d="M5 11h.01"/><path d="M11 11h.01"/><path d="M4.5 14v2"/><path d="M11.5 14v2"/>'
    + '<path stroke-width="4.6" transform="translate(13.4 13) scale(.43)" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>');
const ROUTE = svg('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>');
const SQUARE = svg('<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2 20 7H4Z"/>');
const HOUSE = svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>');
const STREET = svg('<path d="M7 3 3 21"/><path d="m17 3 4 18"/><path d="M12 4v3"/><path d="M12 11v2"/><path d="M12 17v3"/>');
const PARK = svg('<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>');
const WALK = svg('<circle cx="13.5" cy="4.5" r="1.8"/><path d="M12 8 10.5 14 8 21"/><path d="m10.5 14 3 2.5.5 4.5"/><path d="M6.5 11.5 9 8.5 12 8l2.5 3 3 1"/>');
const TRANSFER = svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>');
const WAIT = svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
const ACTIVITY = svg('<rect width="16" height="16" x="4" y="4" rx="4"/><path d="M12 12l2.4-1.2M12 12v3M12 12 9.6 10.8M12 12l2.4 1.2M12 12l-2.4 1.2"/>');
const DEFAULT = svg('<rect width="18" height="18" x="3" y="3" rx="2" stroke-dasharray="3 3"/>');

/** Small arrow in front of a leg's direction. */
export const DIRECTION_ARROW_ICON = svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');

/** Keys are the API vehicle types ("1" train ... "33" park) plus the leg types. */
const TRANSPORT_ICONS: Record<string, string> = {
    1: TRAIN,
    2: BUS,
    3: TRAM,
    4: SUBWAY,
    5: MONORAIL,
    6: COG_RAILWAY,
    7: FUNICULAR,
    8: AERIAL_LIFT,
    9: FERRY,
    10: ON_DEMAND, // only runs when booked
    20: ROUTE, // miscellaneous
    30: HOUSE,
    31: STREET,
    32: SQUARE,
    33: PARK,
    ACTIVITY,
    WALK,
    WALK_BLACK: WALK,
    TRSF: TRANSFER,
    WAIT,
    DEFAULT,
};

/** Inline SVG for a vehicle or leg type; unknown or missing types get the fallback. */
export function getTransportIcon(type: string | number | null | undefined): string {
    return (type != null && TRANSPORT_ICONS[type]) || DEFAULT;
}
