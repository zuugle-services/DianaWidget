/**
 * The widget side of per-date time windows: the selected dropdown option's window reaches the
 * API params and the connection post-processing, and the widget can decide not to render.
 * Runs in node, so the few DOM globals the constructor touches are stubbed.
 */
import DianaWidget from '../core/widget';
import { DEFAULT_CONFIG, DEFAULT_STATE } from '../constants';
import { buildDateSlots } from '../core/dateWindows';
import type { WidgetConfig, WidgetState } from '../types';

const baseConfig: Partial<WidgetConfig> = {
    activityStartLocation: '47.8,13.0',
    activityStartLocationType: 'coordinates',
    activityEndLocation: '47.8,13.0',
    activityEndLocationType: 'coordinates',
    activityEarliestStartTime: '09:00',
    activityLatestStartTime: '12:00',
    activityEarliestEndTime: '13:00',
    activityLatestEndTime: '17:00',
    activityDurationMinutes: 120,
    apiToken: 'token',
    timezone: 'Europe/Vienna',
};

interface Widget {
    config: WidgetConfig;
    state: WidgetState;
    elements: Record<string, unknown>;
    _buildActivityParams(): Record<string, unknown>;
    calculateAnytimeConnections(connections: unknown[], type: 'to' | 'from'): void;
}

/** A widget instance without running the constructor, with the given config and selected slot. */
function bareWidget(config: Partial<WidgetConfig>, slotIndex: number | null): Widget {
    const widget = Object.create(DianaWidget.prototype) as Widget;
    widget.config = {...DEFAULT_CONFIG, ...baseConfig, ...config} as WidgetConfig;
    const slots = buildDateSlots(widget.config, '2026-11-27') ?? [];
    const slot = slotIndex === null ? null : slots[slotIndex];
    widget.state = {
        ...DEFAULT_STATE,
        dateSlots: slots,
        selectedDateSlot: slot,
        selectedDate: new Date(Date.UTC(2026, 11, slot ? Number(slot.date.slice(8)) : 18)),
    };
    widget.elements = {};
    return widget;
}

describe('per-date windows in the widget', () => {
    const dateList = [
        '2026-12-17',
        {date: '2026-12-18', opens: '15:00', closes: '21:00'},
        {date: '2026-12-19', opens: '11:00', closes: '14:00', durationMinutes: 60},
        {date: '2026-12-19', opens: '17:30', closes: '22:00', durationMinutes: 60},
    ];

    it('sends the selected option\'s window to the API (times in UTC)', () => {
        const params = bareWidget({dateList}, 1)._buildActivityParams();
        expect(params).toMatchObject({
            date: '2026-12-18',
            activity_earliest_start_time: '14:00:00', // 15:00 Vienna
            activity_latest_start_time: '18:00:00',   // 21:00 - 2h
            activity_earliest_end_time: '16:00:00',   // 15:00 + 2h
            activity_latest_end_time: '20:00:00',     // 21:00
            activity_duration_minutes: 120,
        });
    });

    it('uses the block that was chosen when a date has several', () => {
        const params = bareWidget({dateList}, 3)._buildActivityParams();
        expect(params).toMatchObject({
            date: '2026-12-19',
            activity_earliest_start_time: '16:30:00',
            activity_latest_start_time: '20:00:00',
            activity_earliest_end_time: '17:30:00',
            activity_latest_end_time: '21:00:00',
            activity_duration_minutes: 60,
        });
    });

    it('keeps the global window for plain dates and without a dropdown', () => {
        const expected = {
            activity_earliest_start_time: '08:00:00', activity_latest_start_time: '11:00:00',
            activity_earliest_end_time: '12:00:00', activity_latest_end_time: '16:00:00', activity_duration_minutes: 120,
        };
        expect(bareWidget({dateList}, 0)._buildActivityParams()).toMatchObject(expected);
        expect(bareWidget({}, null)._buildActivityParams()).toMatchObject(expected);
    });

    it('places "anytime" connections at the selected window', () => {
        const widget = bareWidget({dateList}, 1);
        const conn = () => ({connection_anytime: true, connection_elements: [{duration: 10}]});
        const to = [conn()];
        const from = [conn()];
        widget.calculateAnytimeConnections(to, 'to');
        widget.calculateAnytimeConnections(from, 'from');
        expect(to[0]).toMatchObject({connection_end_timestamp: expect.stringContaining('2026-12-18T18:00')});
        expect(from[0]).toMatchObject({connection_start_timestamp: expect.stringContaining('2026-12-18T16:00')});
    });
});

describe('not rendering', () => {
    let container: {innerHTML: string; shadowRoot: unknown; attachShadow: () => unknown};
    const g = globalThis as unknown as Record<string, unknown>;

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-11-27T10:00:00Z'));
        container = {innerHTML: 'host content', shadowRoot: null, attachShadow: () => ({innerHTML: ''})};
        g.document = {getElementById: () => container, createElement: () => ({}), body: {appendChild: () => undefined}};
        g.window = {location: {href: 'http://localhost/', search: ''}};
        jest.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        delete g.document;
        delete g.window;
    });

    it('renders nothing and calls onUnavailable when no listed date is left', () => {
        const onUnavailable = jest.fn();
        new DianaWidget({...baseConfig, dateList: ['2026-11-01'], hideWhenNoFutureDates: true, onUnavailable}, 'c');
        expect(container.innerHTML).toBe('');
        expect(onUnavailable).toHaveBeenCalledWith('noFutureDates');
    });

    it('does the same for openingHours that are all in the past', () => {
        const onUnavailable = jest.fn();
        new DianaWidget({
            ...baseConfig,
            openingHours: [{validFrom: '2026-11-01', validThrough: '2026-11-02', opens: '10:00', closes: '18:00'}],
            hideWhenNoFutureDates: true,
            onUnavailable,
        }, 'c');
        expect(onUnavailable).toHaveBeenCalledWith('noFutureDates');
    });

    it('calls onUnavailable outside the display range', () => {
        const onUnavailable = jest.fn();
        new DianaWidget({...baseConfig, displayEndDate: '2026-11-01', onUnavailable}, 'c');
        expect(container.innerHTML).toBe('');
        expect(onUnavailable).toHaveBeenCalledWith('outsideDisplayRange');
    });

    it('survives a throwing callback', () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => new DianaWidget({
            ...baseConfig, dateList: [], hideWhenNoFutureDates: true, onUnavailable: () => { throw new Error('host bug'); },
        }, 'c')).not.toThrow();
    });
});
