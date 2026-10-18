import { DateTime } from 'luxon';
import { isConnectionDeparted, shouldIncludePastConnections } from '../core/pastConnections';
import { DEFAULT_CONFIG } from '../constants/defaults';

const VIENNA = 'Europe/Vienna';

describe('showPastConnections default', () => {
    it('is on unless the integrator turns it off', () => {
        expect(DEFAULT_CONFIG.showPastConnections).toBe(true);
    });
});

describe('shouldIncludePastConnections', () => {
    // 2026-10-18 10:00 UTC = 12:00 in Vienna (CEST)
    const now = DateTime.fromISO('2026-10-18T10:00:00Z', { zone: 'utc' });

    it('asks for past connections when searching today', () => {
        expect(shouldIncludePastConnections(true, '2026-10-18', VIENNA, now)).toBe(true);
    });

    it('does not ask for later dates', () => {
        expect(shouldIncludePastConnections(true, '2026-10-19', VIENNA, now)).toBe(false);
    });

    it('does not ask when the option is off', () => {
        expect(shouldIncludePastConnections(false, '2026-10-18', VIENNA, now)).toBe(false);
    });

    it('does not ask without a date', () => {
        expect(shouldIncludePastConnections(true, undefined, VIENNA, now)).toBe(false);
    });

    it('decides "today" in the widget timezone, not in UTC', () => {
        // 23:30 UTC on the 18th is already the 19th in Vienna
        const lateUtc = DateTime.fromISO('2026-10-18T23:30:00Z', { zone: 'utc' });
        expect(shouldIncludePastConnections(true, '2026-10-19', VIENNA, lateUtc)).toBe(true);
        expect(shouldIncludePastConnections(true, '2026-10-18', VIENNA, lateUtc)).toBe(false);
    });
});

describe('isConnectionDeparted', () => {
    const now = DateTime.fromISO('2026-10-18T10:00:00Z', { zone: 'utc' });

    it('is true for a connection that started before now', () => {
        expect(isConnectionDeparted({ connection_start_timestamp: '2026-10-18T09:59:00Z' }, now)).toBe(true);
    });

    it('is false for a connection leaving now or later', () => {
        expect(isConnectionDeparted({ connection_start_timestamp: '2026-10-18T10:00:00Z' }, now)).toBe(false);
        expect(isConnectionDeparted({ connection_start_timestamp: '2026-10-18T11:00:00Z' }, now)).toBe(false);
    });

    it('handles offset timestamps', () => {
        expect(isConnectionDeparted({ connection_start_timestamp: '2026-10-18T11:30:00+02:00' }, now)).toBe(true);
    });

    it('never marks an anytime (walk-only) connection as departed', () => {
        expect(isConnectionDeparted({ connection_anytime: true, connection_start_timestamp: '2026-10-18T06:00:00Z' }, now)).toBe(false);
    });

    it('is false for an unparseable timestamp', () => {
        expect(isConnectionDeparted({ connection_start_timestamp: 'not-a-date' }, now)).toBe(false);
    });
});
