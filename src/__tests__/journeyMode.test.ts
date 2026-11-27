/**
 * Unit tests for journey mode (mode: 'journey'): config validation, prefill / lock / cache,
 * request building (timezone, is_arrival), paging and swap.
 */
import { DateTime } from 'luxon';
import {
    buildJourneyParams,
    connectionKey,
    endpointRequestParams,
    filterArriveByWindow,
    initialJourneyDateTime,
    isEndpointResolved,
    mergeConnections,
    pageQuery,
    readCachedLocation,
    readRecentLocations,
    resolveEndpointPrefill,
    resolveJourneyTitle,
    sameEndpoint,
    swapEndpoints,
    writeCachedLocation,
    type JourneyEndpointState,
    type KeyValueStorage,
} from '../core/journeyMode';
import { validateConfig } from '../core/Validator';
import { DEFAULT_CONFIG, REQUIRED_CONFIG_FIELDS } from '../constants/defaults';
import { getApiErrorTranslationKey } from '../utils';
import { getJourneyFormPageTemplateHTML } from '../templates/journeyFormPageTemplate';
import { getResultsPageTemplateHTML } from '../templates/resultsPageTemplate';
import translations from '../translations';
import type { Connection } from '../types/api';
import type { WidgetConfig } from '../types/config';

function journeyConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
    return {...DEFAULT_CONFIG, mode: 'journey', apiToken: 'token', timezone: 'Europe/Vienna', language: 'EN', ...overrides} as WidgetConfig;
}

function endpoint(overrides: Partial<JourneyEndpointState> = {}): JourneyEndpointState {
    return {text: '', lat: null, lon: null, locationValue: null, locationType: null, ...overrides};
}

function conn(start: string, end: string, extra: Partial<Connection> = {}): Connection {
    return {connection_start_timestamp: start, connection_end_timestamp: end, connection_elements: [], ...extra};
}

class MemoryStorage implements KeyValueStorage {
    data = new Map<string, string>();
    getItem(key: string) { return this.data.get(key) ?? null; }
    setItem(key: string, value: string) { this.data.set(key, value); }
    removeItem(key: string) { this.data.delete(key); }
}

function t(key: string): string {
    return key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], translations.EN) as string ?? key;
}

describe('journey mode config validation', () => {
    const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => {});

    it('needs no activity fields, only the API token', () => {
        const {errors, config} = validateConfig(journeyConfig());
        expect(errors).toEqual([]);
        expect(config.requiredFields).toEqual(['apiToken']);
    });

    it('still requires the activity fields in activity mode', () => {
        const {errors} = validateConfig({...DEFAULT_CONFIG, apiToken: 'x'} as WidgetConfig);
        expect(errors[0]).toContain('Missing required configuration: activityStartLocation');
        expect(DEFAULT_CONFIG.requiredFields).toBe(REQUIRED_CONFIG_FIELDS);
    });

    it('rejects an unknown mode', () => {
        const {errors} = validateConfig(journeyConfig({mode: 'trip' as never}));
        expect(errors.some(e => e.includes("Invalid mode 'trip'"))).toBe(true);
    });

    it('rejects bad presets, multiday and a destination override without a valid type', () => {
        const {errors} = validateConfig(journeyConfig({
            journeyTime: '25:00', journeyDate: '2026-13-01', multiday: true,
            overrideUserDestinationLocation: 'Hallstatt', overrideUserDestinationLocationType: null,
        }));
        expect(errors).toEqual(expect.arrayContaining([
            "multiday is not supported with mode: 'journey'.",
            "Invalid journeyTime '25:00'. Expected HH:MM.",
            "Invalid journeyDate '2026-13-01'. Expected YYYY-MM-DD.",
            "Invalid or missing overrideUserDestinationLocationType 'null'.",
        ]));
    });

    it('checks destination coordinates', () => {
        const {errors} = validateConfig(journeyConfig({overrideUserDestinationLocation: '47.5,abc', overrideUserDestinationLocationType: 'coordinates'}));
        expect(errors.some(e => e.includes('Invalid coordinate format for overrideUserDestinationLocation'))).toBe(true);
    });

    it('rejects both ends locked to the same place', () => {
        const {errors} = validateConfig(journeyConfig({
            overrideUserStartLocation: 'Linz Hbf', overrideUserStartLocationType: 'station', disableUserStartLocationField: true,
            overrideUserDestinationLocation: 'linz hbf', overrideUserDestinationLocationType: 'station', disableUserDestinationLocationField: true,
        }));
        expect(errors).toContain('overrideUserStartLocation and overrideUserDestinationLocation are both locked to the same place.');
    });

    it('ignores a destination lock without a destination, and activity-only options', () => {
        const warn = quiet();
        const {errors, config} = validateConfig(journeyConfig({disableUserDestinationLocationField: true, dateList: ['2030-01-01'], activityName: 'X'}));
        expect(errors).toEqual([]);
        expect(config.disableUserDestinationLocationField).toBe(false);
        expect(config.dateList).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('warns about journey options in activity mode', () => {
        const warn = quiet();
        validateConfig({...DEFAULT_CONFIG, apiToken: 'x', journeyTitle: 'Hi'} as WidgetConfig);
        expect(warn.mock.calls.some(([m]) => String(m).includes('journeyTitle'))).toBe(true);
        warn.mockRestore();
    });
});

describe('prefill, lock and cache', () => {
    it('uses the override with its display name, locked when asked', () => {
        const config = journeyConfig({
            overrideUserDestinationLocation: '47.5622, 13.6487', overrideUserDestinationLocationType: 'coordinates',
            overrideUserDestinationLocationDisplayName: 'Hallstatt', disableUserDestinationLocationField: true,
        });
        const prefill = resolveEndpointPrefill(config, 'destination', null);
        expect(prefill).toMatchObject({text: 'Hallstatt', lat: '47.5622', lon: '13.6487', locked: true, source: 'override'});
        expect(endpointRequestParams(prefill)).toEqual({location: '47.5622,13.6487', type: 'coordinates'});
    });

    it('keeps sending a station override while showing its display name', () => {
        const config = journeyConfig({overrideUserStartLocation: 'Linz Hbf', overrideUserStartLocationType: 'station', overrideUserStartLocationDisplayName: 'Linz Hauptbahnhof'});
        const prefill = resolveEndpointPrefill(config, 'origin', {value: 'Cached', lat: '1', lon: '2', timestamp: 0});
        expect(prefill).toMatchObject({text: 'Linz Hauptbahnhof', locked: false, source: 'override'});
        expect(isEndpointResolved(prefill)).toBe(true);
        expect(endpointRequestParams(prefill)).toEqual({location: 'Linz Hbf', type: 'station'});
    });

    it('falls back to the cached place, then to an empty field', () => {
        const cached = {value: 'Salzburg Hbf', lat: '47.81', lon: '13.04', timestamp: 0};
        expect(resolveEndpointPrefill(journeyConfig(), 'origin', cached)).toMatchObject({text: 'Salzburg Hbf', lat: '47.81', source: 'cache', locked: false});
        expect(resolveEndpointPrefill(journeyConfig(), 'destination', null)).toMatchObject({text: '', source: 'none'});
    });

    it('sends free text as an address', () => {
        expect(endpointRequestParams(endpoint({text: ' Hallstatt '}))).toEqual({location: 'Hallstatt', type: 'address'});
        expect(isEndpointResolved(endpoint({text: 'Hallstatt'}))).toBe(false);
    });

    it('reads, expires and lists cached places', () => {
        const storage = new MemoryStorage();
        writeCachedLocation(storage, 'k', 'Hallstatt', 47.56, 13.64, 3, 1_000);
        writeCachedLocation(storage, 'k', 'Linz', 48.29, 14.29, 3, 2_000);
        expect(readCachedLocation(storage, 'k', 15, 3_000)?.value).toBe('Linz');
        expect(readRecentLocations(storage, 'k', 15, 3_000).map(e => e.value)).toEqual(['Linz', 'Hallstatt']);
        expect(readCachedLocation(storage, 'k', 15, 2_000 + 16 * 60_000)).toBeNull();
        expect(storage.getItem('k')).toBeNull();
    });
});

describe('swap and identical ends', () => {
    it('swaps both ends with everything they send', () => {
        const a = endpoint({text: 'Linz', lat: '48.29', lon: '14.29'});
        const b = endpoint({text: 'Hallstatt', locationValue: 'Hallstatt', locationType: 'station'});
        const [origin, destination] = swapEndpoints(a, b);
        expect(origin).toEqual(b);
        expect(destination).toEqual(a);
        expect(origin).not.toBe(b);
    });

    it('detects the same place by coordinates or name', () => {
        expect(sameEndpoint(endpoint({text: 'A', lat: '48.29001', lon: '14.29'}), endpoint({text: 'B', lat: '48.29', lon: '14.29'}))).toBe(true);
        expect(sameEndpoint(endpoint({text: 'Linz  Hbf'}), endpoint({text: 'linz hbf'}))).toBe(true);
        expect(sameEndpoint(endpoint({text: 'Linz'}), endpoint({text: 'Wels'}))).toBe(false);
        expect(sameEndpoint(endpoint({text: 'A', lat: '48', lon: '14'}), endpoint({text: 'B', lat: '47', lon: '13'}))).toBe(false);
    });
});

describe('date, time and request parameters', () => {
    const now = DateTime.fromISO('2026-11-27T13:05:00Z');

    it('starts with today and now in the widget timezone', () => {
        expect(initialJourneyDateTime(journeyConfig(), now)).toEqual({date: '2026-11-27', time: '14:05', arriveBy: false});
    });

    it('takes the presets, but not a date in the past', () => {
        expect(initialJourneyDateTime(journeyConfig({journeyDate: '2026-12-24', journeyTime: '9:30', journeyArriveBy: true}), now))
            .toEqual({date: '2026-12-24', time: '09:30', arriveBy: true});
        expect(initialJourneyDateTime(journeyConfig({journeyDate: '2026-01-01'}), now).date).toBe('2026-11-27');
    });

    it('converts the local time to UTC, moving the date when needed', () => {
        const params = buildJourneyParams({
            origin: endpoint({text: 'Wien Westbahnhof', lat: '48.196', lon: '16.338'}),
            destination: endpoint({text: 'Salzburg Hbf', locationValue: 'Salzburg Hbf', locationType: 'station'}),
            instant: DateTime.fromISO('2026-11-28T00:30', {zone: 'Europe/Vienna'}),
            isArrival: true,
            useFlex: true,
            language: 'DE',
        });
        expect(params).toEqual({
            from_location: '48.196,16.338', from_location_type: 'coordinates',
            to_location: 'Salzburg Hbf', to_location_type: 'station',
            date: '2026-11-27', time: '23:30', is_arrival: 'true', use_flex: 'true', lang: 'de',
        });
    });

    it('respects summer time', () => {
        const params = buildJourneyParams({
            origin: endpoint({text: 'A'}), destination: endpoint({text: 'B'}),
            instant: DateTime.fromISO('2026-07-01T08:00', {zone: 'Europe/Vienna'}), isArrival: false, useFlex: false,
        });
        expect(params).toMatchObject({date: '2026-07-01', time: '06:00', is_arrival: 'false'});
        expect(params.use_flex).toBeUndefined();
    });
});

describe('earlier / later paging', () => {
    const list = [
        conn('2026-11-28T08:02:00Z', '2026-11-28T11:09:00Z'),
        conn('2026-11-28T08:28:00Z', '2026-11-28T11:00:00Z'),
        conn('2026-11-28T09:28:00Z', '2026-11-28T12:00:00Z'),
    ];

    it('searches later from after the last departure', () => {
        const q = pageQuery(list, 'later')!;
        expect(q.isArrival).toBe(false);
        expect(q.instant.toUTC().toISO()).toBe('2026-11-28T09:29:00.000Z');
    });

    it('searches earlier as arrive-by before the first arrival', () => {
        const q = pageQuery(list, 'earlier')!;
        expect(q.isArrival).toBe(true);
        expect(q.instant.toUTC().toISO()).toBe('2026-11-28T10:59:00.000Z');
    });

    it('has nothing to page from without timed connections', () => {
        expect(pageQuery([conn('2026-11-28T08:00:00Z', '2026-11-28T09:00:00Z', {connection_anytime: true})], 'later')).toBeNull();
    });

    it('adds only new connections, ordered by departure', () => {
        const incoming = [conn('2026-11-28T07:00:00Z', '2026-11-28T10:00:00Z'), conn('2026-11-28T08:02:00Z', '2026-11-28T11:09:00Z')];
        const {merged, added} = mergeConnections(list, incoming);
        expect(added).toBe(1);
        expect(merged.map(c => c.connection_start_timestamp.slice(11, 16))).toEqual(['07:00', '08:02', '08:28', '09:28']);
        expect(merged[1]).toBe(list[0]);
        expect(connectionKey(incoming[1])).toBe(connectionKey(list[0]));
    });

    it('drops arrive-by answers arriving far too early, unless nothing would be left', () => {
        const target = DateTime.fromISO('2026-11-28T10:00:00Z');
        const answer = [conn('2026-11-27T13:28:00Z', '2026-11-27T16:09:00Z'), conn('2026-11-28T07:24:00Z', '2026-11-28T10:00:00Z')];
        expect(filterArriveByWindow(answer, target)).toEqual([answer[1]]);
        expect(filterArriveByWindow([answer[0]], target)).toEqual([answer[0]]);
    });
});

describe('journey templates and texts', () => {
    it('uses journeyTitle, then activityName, then the default; empty means none', () => {
        expect(resolveJourneyTitle({journeyTitle: 'To Hallstatt'}, 'Plan')).toBe('To Hallstatt');
        expect(resolveJourneyTitle({activityName: 'Tour'}, 'Plan')).toBe('Tour');
        expect(resolveJourneyTitle({}, 'Plan')).toBe('Plan');
        expect(resolveJourneyTitle({journeyTitle: ''}, 'Plan')).toBe('');
    });

    const formArgs = (config: WidgetConfig) => ({config, t, state: {useFlex: false}});

    it('renders both fields and the swap button when nothing is locked', () => {
        const html = getJourneyFormPageTemplateHTML(formArgs(journeyConfig()));
        expect(html).toContain('id="originInput"');
        expect(html).toContain('id="destinationInput"');
        expect(html).toContain('id="swapLocationsBtn"');
        expect(html).toContain('id="journeyTimeInput"');
        expect(html).toContain('Plan your journey');
    });

    it('shows a locked end as text, escaped, and offers no swap', () => {
        const html = getJourneyFormPageTemplateHTML(formArgs(journeyConfig({
            overrideUserDestinationLocation: 'Hallstatt', overrideUserDestinationLocationType: 'address',
            overrideUserDestinationLocationDisplayName: 'Hallstatt <Markt>', disableUserDestinationLocationField: true,
        })));
        expect(html).toContain('Hallstatt &lt;Markt&gt;');
        expect(html).toContain('<input type="hidden" id="destinationInput"');
        expect(html).not.toContain('swapLocationsBtn');
    });

    it('disables sharing and adds the route summary on the results page', () => {
        const html = getResultsPageTemplateHTML({config: journeyConfig({share: true}), t});
        expect(html).toContain('id="journeyRouteSummary"');
        expect(html).toMatch(/menu-dropdown-item disabled" data-action="share"/);
        expect(html).toContain('journey-mode');
    });

    it('maps the /journey error codes', () => {
        expect(getApiErrorTranslationKey('8002')).toBe('journeyMode.errors.fromNotFound');
        expect(getApiErrorTranslationKey('8006')).toBe('journeyMode.errors.toNotFound');
        expect(getApiErrorTranslationKey('8011')).toBe('journeyMode.errors.noConnections');
        expect(getApiErrorTranslationKey('8012')).toBe('journeyMode.errors.noFutureConnections');
    });

    it('has every journey text in all six languages', () => {
        const keys = (o: object, prefix = ''): string[] => Object.entries(o).flatMap(([k, v]) =>
            v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
        const en = keys(translations.EN.journeyMode).sort();
        (['DE', 'FR', 'IT', 'ES', 'TH'] as const).forEach(lang => {
            expect(keys(translations[lang].journeyMode).sort()).toEqual(en);
        });
    });
});
