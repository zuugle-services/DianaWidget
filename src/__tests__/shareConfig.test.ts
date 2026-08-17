import {
    applySharedActivityToConfig,
    buildShareUrl,
    isValidShareId
} from '../core/shareConfig';
import { convertLocalTimeToUTC } from '../datetimeUtils';
import { DEFAULT_CONFIG } from '../constants/defaults';
import type { ActivityObject, ShareDataResponse } from '../types/api';
import type { WidgetConfig } from '../types/config';

const UUID = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

/** A config as a host page would supply it, deliberately different from the shares below. */
function hostConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
    return {
        ...DEFAULT_CONFIG,
        activityName: 'Host Page Activity',
        activityStartLocation: '13.745, 100.535',
        activityStartLocationType: 'coordinates',
        activityStartLocationDisplayName: 'Host Start',
        activityEndLocation: '13.745, 100.535',
        activityEndLocationType: 'coordinates',
        activityEndLocationDisplayName: 'Host End',
        activityEarliestStartTime: '10:00:00',
        activityLatestStartTime: '19:00:00',
        activityEarliestEndTime: '12:00:00',
        activityLatestEndTime: '21:00:00',
        activityDurationMinutes: 180,
        timezone: 'Asia/Bangkok',
        language: 'EN',
        ...overrides,
    } as WidgetConfig;
}

function share(overrides: Partial<ShareDataResponse> = {}): ShareDataResponse {
    return {
        origin: 'Salzburg Hbf',
        date: '2026-08-24',
        dateEnd: null,
        ...overrides,
    } as ShareDataResponse;
}

/** A single-day activity in Europe/Vienna, times expressed as UTC datetimes like the API. */
function viennaActivity(overrides: Partial<ActivityObject> = {}): ActivityObject {
    return {
        name: 'Marktschellenberger Eishöhle',
        start_location: '47.72620173410345,13.042174020936743',
        start_location_type: 'coordinates',
        start_location_display_name: 'Untersbergbahn Talstation',
        end_location: '47.70487271915757,13.038710343883247',
        end_location_type: 'coordinates',
        end_location_display_name: 'Eishöhle, Marktschellenberg',
        timezone: 'Europe/Vienna',
        date: '2026-08-24',
        date_end: null,
        duration_minutes: 180,
        duration_days: null,
        // 2026-08-24 is CEST (UTC+2): 06:00Z == 08:00 local, 18:00Z == 20:00 local
        earliest_start_time: '2026-08-24T06:00:00Z',
        latest_start_time: '2026-08-24T12:00:00Z',
        earliest_end_time: '2026-08-24T08:00:00Z',
        latest_end_time: '2026-08-24T18:00:00Z',
        start_time_label: 'Beginn Tour',
        end_time_label: 'Ende Tour',
        ...overrides,
    } as ActivityObject;
}

describe('isValidShareId', () => {
    it('accepts a canonical UUID in either case', () => {
        expect(isValidShareId(UUID)).toBe(true);
        expect(isValidShareId(UUID.toUpperCase())).toBe(true);
    });

    it('rejects anything that is not a UUID', () => {
        expect(isValidShareId('abc')).toBe(false);
        expect(isValidShareId('')).toBe(false);
        expect(isValidShareId(null)).toBe(false);
        // Missing a block
        expect(isValidShareId('a1b2c3d4-e5f6-7890-1234')).toBe(false);
    });
});

describe('buildShareUrl', () => {
    it('adds diana-share to an absolute URL', () => {
        expect(buildShareUrl('https://example.com/tour', UUID))
            .toBe(`https://example.com/tour?diana-share=${UUID}`);
    });

    it('preserves existing query params and hash', () => {
        const url = buildShareUrl('https://example.com/p?a=1#eishoehle', UUID);
        expect(url).toContain('a=1');
        expect(url).toContain(`diana-share=${UUID}`);
        expect(url).toContain('#eishoehle');
    });

    it('replaces an existing diana-share rather than appending a second one', () => {
        const url = buildShareUrl(`https://example.com/p?diana-share=${UUID}`, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
        expect(url.match(/diana-share/g)).toHaveLength(1);
        expect(url).toContain('ffffffff-ffff-ffff-ffff-ffffffffffff');
    });
});

describe('applySharedActivityToConfig', () => {
    it('overwrites the host config with the shared activity', () => {
        const config = hostConfig();
        applySharedActivityToConfig(viennaActivity(), share(), config);

        expect(config.activityName).toBe('Marktschellenberger Eishöhle');
        expect(config.timezone).toBe('Europe/Vienna');
        expect(config.activityStartLocation).toBe('47.72620173410345,13.042174020936743');
        expect(config.activityStartLocationDisplayName).toBe('Untersbergbahn Talstation');
        expect(config.activityEndLocationDisplayName).toBe('Eishöhle, Marktschellenberg');
        expect(config.activityDurationMinutes).toBe(180);
        expect(config.activityStartTimeLabel).toBe('Beginn Tour');
        expect(config.activityEndTimeLabel).toBe('Ende Tour');
    });

    it('converts the four UTC activity datetimes to local times', () => {
        const config = hostConfig();
        applySharedActivityToConfig(viennaActivity(), share(), config);

        // CEST is UTC+2
        expect(config.activityEarliestStartTime).toBe('08:00');
        expect(config.activityLatestStartTime).toBe('14:00');
        expect(config.activityEarliestEndTime).toBe('10:00');
        expect(config.activityLatestEndTime).toBe('20:00');
    });

    it('converts correctly for a non-European timezone', () => {
        const config = hostConfig({ timezone: 'Europe/Vienna' });
        const activity = viennaActivity({
            timezone: 'Asia/Bangkok', // UTC+7, no DST
            earliest_start_time: '2026-08-24T03:00:00Z',
            latest_start_time: '2026-08-24T12:00:00Z',
            earliest_end_time: '2026-08-24T05:00:00Z',
            latest_end_time: '2026-08-24T14:00:00Z',
        });
        applySharedActivityToConfig(activity, share(), config);

        expect(config.timezone).toBe('Asia/Bangkok');
        expect(config.activityEarliestStartTime).toBe('10:00');
        expect(config.activityLatestStartTime).toBe('19:00');
        expect(config.activityEarliestEndTime).toBe('12:00');
        expect(config.activityLatestEndTime).toBe('21:00');
    });

    it('converts using the shared timezone, not the host page timezone', () => {
        // Host is Bangkok (UTC+7); if the timezone were not applied first, 06:00Z would
        // wrongly become 13:00 instead of 08:00.
        const config = hostConfig({ timezone: 'Asia/Bangkok' });
        applySharedActivityToConfig(viennaActivity(), share(), config);
        expect(config.activityEarliestStartTime).toBe('08:00');
    });

    it('handles a winter (CET, UTC+1) date', () => {
        const config = hostConfig();
        const activity = viennaActivity({
            date: '2026-01-15',
            earliest_start_time: '2026-01-15T07:00:00Z', // 08:00 CET
            latest_start_time: '2026-01-15T13:00:00Z',   // 14:00 CET
            earliest_end_time: '2026-01-15T09:00:00Z',
            latest_end_time: '2026-01-15T19:00:00Z',
        });
        applySharedActivityToConfig(activity, share({ date: '2026-01-15' }), config);

        expect(config.activityEarliestStartTime).toBe('08:00');
        expect(config.activityLatestStartTime).toBe('14:00');
    });

    it('round-trips local times back to the original UTC times', () => {
        const config = hostConfig();
        applySharedActivityToConfig(viennaActivity(), share(), config);

        // Mirrors what _buildActivityParams() sends back to /connections.
        const date = new Date(Date.UTC(2026, 7, 24));
        expect(convertLocalTimeToUTC(config.activityEarliestStartTime!, date, config.timezone)).toBe('06:00:00');
        expect(convertLocalTimeToUTC(config.activityLatestStartTime!, date, config.timezone)).toBe('12:00:00');
        expect(convertLocalTimeToUTC(config.activityEarliestEndTime!, date, config.timezone)).toBe('08:00:00');
        expect(convertLocalTimeToUTC(config.activityLatestEndTime!, date, config.timezone)).toBe('18:00:00');
    });

    describe('duration_days', () => {
        it('null means a single-day activity', () => {
            const config = hostConfig({ multiday: true, activityDurationDaysFixed: 2 });
            applySharedActivityToConfig(viennaActivity({ duration_days: null }), share(), config);

            expect(config.multiday).toBe(false);
            // Must not inherit the host page's fixed duration.
            expect(config.activityDurationDaysFixed).toBeNull();
        });

        it('greater than 1 turns on multiday with a fixed duration', () => {
            const config = hostConfig();
            const activity = viennaActivity({ duration_days: 2, date_end: '2026-08-25' });
            applySharedActivityToConfig(activity, share({ dateEnd: '2026-08-25' }), config);

            expect(config.multiday).toBe(true);
            expect(config.activityDurationDaysFixed).toBe(2);
            expect(config.overrideActivityEndDate).toBe('2026-08-25');
        });
    });

    describe('date overrides', () => {
        it('locks the dates and reveals them as read-only', () => {
            const config = hostConfig();
            applySharedActivityToConfig(viennaActivity(), share(), config);

            expect(config.overrideActivityStartDate).toBe('2026-08-24');
            expect(config.overrideActivityEndDate).toBeNull();
            // false makes formPageTemplate render the disabled, read-only date display.
            expect(config.hideOverriddenActivityStartDate).toBe(false);
        });

        it('falls back to the share date when the activity has none', () => {
            const config = hostConfig();
            applySharedActivityToConfig(viennaActivity({ date: undefined }), share({ date: '2026-09-01' }), config);
            expect(config.overrideActivityStartDate).toBe('2026-09-01');
        });

        it('clears destinationInputName so the shared activity name is shown', () => {
            const config = hostConfig({ destinationInputName: 'Host Destination' });
            applySharedActivityToConfig(viennaActivity(), share(), config);
            expect(config.destinationInputName).toBeNull();
        });
    });

    describe('robustness', () => {
        it('keeps the existing timezone when the shared one is invalid', () => {
            const config = hostConfig({ timezone: 'Europe/Vienna' });
            applySharedActivityToConfig(viennaActivity({ timezone: 'Not/AZone' }), share(), config);
            expect(config.timezone).toBe('Europe/Vienna');
        });

        it('leaves fields absent from the activity untouched', () => {
            const config = hostConfig();
            const original = config.activityName;
            applySharedActivityToConfig({ timezone: 'Europe/Vienna' } as ActivityObject, share(), config);
            expect(config.activityName).toBe(original);
        });

        it('does not overwrite the host page language', () => {
            const config = hostConfig({ language: 'DE' });
            applySharedActivityToConfig(viennaActivity(), share(), config);
            expect(config.language).toBe('DE');
        });
    });
});
