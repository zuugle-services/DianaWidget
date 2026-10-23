import {
    addDaysIso, countDays, firstSelectableDay, isDayDisabled, isRangeLocked, pickRangeDay,
    type RangeRules, type RangeValue,
} from '../core/dateSelection';

const free: RangeRules = {fixedStart: null, fixedEnd: null, durationDays: null};
const empty: RangeValue = {start: null, end: null, awaitingEnd: false};

describe('pickRangeDay', () => {
    it('takes two taps for a free range: first day, then last day', () => {
        const first = pickRangeDay(empty, '2026-10-24', free);
        expect(first).toEqual({start: '2026-10-24', end: '2026-10-24', awaitingEnd: true});
        expect(pickRangeDay(first, '2026-10-27', free)).toEqual({start: '2026-10-24', end: '2026-10-27', awaitingEnd: false});
    });

    it('starts over when the second tap is before the first', () => {
        const first = pickRangeDay(empty, '2026-10-24', free);
        expect(pickRangeDay(first, '2026-10-22', free)).toEqual({start: '2026-10-22', end: '2026-10-22', awaitingEnd: true});
    });

    it('starts over on a tap after a complete range', () => {
        const done: RangeValue = {start: '2026-10-24', end: '2026-10-27', awaitingEnd: false};
        expect(pickRangeDay(done, '2026-10-30', free).awaitingEnd).toBe(true);
    });

    it('sets both ends at once for a fixed trip length', () => {
        expect(pickRangeDay(empty, '2026-10-24', {...free, durationDays: 3}))
            .toEqual({start: '2026-10-24', end: '2026-10-26', awaitingEnd: false});
    });

    it('only moves the free end when one end is fixed', () => {
        const rules = {...free, fixedStart: '2026-10-24'};
        const value: RangeValue = {start: '2026-10-24', end: '2026-10-25', awaitingEnd: false};
        expect(pickRangeDay(value, '2026-10-28', rules).end).toBe('2026-10-28');
        expect(pickRangeDay(value, '2026-10-20', rules)).toBe(value);
    });

    it('ignores taps when both ends are fixed', () => {
        const rules = {...free, fixedStart: '2026-10-24', fixedEnd: '2026-10-26'};
        const value: RangeValue = {start: '2026-10-24', end: '2026-10-26', awaitingEnd: false};
        expect(pickRangeDay(value, '2026-10-30', rules)).toBe(value);
    });
});

describe('day rules', () => {
    it('disables past days and the side beyond a fixed bound', () => {
        expect(isDayDisabled('2026-10-22', '2026-10-23', null)).toBe(true);
        expect(isDayDisabled('2026-10-23', '2026-10-23', null)).toBe(false);
        expect(isDayDisabled('2026-10-25', '2026-10-23', {...free, fixedStart: '2026-10-26'})).toBe(true);
        expect(isDayDisabled('2026-10-28', '2026-10-23', {...free, fixedEnd: '2026-10-27'})).toBe(true);
    });

    it('treats the range as locked when the config decides it', () => {
        expect(isRangeLocked(free)).toBe(false);
        expect(isRangeLocked({...free, fixedStart: '2026-10-24'})).toBe(false);
        expect(isRangeLocked({...free, fixedStart: '2026-10-24', durationDays: 2})).toBe(true);
        expect(isRangeLocked({...free, fixedStart: '2026-10-24', fixedEnd: '2026-10-25'})).toBe(true);
    });

    it('starts the strip at a later fixed start', () => {
        expect(firstSelectableDay('2026-10-23', {...free, fixedStart: '2026-11-02'})).toBe('2026-11-02');
        expect(firstSelectableDay('2026-10-23', null)).toBe('2026-10-23');
    });

    it('counts days inclusively across a DST change', () => {
        expect(countDays('2026-10-24', '2026-10-26')).toBe(3);
        expect(addDaysIso('2026-10-24', 7)).toBe('2026-10-31');
    });
});
