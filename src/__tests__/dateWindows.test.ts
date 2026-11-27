import {
    buildDateSlots, expandOpeningHours, resolveDateListItem, selfSufficientGlobals, validateDateWindowConfig,
} from '../core/dateWindows';
import { validateConfig } from '../core/Validator';
import { DEFAULT_CONFIG } from '../constants';
import type { WidgetConfig } from '../types';

const TODAY = '2026-11-27'; // a Friday

function config(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
    return {
        ...DEFAULT_CONFIG,
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
        ...overrides,
    } as WidgetConfig;
}

describe('resolveDateListItem', () => {
    const global = {earliestStartTime: '09:00', latestStartTime: '12:00', earliestEndTime: '13:00', latestEndTime: '17:00', durationMinutes: 120};

    it('keeps the global window for a plain date', () => {
        expect(resolveDateListItem('2026-12-01', global)).toEqual({date: '2026-12-01', window: global, rangeLabel: null});
    });

    it('derives the window from opens/closes and the duration', () => {
        const slot = resolveDateListItem({date: '2026-12-18', opens: '15:00', closes: '21:00'}, global);
        expect(slot.window).toEqual({
            earliestStartTime: '15:00', latestStartTime: '19:00', earliestEndTime: '17:00', latestEndTime: '21:00', durationMinutes: 120,
        });
        expect(slot.rangeLabel).toBe('15:00–21:00');
    });

    it('clamps the derived window when the duration is longer than the opening hours', () => {
        const slot = resolveDateListItem({date: '2026-12-18', opens: '10:00', closes: '11:00', durationMinutes: 180}, global);
        expect(slot.window).toMatchObject({
            earliestStartTime: '10:00', latestStartTime: '10:00', earliestEndTime: '11:00', latestEndTime: '11:00', durationMinutes: 180,
        });
    });

    it('lets explicit times override the derived and global ones', () => {
        const slot = resolveDateListItem({date: '2026-12-18', opens: '15:00', closes: '21:00', latestStartTime: '18:00'}, global);
        expect(slot.window.latestStartTime).toBe('18:00');
        const partial = resolveDateListItem({date: '2026-12-18', earliestStartTime: '10:00', durationMinutes: 60}, global);
        expect(partial.window).toEqual({...global, earliestStartTime: '10:00', durationMinutes: 60});
        expect(partial.rangeLabel).toBe('10:00–17:00');
    });

    it('shows no range for an entry that only changes the duration', () => {
        expect(resolveDateListItem({date: '2026-12-18', durationMinutes: 60}, global).rangeLabel).toBeNull();
    });
});

describe('expandOpeningHours', () => {
    it('expands dated entries (validFrom..validThrough) and drops past days', () => {
        expect(expandOpeningHours([
            {'@type': 'OpeningHoursSpecification', validFrom: '2026-12-03', validThrough: '2026-12-03', opens: '10:00', closes: '18:00'},
            {validFrom: '2026-11-26', validThrough: '2026-11-28', opens: '10:00:00', closes: '12:00:00'},
        ], TODAY)).toEqual([
            {date: '2026-11-27', opens: '10:00', closes: '12:00'},
            {date: '2026-11-28', opens: '10:00', closes: '12:00'},
            {date: '2026-12-03', opens: '10:00', closes: '18:00'},
        ]);
    });

    it('expands recurring dayOfWeek entries within the horizon (names and schema.org URLs)', () => {
        const entries = expandOpeningHours([
            {dayOfWeek: ['https://schema.org/Thursday', 'Saturday'], opens: '10:00', closes: '18:00'},
        ], TODAY, 14);
        expect(entries.map(e => e.date)).toEqual(['2026-11-28', '2026-12-03', '2026-12-05', '2026-12-10']);
    });

    it('limits recurring entries by validFrom/validThrough', () => {
        const entries = expandOpeningHours([
            {dayOfWeek: 'Friday', validFrom: '2026-12-01', validThrough: '2026-12-11', opens: '15:00', closes: '21:00'},
        ], TODAY);
        expect(entries.map(e => e.date)).toEqual(['2026-12-04', '2026-12-11']);
    });

    it('lets a dated entry replace the recurring hours of that day, and opens == closes close it', () => {
        const entries = expandOpeningHours([
            {dayOfWeek: 'Saturday', opens: '10:00', closes: '18:00'},
            {validFrom: '2026-11-28', validThrough: '2026-11-28', opens: '14:00', closes: '16:00'},
            {validFrom: '2026-12-05', validThrough: '2026-12-05', opens: '00:00', closes: '00:00'},
        ], TODAY, 10);
        expect(entries).toEqual([{date: '2026-11-28', opens: '14:00', closes: '16:00'}]);
    });

    it('keeps several blocks on one day, sorted', () => {
        const entries = expandOpeningHours([
            {dayOfWeek: 'Saturday', opens: '17:30', closes: '22:00'},
            {dayOfWeek: 'Saturday', opens: '11:00', closes: '14:00'},
        ], TODAY, 2);
        expect(entries).toEqual([
            {date: '2026-11-28', opens: '11:00', closes: '14:00'},
            {date: '2026-11-28', opens: '17:30', closes: '22:00'},
        ]);
    });

    it('cuts overnight blocks at the end of the day', () => {
        expect(expandOpeningHours([
            {validFrom: '2026-12-01', opens: '18:00', closes: '02:00'},
            {validFrom: '2026-12-02', opens: '18:00', closes: '24:00'},
        ], TODAY)).toEqual([
            {date: '2026-12-01', opens: '18:00', closes: '23:59'},
            {date: '2026-12-02', opens: '18:00', closes: '23:59'},
        ]);
    });
});

describe('buildDateSlots', () => {
    it('returns null without dateList or openingHours', () => {
        expect(buildDateSlots(config(), TODAY)).toBeNull();
    });

    it('keeps string dateLists working as before: past dates dropped, sorted, global window', () => {
        const slots = buildDateSlots(config({dateList: ['2026-12-10', '2026-11-20', '2026-11-27']}), TODAY)!;
        expect(slots.map(s => s.date)).toEqual(['2026-11-27', '2026-12-10']);
        expect(slots[0].window.earliestStartTime).toBe('09:00');
        expect(slots[0].rangeLabel).toBeNull();
    });

    it('mixes strings and entries, one option per block, sorted by date and start', () => {
        const slots = buildDateSlots(config({dateList: [
            {date: '2026-12-12', opens: '17:30', closes: '22:00'},
            '2026-12-11',
            {date: '2026-12-12', opens: '11:00', closes: '14:00'},
        ]}), TODAY)!;
        expect(slots.map(s => [s.date, s.rangeLabel])).toEqual([
            ['2026-12-11', null],
            ['2026-12-12', '11:00–14:00'],
            ['2026-12-12', '17:30–22:00'],
        ]);
    });

    it('uses openingHours when there is no dateList, and dateList wins when both are set', () => {
        const openingHours = [{validFrom: '2026-12-03', validThrough: '2026-12-03', opens: '10:00', closes: '18:00'}];
        expect(buildDateSlots(config({openingHours}), TODAY)!.map(s => s.date)).toEqual(['2026-12-03']);
        expect(buildDateSlots(config({openingHours, dateList: ['2026-12-04']}), TODAY)!.map(s => s.date)).toEqual(['2026-12-04']);
    });

    it('returns an empty list when every date is past', () => {
        expect(buildDateSlots(config({dateList: ['2026-01-01']}), TODAY)).toEqual([]);
    });
});

describe('validation', () => {
    it('accepts a plain string dateList unchanged', () => {
        const {errors, config: result} = validateConfig(config({dateList: ['2026-12-10']}));
        expect(errors).toEqual([]);
        expect(result.dateList).toEqual(['2026-12-10']);
    });

    it('reports malformed entries clearly', () => {
        const {errors, warnings} = validateDateWindowConfig(config({dateList: [
            '2026-13-01',
            {date: '2026-12-01', opens: '10:00'},
            {date: '2026-12-02', opens: '18:00', closes: '10:00'},
            {date: '2026-12-03', earliestStartTime: '25:00'},
            {date: '2026-12-04', latestStartTime: '08:00'},
            {date: '2026-12-05', durationMinutes: -5},
        ]}));
        // A bad plain date stays non-fatal, as it always was.
        expect(warnings).toEqual([expect.stringContaining('dateList[0]')]);
        expect(errors).toEqual([
            expect.stringContaining("dateList[1]: 'opens' and 'closes' must be given together"),
            expect.stringContaining('dateList[2]: closes (10:00) must be after opens (18:00)'),
            expect.stringContaining('dateList[3].earliestStartTime'),
            expect.stringContaining('dateList[4]: latestStartTime (08:00) cannot be before earliestStartTime (09:00)'),
            expect.stringContaining('dateList[5].durationMinutes'),
        ]);
    });

    it('validates openingHours and warns when dateList takes precedence', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const {errors, warnings} = validateDateWindowConfig(config({
            dateList: ['2026-12-01'],
            openingHours: [{dayOfWeek: 'Funday', opens: '10:00', closes: 'late'}],
        }));
        expect(errors).toEqual([expect.stringContaining("'opens' and 'closes'"), expect.stringContaining('Funday')]);
        expect(warnings).toEqual([expect.stringContaining('openingHours is ignored')]);
        warn.mockRestore();
    });

    it('does not require global times when every date brings its own window', () => {
        const base = config({
            activityEarliestStartTime: undefined, activityLatestStartTime: undefined,
            activityEarliestEndTime: undefined, activityLatestEndTime: undefined,
        });
        expect(validateConfig({...base, dateList: [{date: '2026-12-18', opens: '15:00', closes: '21:00'}]}).errors).toEqual([]);
        expect(validateConfig({...base, openingHours: [{dayOfWeek: 'Friday', opens: '15:00', closes: '21:00'}]}).errors).toEqual([]);
        // A plain date still needs the global window.
        expect(validateConfig({...base, dateList: ['2026-12-18']}).errors[0]).toContain('activityEarliestStartTime');
        // The duration is only optional when every entry has its own.
        const noDuration = {...base, activityDurationMinutes: undefined};
        expect(validateConfig({...noDuration, dateList: [{date: '2026-12-18', opens: '15:00', closes: '21:00'}]}).errors[0])
            .toContain('activityDurationMinutes');
        expect(validateConfig({...noDuration, dateList: [{date: '2026-12-18', opens: '15:00', closes: '21:00', durationMinutes: 90}]}).errors)
            .toEqual([]);
    });

    it('keeps the global window required for multiday', () => {
        expect(selfSufficientGlobals(config({multiday: true, dateList: [{date: '2026-12-18', opens: '15:00', closes: '21:00'}]})))
            .toEqual({times: false, duration: false});
    });
});
