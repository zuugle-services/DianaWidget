/**
 * Unit tests for the connection details timeline: stop and leg rows, rail styles,
 * leg descriptions, transfer platforms, day labels and waiting rows.
 */
import { ConnectionRenderer } from '../core/ConnectionRenderer';
import { getTransportIcon } from '../core/transportIcons';
import translations from '../translations';
import type { Connection, ConnectionElement, Language, WidgetConfig, WidgetState } from '../types';

function makeT(language: Language = 'EN') {
    return (key: string, replacements: Record<string, string> = {}): string => {
        const lookup = (root: unknown) => key.split('.').reduce<unknown>(
            (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), root);
        let text = (lookup(translations[language]) ?? lookup(translations.EN) ?? `[${key}]`) as string;
        for (const [k, v] of Object.entries(replacements)) text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        return text;
    };
}

function makeRenderer(language: Language = 'EN', config: Partial<WidgetConfig> = {}): ConnectionRenderer {
    const t = makeT(language);
    return new ConnectionRenderer({
        config: {timezone: 'Europe/Vienna', language, activityStartLocation: 'Prein', ...config} as unknown as WidgetConfig,
        t,
        getTransportIcon,
        getTransportName: (type) => t(`vehicles.${type}`),
    });
}

const noWait = {activityTimes: {start: '', end: ''}} as unknown as WidgetState;

function leg(overrides: Partial<ConnectionElement>): ConnectionElement {
    return {
        type: 'JNY',
        departure_time: '2026-10-19T07:00:00Z',
        arrival_time: '2026-10-19T08:00:00Z',
        ...overrides,
    };
}

/** Walk 09:00-09:10, train 09:10-10:06 from platform 2, transfer, bus 10:20-10:34 from platform A. */
function journey(): ConnectionElement[] {
    return [
        leg({type: 'WALK', from_location: 'Home', to_location: 'Wien Hbf', departure_time: '2026-10-19T07:00:00Z', arrival_time: '2026-10-19T07:10:00Z'}),
        leg({vehicle_type: '1', vehicle_name: 'CJX 22923', direction: 'Payerbach', from_location: 'Wien Hbf', to_location: 'Payerbach',
            platform_orig: '2', platform_dest: '1', n_intermediate_stops: 9, departure_time: '2026-10-19T07:10:00Z', arrival_time: '2026-10-19T08:06:00Z'}),
        leg({type: 'TRSF', from_location: 'Payerbach', to_location: 'Payerbach', departure_time: '2026-10-19T08:06:00Z', arrival_time: '2026-10-19T08:08:00Z'}),
        leg({vehicle_type: '2', vehicle_name: 'Bus 341', direction: 'Hirschwang', from_location: 'Payerbach', to_location: 'Hirschwang',
            platform_orig: 'A', n_intermediate_stops: 12, departure_time: '2026-10-19T08:20:00Z', arrival_time: '2026-10-19T08:34:00Z'}),
    ];
}

function connection(elements: ConnectionElement[], extra: Partial<Connection> = {}): Connection {
    return {
        connection_id: 0,
        connection_elements: elements,
        connection_start_timestamp: elements[0].departure_time,
        connection_end_timestamp: elements[elements.length - 1].arrival_time,
        connection_transfers: 1,
        ...extra,
    } as unknown as Connection;
}

function textOf(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe('connection details timeline', () => {
    const html = makeRenderer().renderConnectionDetails([connection(journey())], 'to', noWait, {});

    it('renders one stop row per leg plus the final arrival, and one row per leg', () => {
        expect(count(html, 'class="journey-stop')).toBe(5);
        expect(count(html, 'class="journey-leg ')).toBe(4);
        expect(count(html, 'journey-stop--endpoint')).toBe(2);
    });

    it('draws each leg with its own rail style, continued into the neighbouring stops', () => {
        expect(html).toContain('journey-leg journey-leg--walk');
        expect(html).toContain('journey-leg journey-leg--transfer');
        expect(count(html, 'journey-leg journey-leg--transit')).toBe(2);
        // walk -> train stop: dotted rail in, solid rail out
        expect(html).toMatch(/journey-rail--walk journey-rail--top[\s\S]*?journey-node[\s\S]*?journey-rail--transit journey-rail--bottom/);
        // the first and last stop have no rail beyond the journey
        expect(html).not.toMatch(/journey-day[\s\S]*?journey-rail--top[\s\S]*?Home/);
    });

    it('describes transit legs as mode + line, direction, duration and stops', () => {
        const text = textOf(html);
        expect(text).toContain('Train CJX 22923');
        expect(text).toContain('towards Payerbach');
        expect(text).toContain('56 min · 10 stops');
        expect(html).not.toContain('->');
    });

    it('does not repeat the mode when the line name already contains it', () => {
        expect(textOf(html)).toContain('Bus 341');
        expect(textOf(html)).not.toContain('Bus Bus 341');
    });

    it('describes walks and transfers in one line, with the platforms of a transfer', () => {
        const text = textOf(html);
        expect(text).toContain('Walk (10 min)');
        expect(text).toContain('Transfer (2 min), from platform 1 to platform A');
    });

    it('translates the transfer platforms', () => {
        const de = makeRenderer('DE').renderConnectionDetails([connection(journey())], 'to', noWait, {});
        expect(textOf(de)).toContain('Umstieg (2 min), von Bahnsteig 1 zu Bahnsteig A');
        expect(textOf(de)).toContain('Zug CJX 22923');
    });

    it('shows the departure platform on the stop it belongs to', () => {
        expect(html).toMatch(/Wien Hbf<\/span>\s*<span class="element-platform">Platform 2<\/span>/);
    });

    it('labels the first day once and every later day change', () => {
        expect(count(html, 'class="journey-day"')).toBe(1);
        expect(html).toContain('>19.10.<');

        const overnight = journey();
        overnight[3] = {...overnight[3], arrival_time: '2026-10-19T23:30:00Z'};
        const nightHtml = makeRenderer().renderConnectionDetails([connection(overnight)], 'to', noWait, {});
        expect(count(nightHtml, 'class="journey-day"')).toBe(2);
        expect(nightHtml).toContain('>20.10.<');
    });

    it('escapes provider names', () => {
        const unsafe = makeRenderer().renderConnectionDetails(
            [connection([leg({vehicle_type: '2', vehicle_name: '<b>8</b>', direction: '<i>x</i>', from_location: 'A&B', to_location: 'C'})])],
            'to', noWait, {});
        expect(unsafe).not.toContain('<b>8</b>');
        expect(unsafe).not.toContain('<i>x</i>');
        expect(unsafe).toContain('A&amp;B');
    });

    it('shows the user origin and the activity location at the ends of the journey', () => {
        const elements = journey();
        elements[0] = {...elements[0], isOriginalFirst: true};
        elements[3] = {...elements[3], isOriginalLast: true};
        const out = makeRenderer('EN', {activityStartLocationDisplayName: 'Raxseilbahn'} as Partial<WidgetConfig>)
            .renderConnectionDetails([connection(elements)], 'to', noWait, {originInput: {value: 'Gerlgasse'} as HTMLInputElement});
        expect(out).toMatch(/journey-station">Gerlgasse</);
        expect(out).toMatch(/journey-station">Raxseilbahn</);
    });

    it('adds a waiting row after the arrival of a connection to the activity', () => {
        const state = {activityTimes: {start: '10:00', end: ''}} as unknown as WidgetState;
        const out = makeRenderer().renderConnectionDetails([connection(journey())], 'to', state, {});
        expect(out).toContain('class="journey-wait"');
        expect(textOf(out)).toContain('Waiting for activity to start');
        expect(out.indexOf('journey-wait')).toBeGreaterThan(out.lastIndexOf('journey-stop'));
        expect(out).toMatch(/journey-rail--wait journey-rail--bottom/);
    });

    it('adds a waiting row before the departure of a connection from the activity', () => {
        const state = {activityTimes: {start: '', end: '08:30'}} as unknown as WidgetState;
        const out = makeRenderer().renderConnectionDetails([connection(journey())], 'from', state, {});
        expect(textOf(out)).toContain('Waiting after activity ends');
        expect(out.indexOf('journey-wait')).toBeLessThan(out.indexOf('journey-stop'));
    });

    it('explains when to leave for an anytime walk', () => {
        const state = {activityTimes: {start: '10:00', end: ''}} as unknown as WidgetState;
        const anytime = connection([leg({type: 'WALK', duration: 25, from_location: 'Home', to_location: 'Park'})], {connection_anytime: true} as Partial<Connection>);
        const out = makeRenderer().renderConnectionDetails([anytime], 'to', state, {});
        expect(textOf(out)).toContain('Walk (25 min)');
        expect(textOf(out)).toContain('Leave by 09:35 at the latest');
    });
});

describe('ticket buttons', () => {
    const render = (extra: Partial<Connection>, language: Language = 'EN') =>
        makeRenderer(language).renderConnectionDetails([connection(journey(), extra)], 'to', noWait, {});

    it('puts one ticket for the whole trip below the timeline', () => {
        const html = render({connection_ticketshop_provider: 'OEBB', connection_ticketshop_segments: [{leg_from: 0, leg_to: 3, provider: 'OEBB'}]} as Partial<Connection>);
        expect(count(html, 'class="ticket-button ')).toBe(1);
        expect(html).toContain('ticket-button--block');
        expect(html.indexOf('journey-ticket')).toBeGreaterThan(html.indexOf('</ol>'));
        expect(textOf(html)).toContain('Buy Ticket ÖBB');
        expect(html).toContain('data-segment-index="0"');
        expect(html).not.toContain('connection-details-header');
    });

    it('falls back to the provider alone for responses without segments', () => {
        const html = render({connection_ticketshop_provider: 'SBB'} as Partial<Connection>);
        expect(html).toContain('ticket-button--block');
        expect(html).not.toContain('data-segment-index');
    });

    it('renders no ticket button without a provider', () => {
        expect(render({})).not.toContain('ticket-button');
    });

    it('puts one ticket per segment at its first leg, and a note on uncovered legs', () => {
        const html = render({
            connection_ticketshop_provider: 'TRAIVELLING',
            connection_ticketshop_segments: [
                {leg_from: 1, leg_to: 1, provider: 'TRAIVELLING'},
                {leg_from: 3, leg_to: 3, provider: null},
            ],
        } as Partial<Connection>, 'DE');
        expect(html).not.toContain('ticket-button--block');
        expect(count(html, 'class="ticket-button ticket-button--inline"')).toBe(1);
        expect(html).toContain('data-segment-index="0"');
        expect(textOf(html)).toContain('Ticket bis Payerbach Traivelling');
        expect(textOf(html)).toContain('Für diesen Abschnitt kein Online-Ticket');
        // the ticket sits in the train leg, the note in the bus leg
        expect(html.indexOf('Ticket bis Payerbach')).toBeGreaterThan(html.indexOf('CJX 22923'));
        expect(html.indexOf('Ticket bis Payerbach')).toBeLessThan(html.indexOf('journey-leg--transfer'));
        expect(html.indexOf('kein Online-Ticket')).toBeGreaterThan(html.indexOf('Bus 341'));
    });
});

describe('on-demand legs with booking rules', () => {
    it('show the booking card instead of a "no online ticket" note, and no header button', () => {
        const elements = journey();
        elements[3] = {...elements[3], flex: {name: 'RUFbus'}, booking: {pickup: {booking_url: 'https://example.com/book', phone_number: '+43 1 234'}}};
        const html = makeRenderer('DE').renderConnectionDetails([connection(elements, {
            connection_ticketshop_segments: [
                {leg_from: 0, leg_to: 2, provider: 'OEBB'},
                {leg_from: 3, leg_to: 3, provider: null},
            ],
        } as Partial<Connection>)], 'to', noWait, {});
        expect(html).toContain('leg-booking');
        expect(html).not.toContain('kein Online-Ticket');
        expect(html).not.toContain('connection-details-header');
    });
});

describe('on-demand legs without booking rules', () => {
    const render = (overrides: Partial<ConnectionElement>) => {
        const elements = journey();
        elements[3] = {...elements[3], ...overrides};
        return makeRenderer('DE').renderConnectionDetails([connection(elements)], 'to', noWait, {});
    };

    it('name a timetabled on-demand service (type 10) "Bedarfsverkehr" and say it may need booking', () => {
        const text = textOf(render({vehicle_type: '10', vehicle_name: 'Rufbus 341'}));
        expect(text).toContain('Bedarfsverkehr Rufbus 341');
        expect(text).not.toContain('Taxi');
        expect(text).toContain('gebucht werden');
    });

    it('treat a GTFS-Flex leg as on-demand whatever its vehicle type', () => {
        const html = render({vehicle_type: '2', vehicle_name: 'Rufbus Ybbstal', flex: {name: 'Rufbus Ybbstal'}});
        expect(textOf(html)).toContain('Bedarfsverkehr Rufbus Ybbstal');
        expect(html).toContain('leg-flex');
    });

    it('leave ordinary buses alone', () => {
        const html = render({});
        expect(html).not.toContain('leg-flex');
        expect(textOf(html)).not.toContain('gebucht');
    });
});

describe('cancelled rides', () => {
    it('mark the leg and the stop it would have left from', () => {
        const elements = journey();
        elements[3] = {...elements[3], cancelled: true};
        const html = makeRenderer().renderConnectionDetails([connection(elements)], 'to', noWait, {});
        expect(count(html, 'journey-stop--departure-cancelled')).toBe(1);
        expect(html).toMatch(/journey-stop--departure-cancelled[\s\S]*?Payerbach[\s\S]*?journey-leg--cancelled[\s\S]*?Bus 341/);
    });
});

describe('segment ticket end', () => {
    it('names where the last ride arrives, even past a transfer or an out-of-range leg_to', () => {
        const html = makeRenderer('DE').renderConnectionDetails([connection(journey(), {
            connection_ticketshop_segments: [
                {leg_from: 0, leg_to: 2, provider: null},
                {leg_from: 3, leg_to: 5, provider: 'TRAIVELLING'},
            ],
        } as Partial<Connection>)], 'to', noWait, {});
        expect(textOf(html)).toContain('Ticket bis Hirschwang');
        expect(html).toContain('data-segment-index="1"');
    });
});

describe('transport icon coverage', () => {
    // Every vehicle type ID of the API's Vehicle Type Table, plus the leg types
    const types = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '20', '30', '31', '32', '33', 'WALK', 'TRSF', 'WAIT'];

    it('has its own icon for every vehicle and leg type', () => {
        const icons = types.map(type => getTransportIcon(type));
        expect(icons).not.toContain(getTransportIcon('DEFAULT'));
        expect(new Set(icons).size).toBe(types.length);
    });

    it('has a name for every vehicle type in every language', () => {
        for (const language of Object.keys(translations) as Language[]) {
            for (const type of types.filter(t => t !== 'WAIT')) {
                expect(translations[language].vehicles[type as keyof typeof translations.EN.vehicles]).toBeTruthy();
            }
        }
    });
});

describe('transport icons', () => {
    it('draw every type in currentColor on the same grid', () => {
        for (const type of ['1', '2', '3', '4', '7', '8', '9', '10', 'WALK', 'TRSF', 'WAIT', undefined, 'nope']) {
            const icon = getTransportIcon(type);
            expect(icon).toContain('viewBox="0 0 24 24"');
            expect(icon).toContain('stroke="currentColor"');
            expect(icon).not.toMatch(/fill="#|stroke="#/);
        }
    });
});
