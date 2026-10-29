/**
 * Unit tests for leg passenger information: alert rendering, link detection,
 * booking rules and on-demand (FLEX) details.
 */
import { DateTime } from 'luxon';

import {
    escapeHtml,
    formatUrlLabel,
    getAlertSeverity,
    getBookingStatus,
    getConnectionNotices,
    getLegAlerts,
    isUrgentAlert,
    linkifyText,
    renderLegAlerts,
    renderLegBooking,
    renderSummaryBadges,
    safeHttpUrl,
    telHref,
    type LegInfoContext,
} from '../core/legInfo';
import translations from '../translations';
import type { Connection, ConnectionElement, Language } from '../types';

function makeT(language: Language = 'EN') {
    return (key: string, replacements: Record<string, string> = {}): string => {
        const lookup = (root: unknown) => key.split('.').reduce<unknown>(
            (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), root);
        let text = (lookup(translations[language]) ?? lookup(translations.EN) ?? `[${key}]`) as string;
        for (const [k, v] of Object.entries(replacements)) text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        return text;
    };
}

function ctx(overrides: Partial<LegInfoContext> = {}): LegInfoContext {
    return {
        t: makeT(),
        timezone: 'Europe/Vienna',
        language: 'EN',
        now: DateTime.fromISO('2026-10-18T08:00:00Z'),
        ...overrides,
    };
}

function leg(overrides: Partial<ConnectionElement> = {}): ConnectionElement {
    return {
        type: 'JNY',
        departure_time: '2026-10-19T07:12:00Z',
        arrival_time: '2026-10-19T07:33:00Z',
        from_location: 'Talstation',
        to_location: 'Bergstation',
        ...overrides,
    };
}

function connection(elements: ConnectionElement[]): Connection {
    return {
        connection_id: 0,
        connection_elements: elements,
        connection_start_timestamp: elements[0].departure_time,
        connection_end_timestamp: elements[elements.length - 1].arrival_time,
    } as unknown as Connection;
}

/** Strips tags and decodes the few entities escapeHtml produces. */
function textOf(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

describe('escaping and URL helpers', () => {
    test('escapeHtml escapes markup and quotes', () => {
        expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('safeHttpUrl only accepts absolute http(s) URLs', () => {
        expect(safeHttpUrl(' https://example.org/a?b=1 ')).toBe('https://example.org/a?b=1');
        expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
        expect(safeHttpUrl('//evil.example')).toBeNull();
        expect(safeHttpUrl('https://x.org/"onmouseover=1')).toBeNull();
        expect(safeHttpUrl(undefined)).toBeNull();
    });

    test('telHref normalises written phone numbers', () => {
        expect(telHref('+43 50 422 422')).toBe('tel:+4350422422');
        expect(telHref('05556 74104')).toBe('tel:0555674104');
        expect(telHref('+43 (0) 3613 21 000 99')).toBe('tel:+43036132100099');
    });

    test('formatUrlLabel shortens URLs for display', () => {
        expect(formatUrlLabel('https://www.stubai.at/skigebiete/elferbahnen/')).toBe('stubai.at/skigebiete/elferbahnen');
        expect(formatUrlLabel('https://blaguss.com/reiseangebot/mit-dem-bus-zum-schnee#c4628', 30)).toHaveLength(30);
    });
});

describe('linkifyText', () => {
    const t = makeT();

    test('links URLs, bare domains, phone numbers and e-mail addresses in real feed texts', () => {
        const html = linkifyText('Anmeldung unter Homepage: alpbus.grosseswalsertal.at, bis 20:00 Uhr am Vortag, '
            + 'oder telefonisch unter +43 50 422 422 oder info@example.at.', t);
        expect(html).toContain('href="https://alpbus.grosseswalsertal.at"');
        expect(html).toContain('href="tel:+4350422422"');
        expect(html).toContain('href="mailto:info@example.at"');
        // trailing punctuation stays outside the link
        expect(html).toContain('</a>, bis 20:00');
        expect(html).toMatch(/info@example\.at<\/a>\.$/);
    });

    test('keeps the text otherwise intact', () => {
        const input = 'Fahrten müssen mit der App oder telefonisch unter 0800 80 88 08 oder 04352 45000 gebucht werden. '
            + 'Komfortzuschlag in Höhe von € 2,- (Stand: 01.10.2025), Betrieb von 8 bis 19 Uhr, 12:00 bis 18:00.';
        const html = linkifyText(input, t);
        expect(textOf(html).replace(/ \(opens in a new tab\)/g, '')).toBe(input);
        expect(html).toContain('href="tel:0800808808"');
        expect(html).toContain('href="tel:0435245000"');
        // Dates, prices and times are not phone numbers
        expect((html.match(/href="tel:/g) ?? []).length).toBe(2);
    });

    test('does not link abbreviations or numbers inside dates', () => {
        const html = linkifyText('z.B. St.Anton, bzw. ca. 5 km, Stand 01.10.2025, Nr. 2026 0815', t);
        expect(html).not.toContain('<a');
    });

    test('explicit URLs get a readable label and open in a new tab', () => {
        const html = linkifyText('https://www.pitztaler-gletscher.at/', t);
        expect(html).toContain('href="https://www.pitztaler-gletscher.at/"');
        expect(html).toContain('target="_blank" rel="noopener noreferrer"');
        expect(html).toContain('>pitztaler-gletscher.at<');
        expect(html).toContain('opens in a new tab');
    });

    test('escapes markup in untrusted text', () => {
        const html = linkifyText('<script>alert(1)</script> "x" https://a.example/?q=<b>', t);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('href="https://a.example/?q="');
    });

    test('preserves line breaks for pre-line rendering', () => {
        expect(linkifyText('Zeile 1\nZeile 2', t)).toBe('Zeile 1\nZeile 2');
    });
});

describe('alerts', () => {
    test('severity comes from the backend, with an effect-based fallback', () => {
        expect(getAlertSeverity({severity: 'warning', effect: 'OTHER_EFFECT'})).toBe('warning');
        expect(getAlertSeverity({effect: 'NO_SERVICE'})).toBe('severe');
        expect(getAlertSeverity({effect: 'DETOUR'})).toBe('warning');
        expect(getAlertSeverity({effect: 'OTHER_EFFECT'})).toBe('info');
        expect(getAlertSeverity({})).toBe('info');
    });

    test('getLegAlerts drops empty and duplicate alerts and sorts by severity', () => {
        const alerts = getLegAlerts(leg({
            alerts: [
                {severity: 'info', description_text: 'Ticket notwendig!'},
                {severity: 'info', description_text: 'Ticket notwendig!'},
                {severity: 'info', header_text: ' ', description_text: ''},
                {severity: 'severe', header_text: 'Fällt aus'},
            ],
        }));
        expect(alerts.map(a => a.header_text || a.description_text)).toEqual(['Fällt aus', 'Ticket notwendig!']);
    });

    test('renders an accessible notice list with severity label, title and description', () => {
        const html = renderLegAlerts(leg({
            alerts: [{
                severity: 'warning', header_text: 'Umleitung', description_text: 'Wegen Bauarbeiten.',
                scope: 'departure_stop', stop_name: 'Talstation', url: 'https://example.org/info',
                impact_period: [{start: '2026-10-01T00:00:00Z', end: '2026-10-31T00:00:00Z'}],
            }],
        }), ctx());
        expect(html).toContain('<ul class="leg-notices" role="list" aria-label="Notices for this leg">');
        expect(html).toContain('leg-notice--warning');
        expect(html).toContain('Service change');
        expect(html).toContain('Stop Talstation');
        expect(html).toContain('<p class="leg-notice__title">Umleitung</p>');
        expect(html).toContain('Wegen Bauarbeiten.');
        expect(html).toContain('href="https://example.org/info"');
        expect(html).toContain('More information');
        expect(html).toContain('1 Oct 2026 – 31 Oct 2026');
        expect(html).not.toContain('leg-notice__toggle');
    });

    test('long descriptions are clamped with an accessible toggle', () => {
        const text = 'Fahrten müssen mit der Pustbus Shuttle-App oder telefonisch gebucht werden. '.repeat(4);
        const html = renderLegAlerts(leg({alerts: [{description_text: text}]}), ctx());
        const id = html.match(/id="(leg-notice-text-\d+)"/)?.[1];
        expect(id).toBeTruthy();
        expect(html).toContain('is-clamped');
        expect(html).toContain(`aria-controls="${id}"`);
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('data-label-less="Show less"');
    });

    test('a description that only repeats the URL is not shown twice', () => {
        const html = renderLegAlerts(leg({alerts: [{description_text: 'https://x.example/a', url: 'https://x.example/a'}]}), ctx());
        expect(html).not.toContain('leg-notice__text');
        expect(html).toContain('More information');
    });

    test('unsafe alert URLs are ignored', () => {
        const html = renderLegAlerts(leg({alerts: [{header_text: 'x', url: 'javascript:alert(1)'}]}), ctx());
        expect(html).not.toContain('javascript:');
    });

    test('alerts are shown once per connection', () => {
        const seen = new Set<string>();
        const a = leg({alerts: [{description_text: 'Die Fahrten aller Alpbusse erfolgen nur auf Anmeldung'}]});
        const b = leg({alerts: [{description_text: 'Die Fahrten aller Alpbusse erfolgen nur auf Anmeldung'}]});
        expect(renderLegAlerts(a, ctx(), seen)).toContain('leg-notice');
        expect(renderLegAlerts(b, ctx(), seen)).toBe('');
    });

    test('uses the widget language', () => {
        const html = renderLegAlerts(leg({alerts: [{severity: 'info', description_text: 'x'}]}), ctx({t: makeT('DE'), language: 'DE'}));
        expect(html).toContain('Hinweis');
        expect(html).toContain('Hinweise zu diesem Abschnitt');
    });

    test('no alerts, no markup', () => {
        expect(renderLegAlerts(leg(), ctx())).toBe('');
        expect(renderLegAlerts(leg({alerts: []}), ctx())).toBe('');
    });
});

describe('booking', () => {
    const rule = {
        booking_type: 'prior_days' as const,
        message: 'Anmeldung am Vortag bis 17:00 Uhr unter +43 50 422 422.',
        phone_number: '+43 50 422 422',
        booking_url: 'https://book.example/rudi',
        info_url: 'https://info.example/rudi',
        latest_booking_time: '2026-10-18T15:00:00Z',
    };

    test('booking status: open, not yet open, expired, real time', () => {
        const c = ctx({now: DateTime.fromISO('2026-10-18T08:00:00Z')});
        expect(getBookingStatus(rule, c)).toEqual({state: 'open', text: 'Book by Sun 18 Oct, 17:00'});
        expect(getBookingStatus(rule, ctx({now: DateTime.fromISO('2026-10-18T15:00:01Z')})).state).toBe('expired');
        expect(getBookingStatus({...rule, earliest_booking_time: '2026-10-18T10:00:00Z'}, c))
            .toEqual({state: 'not_yet_open', text: 'Booking opens Sun 18 Oct, 12:00'});
        expect(getBookingStatus({booking_type: 'real_time', latest_booking_time: '2026-10-19T07:12:00Z'}, c))
            .toEqual({state: 'open', text: 'Bookable until departure'});
        expect(getBookingStatus({message: 'x'}, c)).toEqual({state: 'open', text: null});
    });

    test('renders a booking card with deadline, message and actions', () => {
        const html = renderLegBooking(leg({booking: {pickup: rule}}), ctx());
        expect(html).toContain('<section class="leg-booking" aria-label="Booking">');
        expect(html).toContain('Booking required');
        expect(html).toContain('Book by Sun 18 Oct, 17:00');
        expect(html).toContain('href="https://book.example/rudi"');
        expect(html).toContain('href="tel:+4350422422"');
        expect(html).toContain('aria-label="Call +43 50 422 422"');
        expect(html).toContain('href="https://info.example/rudi"');
        expect(html).not.toContain('leg-booking__part-label');
    });

    test('expired booking hides the online booking button and is marked', () => {
        const html = renderLegBooking(leg({booking: {pickup: rule}}), ctx({now: DateTime.fromISO('2026-10-19T06:00:00Z')}));
        expect(html).toContain('leg-booking--expired');
        expect(html).toContain('Too late! Book by Sun 18 Oct, 17:00');
        expect(html).not.toContain('book.example');
        expect(html).toContain('tel:+4350422422');
    });

    test('different pickup and drop-off rules are shown separately, identical ones once', () => {
        const pickup = {booking_type: 'same_day' as const, pickup_message: 'Abholung anmelden', latest_booking_time: '2026-10-19T06:12:00Z'};
        const dropOff = {booking_type: 'real_time' as const, drop_off_message: 'Ausstieg auf Wunsch'};
        const both = renderLegBooking(leg({booking: {pickup, drop_off: dropOff}}), ctx());
        expect(both).toContain('Boarding');
        expect(both).toContain('Alighting');
        expect(both).toContain('Abholung anmelden');
        expect(both).toContain('Ausstieg auf Wunsch');

        const same = {booking_type: 'same_day' as const, message: 'Bitte anrufen', phone_number: '0800 123456'};
        const merged = renderLegBooking(leg({booking: {pickup: same, drop_off: same}}), ctx());
        expect(merged).not.toContain('Boarding');
        expect((merged.match(/Bitte anrufen/g) ?? []).length).toBe(1);
    });

    test('unsafe booking URLs are not rendered', () => {
        const html = renderLegBooking(leg({booking: {pickup: {booking_url: 'javascript:alert(1)', info_url: 'data:text/html,x', message: 'm'}}}), ctx());
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('data:text');
    });

    test('FLEX leg without booking rules shows availability and a booking hint', () => {
        const html = renderLegBooking(leg({
            vehicle_type: '10',
            flex: {name: 'RUDI', pickup_window_start: '2026-10-19T06:00:00Z', pickup_window_end: '2026-10-19T19:30:00Z'},
        }), ctx());
        expect(html).toContain('leg-flex');
        expect(html).toContain('On-demand service · Available 08:00–21:30');
        expect(html).toContain('Booking with the operator may be required.');
    });

    test('FLEX leg with booking rules shows the service details in the card', () => {
        const html = renderLegBooking(leg({
            flex: {name: 'RUDI', pickup_window_start: '2026-10-19T06:00:00Z', pickup_window_end: '2026-10-19T19:30:00Z'},
            booking: {pickup: rule},
        }), ctx());
        expect(html).toContain('leg-booking__meta');
        expect(html).toContain('On-demand service · Available 08:00–21:30');
        expect(html).not.toContain('leg-flex__hint');
    });

    test('nothing to show without booking or flex data', () => {
        expect(renderLegBooking(leg(), ctx())).toBe('');
        expect(renderLegBooking(leg({booking: {}}), ctx())).toBe('');
    });
});

describe('connection summary and header action', () => {
    const bookingLeg = leg({booking: {pickup: {booking_type: 'same_day', booking_url: 'https://book.example', latest_booking_time: '2026-10-19T06:00:00Z'}}});

    test('counts unique alerts and the highest severity', () => {
        const conn = connection([
            leg({alerts: [{severity: 'info', description_text: 'A'}, {severity: 'warning', header_text: 'B'}]}),
            leg({alerts: [{severity: 'info', description_text: 'A'}]}),
            bookingLeg,
        ]);
        expect(getConnectionNotices(conn, ctx())).toEqual({
            alertCount: 2, maxSeverity: 'warning', bookingRequired: true, bookingExpired: false, bookingUrl: 'https://book.example',
        });
    });

    test('summary badges are labelled for assistive technology', () => {
        const html = renderSummaryBadges(connection([leg({alerts: [{description_text: 'A'}, {description_text: 'B'}]}), bookingLeg]), ctx());
        expect(html).toContain('role="img" aria-label="2 notices for this connection"');
        expect(html).toContain('summary-badge__count');
        expect(html).toContain('aria-label="Booking required"');

        const single = renderSummaryBadges(connection([leg({alerts: [{severity: 'severe', header_text: 'X'}]})]), ctx());
        expect(single).toContain('summary-badge--severe');
        expect(single).toContain('1 notice for this connection');
        expect(single).not.toContain('summary-badge__count');

        expect(renderSummaryBadges(connection([leg()]), ctx())).toBe('');
    });

    test('expired bookings are flagged in the summary', () => {
        const late = ctx({now: DateTime.fromISO('2026-10-19T07:00:00Z')});
        const conn = connection([bookingLeg]);
        expect(renderSummaryBadges(conn, late)).toContain('Too late!');
    });
});

describe('alert filtering', () => {
    test('a filter selects which alerts are rendered, without consuming the others', () => {
        const element = leg({alerts: [{severity: 'info', description_text: 'Gratis Wanderbus'}, {severity: 'severe', header_text: 'Fällt aus'}]});
        const seen = new Set<string>();
        const urgent = renderLegAlerts(element, ctx(), seen, isUrgentAlert);
        const rest = renderLegAlerts(element, ctx(), seen, a => !isUrgentAlert(a));
        expect(urgent).toContain('Fällt aus');
        expect(urgent).not.toContain('Gratis Wanderbus');
        expect(rest).toContain('Gratis Wanderbus');
        expect(rest).not.toContain('Fällt aus');
    });
});
