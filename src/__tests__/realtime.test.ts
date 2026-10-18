/**
 * Unit tests for per-leg live data: delay times, platform changes, live markers,
 * cancellation notices and the summary / slider delay hints.
 */
import {
    getConnectionRealtime,
    getDelayLevel,
    renderDelayHint,
    renderLegArrivalTime,
    renderLegDepartureTime,
    renderLegRealtimeNotices,
    renderPlatform,
    renderRealtimeTime,
} from '../core/realtime';
import { ConnectionRenderer } from '../core/ConnectionRenderer';
import type { LegInfoContext } from '../core/legInfo';
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

function ctx(language: Language = 'EN'): LegInfoContext {
    return {t: makeT(language), timezone: 'Europe/Vienna', language};
}

/** A delayed train: 09:00 -> 09:05 departure, 10:06 -> 10:10 arrival (Vienna time). */
function delayedTrain(overrides: Partial<ConnectionElement> = {}): ConnectionElement {
    return {
        type: 'JNY',
        vehicle_type: '1',
        vehicle_name: 'REX 7',
        direction: 'Payerbach',
        from_location: 'Wien Hbf',
        to_location: 'Payerbach',
        departure_time: '2026-10-19T07:05:00Z',
        arrival_time: '2026-10-19T08:10:00Z',
        realtime: true,
        departure_time_scheduled: '2026-10-19T07:00:00Z',
        arrival_time_scheduled: '2026-10-19T08:06:00Z',
        departure_delay: 5,
        arrival_delay: 4,
        platform_orig: '5',
        platform_orig_scheduled: '3',
        ...overrides,
    };
}

function walk(overrides: Partial<ConnectionElement> = {}): ConnectionElement {
    return {
        type: 'TRSF',
        from_location: 'Payerbach',
        to_location: 'Payerbach Bus',
        departure_time: '2026-10-19T08:10:00Z',
        arrival_time: '2026-10-19T08:14:00Z',
        realtime: false,
        ...overrides,
    };
}

function bus(overrides: Partial<ConnectionElement> = {}): ConnectionElement {
    return {
        type: 'JNY',
        vehicle_type: '2',
        vehicle_name: '341',
        direction: 'Prein',
        from_location: 'Payerbach Bus',
        to_location: 'Prein',
        departure_time: '2026-10-19T08:20:00Z',
        arrival_time: '2026-10-19T08:34:00Z',
        realtime: false,
        ...overrides,
    };
}

function connection(elements: ConnectionElement[]): Connection {
    return {
        connection_id: 0,
        connection_elements: elements,
        connection_start_timestamp: elements[0].departure_time,
        connection_end_timestamp: elements[elements.length - 1].arrival_time,
        connection_transfers: 1,
    } as unknown as Connection;
}

/** Strips tags, i.e. what is visible plus visually-hidden screen reader text. */
function textOf(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

/** Visible text only: drops the visually-hidden screen reader spans. */
function visibleTextOf(html: string): string {
    return textOf(html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, ''));
}

describe('getDelayLevel', () => {
    it.each([
        [undefined, 'ontime'], [-3, 'ontime'], [0, 'ontime'], [1, 'ontime'],
        [2, 'minor'], [4, 'minor'], [5, 'major'], [30, 'major'],
    ])('delay %p -> %s', (delay, level) => {
        expect(getDelayLevel(delay as number | undefined)).toBe(level);
    });
});

describe('renderRealtimeTime', () => {
    it('renders a plain time without live data', () => {
        expect(renderRealtimeTime('2026-10-19T07:05:00Z', '2026-10-19T07:00:00Z', 5, false, ctx())).toBe('09:05');
    });

    it('marks an on-time realtime time as on time', () => {
        const html = renderRealtimeTime('2026-10-19T07:00:00Z', '2026-10-19T07:00:00Z', 0, true, ctx());
        expect(html).toContain('rt-time--ontime');
        expect(html).not.toContain('<s ');
        expect(visibleTextOf(html)).toBe('09:00');
        expect(textOf(html)).toContain('on time');
    });

    it('strikes through the scheduled time of a delayed departure', () => {
        const html = renderRealtimeTime('2026-10-19T07:05:00Z', '2026-10-19T07:00:00Z', 5, true, ctx());
        expect(html).toContain('rt-time--major');
        expect(html).toContain('<s class="rt-time__scheduled" aria-hidden="true">09:00</s>');
        expect(visibleTextOf(html)).toBe('09:0009:05');
        expect(textOf(html)).toContain('Scheduled 09:00, now 09:05');
    });

    it('uses the minor level for small delays and translates the label', () => {
        const html = renderRealtimeTime('2026-10-19T07:03:00Z', '2026-10-19T07:00:00Z', 3, true, ctx('DE'));
        expect(html).toContain('rt-time--minor');
        expect(textOf(html)).toContain('Planmäßig 09:00, jetzt 09:03');
    });
});

describe('leg times', () => {
    it('uses the leg\'s own scheduled departure for realtime legs', () => {
        expect(renderLegDepartureTime(delayedTrain(), undefined, ctx())).toContain('>09:00</s>');
    });

    it('shows the previous realtime leg\'s arrival delay on a connecting walk', () => {
        const html = renderLegDepartureTime(walk(), delayedTrain(), ctx());
        expect(html).toContain('>10:06</s>');
        expect(html).toContain('rt-time--minor');
    });

    it('keeps plain times for non-realtime legs', () => {
        expect(renderLegDepartureTime(bus(), walk(), ctx())).toBe('10:20');
        expect(renderLegArrivalTime(bus(), ctx())).toBe('10:34');
    });

    it('does not borrow a delay when the walk does not start at the previous arrival', () => {
        expect(renderLegDepartureTime(walk({departure_time: '2026-10-19T08:12:00Z'}), delayedTrain(), ctx())).toBe('10:12');
    });

    it('renders the arrival delay of a realtime leg', () => {
        expect(renderLegArrivalTime(delayedTrain(), ctx())).toContain('>10:06</s>');
    });
});

describe('renderPlatform', () => {
    it('renders nothing without a platform', () => {
        expect(renderPlatform(undefined, '3', ctx())).toBe('');
    });

    it('renders a plain platform badge when unchanged', () => {
        expect(renderPlatform('5', undefined, ctx())).toBe('<span class="element-platform">Platform 5</span>');
    });

    it('highlights a platform change', () => {
        const html = renderPlatform('5', '3', ctx());
        expect(html).toContain('element-platform--changed');
        expect(html).toContain('<s aria-hidden="true">3</s>');
        expect(textOf(html)).toContain('Platform changed from 3 to 5');
    });

    it('escapes provider platform names', () => {
        expect(renderPlatform('<b>5</b>', undefined, ctx())).toContain('&lt;b&gt;5&lt;/b&gt;');
    });
});

describe('renderLegRealtimeNotices', () => {
    it('renders nothing for normal legs', () => {
        expect(renderLegRealtimeNotices(delayedTrain(), ctx())).toBe('');
    });

    it('renders a severe notice for a cancelled trip', () => {
        const html = renderLegRealtimeNotices(delayedTrain({cancelled: true}), ctx());
        expect(html).toContain('leg-notice--severe');
        expect(textOf(html)).toContain('Trip cancelled');
    });

    it('renders an info notice for an additional service', () => {
        const html = renderLegRealtimeNotices(delayedTrain({additional_service: true}), ctx());
        expect(html).toContain('leg-notice--info');
        expect(textOf(html)).toContain('Additional service');
    });
});

describe('connection delay hints', () => {
    it('takes delays from the first and last transit legs only', () => {
        const conn = connection([walk({departure_time: '2026-10-19T06:58:00Z', arrival_time: '2026-10-19T07:05:00Z'}),
            delayedTrain(), walk(), bus()]);
        expect(getConnectionRealtime(conn)).toEqual({departureDelay: 5, arrivalDelay: undefined});
    });

    it('ignores delay fields on legs without live data', () => {
        expect(getConnectionRealtime(connection([bus({departure_delay: 3})]))).toEqual({});
    });

    it('renders signed hints and nothing for zero', () => {
        expect(renderDelayHint(0, 'departure', ctx())).toBe('');
        expect(renderDelayHint(undefined, 'arrival', ctx())).toBe('');
        const late = renderDelayHint(5, 'departure', ctx());
        expect(late).toContain('rt-delay--major');
        expect(late).toContain('>+5<');
        expect(late).toContain('Departs 5 min late');
        const early = renderDelayHint(-2, 'arrival', ctx());
        expect(early).toContain('rt-delay--ontime');
        expect(early).toContain('−2');
        expect(early).toContain('Arrives 2 min early');
    });
});

describe('ConnectionRenderer realtime integration', () => {
    const config = {timezone: 'Europe/Vienna', language: 'EN', activityStartLocation: 'Prein'} as unknown as WidgetConfig;
    const renderer = new ConnectionRenderer({
        config,
        t: makeT(),
        getTransportIcon: () => '<svg></svg>',
        getTransportName: (type) => `type-${type}`,
    });
    const state = {activityTimes: {start: '', end: ''}} as unknown as WidgetState;
    const conn = connection([delayedTrain(), walk(), bus()]);

    it('summary shows delay hints and marks live transit icons, without a connection live badge', () => {
        const html = renderer.renderConnectionSummary(conn, 'to', {});
        expect(html).toContain('Departs 5 min late');
        expect(html).toContain('summary-icon summary-icon--live');
        expect(html).toContain('title="type-2"');
        expect(html).not.toContain('live-indicator');
    });

    it('details render struck times and platform changes without a live marker', () => {
        const html = renderer.renderConnectionDetails([conn], 'to', state, {});
        expect(html).toContain('>09:00</s>');
        expect(html).toContain('element-platform--changed');
        expect(html).not.toContain('rt-live');
        expect(html).not.toContain('live-indicator-details');
    });
});
