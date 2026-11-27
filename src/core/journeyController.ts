/**
 * The DOM side of journey mode (`mode: 'journey'`): the destination field, swap, time and
 * depart/arrive controls, the search against `GET /journey`, paging through earlier and
 * later connections, and the results page.
 *
 * The widget keeps doing everything both modes share (autocomplete, current location,
 * date field, time-slot slider, connection details, tickets); it asks this controller at a
 * few points which field is active and how to search.
 */

import { DateTime } from 'luxon';
import {
    buildJourneyParams,
    cacheEnabled,
    filterArriveByWindow,
    initialJourneyDateTime,
    isEndpointResolved,
    journeyInstantUtc,
    mergeConnections,
    pageQuery,
    readCachedLocation,
    readRecentLocations,
    resolveEndpointPrefill,
    sameEndpoint,
    swapEndpoints,
    writeCachedLocation,
    type CachedLocation,
    type JourneyEndpointRole,
    type JourneyEndpointState,
    type KeyValueStorage,
} from './journeyMode';
import { isConnectionDeparted } from './pastConnections';
import { dateToIso } from './dateSelection';
import { formatIsoDay } from '../utils';
import { escapeHtml } from './legInfo';
import type { ApiService, ApiError } from '../services';
import type { Connection, LocationType, Suggestion } from '../types';
import type DianaWidget from './widget';

/** How many recently picked destinations the destination field offers. */
const MAX_RECENT_DESTINATIONS = 3;

/** API codes that mean "nothing (more) for this route and time" rather than a failure. */
const NO_CONNECTION_CODES = new Set(['8011', '8012']);

/** The search the connections on screen belong to; paging continues from it. */
interface JourneySearch {
    origin: JourneyEndpointState;
    destination: JourneyEndpointState;
    date: string;
    time: string;
    arriveBy: boolean;
    useFlex: boolean;
}

interface FieldElements {
    input: HTMLInputElement | null;
    suggestions: HTMLElement | null;
    clearBtn: HTMLButtonElement | null;
    locateBtn: HTMLButtonElement | null;
    error: HTMLElement | null;
}

export class JourneyController {
    private widget: DianaWidget;
    private api: ApiService | null;
    private destinationCacheKey: string;
    private arriveBy = false;
    private lastSearch: JourneySearch | null = null;

    constructor(widget: DianaWidget, api: ApiService | null, containerId: string) {
        this.widget = widget;
        this.api = api;
        this.destinationCacheKey = `${containerId}_userDestinationLocation`;
    }

    private get root(): ShadowRoot | null {
        return this.widget.shadowRoot;
    }

    private get storage(): KeyValueStorage | null {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    private t(key: string, replacements?: Record<string, string>): string {
        return this.widget.t(key, replacements);
    }

    field(role: JourneyEndpointRole): FieldElements {
        const q = <T extends Element>(id: string) => this.root?.getElementById(id) as T | null ?? null;
        return role === 'origin'
            ? {
                input: q<HTMLInputElement>('originInput'),
                suggestions: q('suggestions'),
                clearBtn: q<HTMLButtonElement>('clearInputBtn'),
                locateBtn: q<HTMLButtonElement>('currentLocationBtn'),
                error: q('originError'),
            }
            : {
                input: q<HTMLInputElement>('destinationInput'),
                suggestions: q('destinationSuggestions'),
                clearBtn: q<HTMLButtonElement>('destinationClearBtn'),
                locateBtn: q<HTMLButtonElement>('destinationLocationBtn'),
                error: q('destinationError'),
            };
    }

    /** The field the autocomplete and the current-location lookup currently work on. */
    get activeField(): JourneyEndpointRole {
        return this.widget._activeLocationField;
    }

    // ------------------------------------------------------------------ form setup

    /** Prefills both ends, the time and the depart/arrive choice, and binds the journey controls. */
    init(): void {
        const config = this.widget.config;
        this.widget._activeLocationField = 'origin';

        const origin = resolveEndpointPrefill(config, 'origin', this.widget._getCachedStartLocation());
        const destination = resolveEndpointPrefill(config, 'destination', this.getCachedDestination());
        this.write('origin', origin);
        this.write('destination', destination);
        // A host-provided default is trusted as-is, like the activity form's default origin.
        [this.field('origin').input, this.field('destination').input].forEach(input => {
            if (input) input.defaultValue = input.value;
        });

        const initial = initialJourneyDateTime(config);
        const timeInput = this.timeInput();
        if (timeInput) timeInput.value = initial.time;
        this.setArriveBy(initial.arriveBy);

        this.bind();
        this.syncFieldButtons('origin');
        this.syncFieldButtons('destination');
        this.syncRouteState();
    }

    private timeInput(): HTMLInputElement | null {
        return this.root?.getElementById('journeyTimeInput') as HTMLInputElement | null ?? null;
    }

    private bind(): void {
        const route = this.root?.querySelector('.journey-route') as HTMLElement | null;
        if (route) {
            // Capturing listeners run before the fields' own ones, so the shared autocomplete
            // already knows which field it serves when it reacts to the same event.
            const track = (event: Event) => {
                const owner = (event.target as Element | null)?.closest?.('[data-location-field]') as HTMLElement | null;
                const role = owner?.dataset.locationField as JourneyEndpointRole | undefined;
                if (!role || role === this.widget._activeLocationField) return;
                this.closeList(this.widget._activeLocationField);
                this.widget._activeLocationField = role;
            };
            ['focus', 'pointerdown', 'keydown', 'input', 'click'].forEach(type => route.addEventListener(type, track, true));
            // Typing replaces a prefilled place: what is sent is then the text (or the next pick).
            route.addEventListener('input', (event) => {
                const target = event.target as HTMLElement;
                target.removeAttribute('data-location-value');
                target.removeAttribute('data-location-type');
            }, true);
        }

        const {input, suggestions, clearBtn, locateBtn} = this.field('destination');
        if (input && input.type !== 'hidden') {
            input.setAttribute('aria-autocomplete', 'list');
            input.addEventListener('input', () => {
                input.removeAttribute('data-lat');
                input.removeAttribute('data-lon');
                this.widget.clearMessages();
                this.markInvalid('destination', false);
                this.widget.debouncedHandleAddressInput(input.value.trim());
                this.syncFieldButtons('destination');
                this.syncRouteState();
            });
            input.addEventListener('keydown', (e) => this.widget._handleOriginInputKeydown(e));
            input.addEventListener('focus', () => {
                if (!input.value.trim()) this.showRecent('destination');
            });
            suggestions?.addEventListener('click', (e) => {
                const item = (e.target as HTMLElement).closest('.suggestion-item') as HTMLElement | null;
                if (item) this.widget.handleSuggestionSelect(item.dataset.value, item.dataset.lat, item.dataset.lon);
            });
            clearBtn?.addEventListener('click', () => {
                this.write('destination', {text: '', lat: null, lon: null, locationValue: null, locationType: null});
                this.syncFieldButtons('destination');
                this.syncRouteState();
                input.focus();
                this.showRecent('destination');
            });
            locateBtn?.addEventListener('click', () => void this.widget.handleCurrentLocation());
        }

        this.root?.getElementById('swapLocationsBtn')?.addEventListener('click', () => this.swap());

        const timeInput = this.timeInput();
        timeInput?.addEventListener('input', () => {
            this.setTimeError(null);
            this.widget.clearMessages();
        });

        const modeButtons = Array.from(this.root?.querySelectorAll<HTMLButtonElement>('.journey-time-mode-btn') ?? []);
        modeButtons.forEach(button => {
            button.addEventListener('click', () => this.setArriveBy(button.dataset.arriveBy === 'true'));
            button.addEventListener('keydown', (e) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                this.setArriveBy(!this.arriveBy);
                (modeButtons.find(b => b.getAttribute('aria-checked') === 'true'))?.focus();
            });
        });

        // Closes a field's list when the click lands outside that field.
        document.addEventListener('click', (e) => {
            const path = e.composedPath();
            (['origin', 'destination'] as JourneyEndpointRole[]).forEach(role => {
                const owner = this.field(role).input?.closest('.journey-endpoint');
                if (owner && !path.includes(owner)) this.closeList(role);
            });
        });
    }

    private setArriveBy(arriveBy: boolean): void {
        this.arriveBy = arriveBy;
        this.root?.querySelectorAll<HTMLButtonElement>('.journey-time-mode-btn').forEach(button => {
            const checked = (button.dataset.arriveBy === 'true') === arriveBy;
            button.setAttribute('aria-checked', String(checked));
            button.tabIndex = checked ? 0 : -1;
        });
        this.setTimeError(null);
    }

    // ------------------------------------------------------------------ field state

    read(role: JourneyEndpointRole): JourneyEndpointState {
        const input = this.field(role).input;
        return {
            text: input?.value ?? '',
            lat: input?.getAttribute('data-lat') ?? null,
            lon: input?.getAttribute('data-lon') ?? null,
            locationValue: input?.getAttribute('data-location-value') ?? null,
            locationType: (input?.getAttribute('data-location-type') as LocationType | null) ?? null,
        };
    }

    write(role: JourneyEndpointRole, state: JourneyEndpointState): void {
        const input = this.field(role).input;
        if (!input) return;
        input.value = state.text;
        const set = (name: string, value: string | null) => {
            if (value) input.setAttribute(name, value);
            else input.removeAttribute(name);
        };
        set('data-lat', state.lat && state.lon ? state.lat : null);
        set('data-lon', state.lat && state.lon ? state.lon : null);
        set('data-location-value', state.locationValue);
        set('data-location-type', state.locationValue ? state.locationType : null);
    }

    /** Clear button while a field has text, current-location button while it is empty. */
    syncFieldButtons(role: JourneyEndpointRole): void {
        const {input, clearBtn, locateBtn} = this.field(role);
        if (!input || !clearBtn || !locateBtn) return;
        const hasValue = !!input.value.trim();
        clearBtn.hidden = !hasValue;
        locateBtn.hidden = hasValue;
    }

    /** Fills the origin dot and destination pin once matched, and draws the line solid when both are. */
    syncRouteState(): void {
        const originResolved = isEndpointResolved(this.read('origin'));
        const destinationResolved = isEndpointResolved(this.read('destination'));
        this.root?.getElementById('originDot')?.classList.toggle('is-resolved', originResolved);
        this.root?.getElementById('destinationPin')?.classList.toggle('is-resolved', destinationResolved);
        this.root?.getElementById('routeRail')?.classList.toggle('is-resolved', originResolved && destinationResolved);
    }

    markInvalid(role: JourneyEndpointRole, invalid: boolean, message: string | null = null): void {
        const {input, error} = this.field(role);
        if (input) {
            if (invalid) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');
        }
        if (error) {
            error.textContent = invalid && message ? message : '';
            error.hidden = !(invalid && message);
        }
    }

    private setTimeError(message: string | null): void {
        const el = this.root?.getElementById('journeyTimeError');
        if (!el) return;
        el.textContent = message ?? '';
        el.hidden = !message;
    }

    /** Hides one field's suggestion list without touching the other field's. */
    closeList(role: JourneyEndpointRole): void {
        const {input, suggestions} = this.field(role);
        if (!suggestions || suggestions.style.display !== 'block') return;
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        input?.setAttribute('aria-expanded', 'false');
        input?.removeAttribute('aria-activedescendant');
        if (this.widget._activeLocationField === role) this.widget.state.suggestions = [];
    }

    /** A place picked from the list (or the current location) for the destination. */
    applyPickedDestination(value: string, lat: string | number | null, lon: string | number | null): void {
        this.write('destination', {
            text: value,
            lat: lat != null && lat !== '' ? String(lat) : null,
            lon: lon != null && lon !== '' ? String(lon) : null,
            locationValue: null,
            locationType: null,
        });
        this.markInvalid('destination', false);
        this.syncFieldButtons('destination');
        this.syncRouteState();
        this.setCachedDestination(value, lat, lon);
    }

    private swap(): void {
        const [origin, destination] = swapEndpoints(this.read('origin'), this.read('destination'));
        this.write('origin', origin);
        this.write('destination', destination);
        this.closeList('origin');
        this.closeList('destination');
        this.markInvalid('origin', false);
        this.markInvalid('destination', false);
        this.widget.clearMessages();
        this.syncFieldButtons('origin');
        this.syncFieldButtons('destination');
        this.syncRouteState();
        this.root?.getElementById('swapLocationsBtn')?.classList.toggle('is-flipped');
    }

    // ------------------------------------------------------------------ destination cache

    private destinationCacheOn(): boolean {
        return cacheEnabled(this.widget.config.cacheUserDestinationLocation);
    }

    getCachedDestination(): CachedLocation | null {
        const storage = this.storage;
        if (!storage || !this.destinationCacheOn()) return null;
        return readCachedLocation(storage, this.destinationCacheKey, this.widget.config.userDestinationLocationCacheTTLMinutes);
    }

    private setCachedDestination(value: string, lat: string | number | null, lon: string | number | null): void {
        const storage = this.storage;
        if (!storage || !this.destinationCacheOn()) return;
        writeCachedLocation(storage, this.destinationCacheKey, value, lat, lon, MAX_RECENT_DESTINATIONS);
    }

    /** Recently picked places for an empty, focused field (origins share the activity form's list). */
    showRecent(role: JourneyEndpointRole): void {
        if (role === 'origin') {
            this.widget._showRecentOrigins();
            return;
        }
        const storage = this.storage;
        const recent = storage && this.destinationCacheOn()
            ? readRecentLocations(storage, this.destinationCacheKey, this.widget.config.userDestinationLocationCacheTTLMinutes)
            : [];
        this.widget.state.suggestions = recent.map(entry => ({
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [Number(entry.lon), Number(entry.lat)]},
            diana_properties: {display_name: entry.value, location_type: 'recent'},
        })) as unknown as Suggestion[];
        this.widget.renderSuggestions(recent.length > 0 ? {text: this.t('recentOrigins'), isHeading: true} : null);
    }

    // ------------------------------------------------------------------ search

    /** The hint shown above the places when a typed name still has to be matched. */
    chooseFromListHint(): string {
        return this.activeField === 'destination' ? this.t('journeyMode.chooseDestinationFromList') : this.t('chooseOriginFromList');
    }

    /** Checks both ends and the time; shows what is missing right at the field. */
    async validateBeforeSearch(): Promise<boolean> {
        const roles: JourneyEndpointRole[] = ['origin', 'destination'];
        for (const role of roles) {
            const {input} = this.field(role);
            if (input && !input.value.trim()) {
                this.markInvalid(role, true, this.t(role === 'origin' ? 'infos.originRequired' : 'journeyMode.destinationRequired'));
                if (input.type !== 'hidden') input.focus();
                return false;
            }
        }
        for (const role of roles) {
            if (!(await this.ensureResolved(role))) return false;
        }

        if (sameEndpoint(this.read('origin'), this.read('destination'))) {
            // Point at the field the user can actually change.
            const target: JourneyEndpointRole = this.field('destination').input?.type === 'hidden' ? 'origin' : 'destination';
            this.markInvalid(target, true, this.t('journeyMode.sameEndpoints'));
            const input = this.field(target).input;
            if (input && input.type !== 'hidden') input.focus();
            return false;
        }

        const time = this.timeInput()?.value;
        if (!time) {
            this.setTimeError(this.t('journeyMode.timeRequired'));
            this.timeInput()?.focus();
            return false;
        }
        const date = dateToIso(this.widget.state.selectedDate);
        if (date && this.arriveBy && journeyInstantUtc(date, time, this.widget.config.timezone) < DateTime.utc()) {
            this.setTimeError(this.t('journeyMode.arrivalInPast'));
            return false;
        }
        this.setTimeError(null);
        return true;
    }

    /**
     * Typed text that was never matched to a place is offered as a list to pick from, as in
     * the activity form. If the lookup itself fails, the search goes ahead with the text.
     */
    private async ensureResolved(role: JourneyEndpointRole): Promise<boolean> {
        const {input} = this.field(role);
        const state = this.read(role);
        if (!input || isEndpointResolved(state)) return true;
        const query = input.value.trim();
        if (input.defaultValue.trim() && query === input.defaultValue.trim()) return true;

        this.widget._activeLocationField = role;
        let features: Suggestion[];
        try {
            const results = await this.widget.fetchSuggestions(query);
            features = results?.features ?? [];
        } catch (error) {
            return !(error as ApiError)?.isSessionExpired;
        }
        this.widget.lastQuery = query;
        this.widget.state.suggestions = features;
        this.widget.renderSuggestions(features.length > 0
            ? {text: this.chooseFromListHint()}
            : {text: this.t('originNotFound'), isError: true});
        this.markInvalid(role, true);
        input.focus();
        return false;
    }

    /** Disables the journey controls while a search runs. */
    setBusy(busy: boolean): void {
        const destination = this.field('destination').input;
        if (destination && destination.type !== 'hidden') destination.disabled = busy;
        const time = this.timeInput();
        if (time) time.disabled = busy;
        const swap = this.root?.getElementById('swapLocationsBtn') as HTMLButtonElement | null;
        if (swap) swap.disabled = busy;
    }

    /** Runs the search for what the form holds and renders the results. Throws on API errors. */
    async search(): Promise<void> {
        const date = dateToIso(this.widget.state.selectedDate);
        const time = this.timeInput()?.value;
        if (!date || !time) throw new Error(this.t('errors.api.unknown'));
        const search: JourneySearch = {
            origin: this.read('origin'),
            destination: this.read('destination'),
            date,
            time,
            arriveBy: this.arriveBy,
            useFlex: this.widget.state.useFlex,
        };
        const instant = journeyInstantUtc(date, time, this.widget.config.timezone);
        const result = await this.request(search, instant, search.arriveBy);

        let connections = this.prepare(result.connections);
        if (search.arriveBy) connections = filterArriveByWindow(connections, instant);

        this.lastSearch = search;
        const state = this.widget.state;
        state.toConnections = connections;
        state.fromConnections = [];
        state.selectedToConnection = null;
        state.selectedFromConnection = null;
        state.activity = null;
        state.recommendedToIndex = this.recommendedIndex(connections, result.recommended_connection_id, search.arriveBy);
        state.hasMoreBeforeToActivity = connections.length > 0;
        state.hasMoreAfterToActivity = connections.length > 0;
        state.hasMoreBeforeFromActivity = null;
        state.hasMoreAfterFromActivity = null;

        this.renderResults();
    }

    private async request(search: JourneySearch, instant: DateTime, isArrival: boolean): Promise<{connections: Connection[]; recommended_connection_id?: number}> {
        if (!this.api) throw new Error('ApiService not initialized');
        const params = buildJourneyParams({
            origin: search.origin,
            destination: search.destination,
            instant,
            isArrival,
            useFlex: search.useFlex,
            language: this.widget.config.language,
        });
        const result = await this.api.fetchJourney(params);
        if (!result || !Array.isArray(result.connections)) {
            const apiError: ApiError = new Error(this.t('errors.api.invalidDataReceived'));
            apiError.response = {
                json: async () => ({error: 'Invalid connection data', code: 'APP_INVALID_DATA'}),
                clone() { return this; },
                status: 500,
            } as unknown as Response;
            throw apiError;
        }
        return result;
    }

    /** Marks the route's real ends and drops departed connections unless the host wants them shown. */
    private prepare(connections: Connection[]): Connection[] {
        const kept = this.widget.config.showPastConnections
            ? connections
            : connections.filter(conn => !isConnectionDeparted(conn));
        this.widget._markConnectionElements(kept);
        return kept;
    }

    /** The API recommends by connection id; departure searches fall back to the first, arrive-by to the last. */
    private recommendedIndex(connections: Connection[], recommendedId: number | undefined, arriveBy: boolean): number {
        if (connections.length === 0) return 0;
        const byId = connections.findIndex(conn => conn.connection_id === recommendedId && !isConnectionDeparted(conn));
        if (byId !== -1) return byId;
        const upcoming = connections.map((conn, index) => ({conn, index})).filter(({conn}) => !isConnectionDeparted(conn));
        if (upcoming.length === 0) return arriveBy ? connections.length - 1 : 0;
        return arriveBy ? upcoming[upcoming.length - 1].index : upcoming[0].index;
    }

    /** Draws the slider and the recommended connection's details. */
    renderResults(): void {
        const widget = this.widget;
        const {elements, state} = widget;
        widget.showError(null, 'results');
        if (elements.topSlider) elements.topSlider.innerHTML = '';
        widget._resetCollapsibleSummary(elements.collapsibleToActivity);
        if (elements.responseBox) elements.responseBox.innerHTML = '';

        if (state.toConnections.length === 0) {
            widget.navigateToForm();
            widget.showError(this.t('journeyMode.errors.noConnections'), 'form');
            return;
        }

        this.renderRouteSummary();
        widget.renderTimeSlots('topSlider', state.toConnections, 'to');
        widget.selectConnectionByIndex('to', state.recommendedToIndex);
        widget.addSwipeBehavior('topSlider');
        widget.slideToRecommendedConnections();
        widget.updateScrollButtons();
    }

    /** "Linz Hbf → Hallstatt" and "Fri, 28 Nov · depart from 14:30" above the slider. */
    private renderRouteSummary(): void {
        const el = this.root?.getElementById('journeyRouteSummary');
        const search = this.lastSearch;
        if (!el || !search) return;
        const day = formatIsoDay(search.date, this.widget.config.language, 'short');
        const when = this.t(search.arriveBy ? 'journeyMode.summaryArrive' : 'journeyMode.summaryDepart', {date: day, time: search.time});
        el.innerHTML = `
            <p class="journey-route-summary-route">
                <span class="journey-route-summary-place">${escapeHtml(search.origin.text)}</span>
                <span class="journey-route-summary-arrow" aria-hidden="true">→</span>
                <span class="visually-hidden">${escapeHtml(this.t('journeyMode.destination'))}</span>
                <span class="journey-route-summary-place">${escapeHtml(search.destination.text)}</span>
            </p>
            <p class="journey-route-summary-when">${escapeHtml(when)}</p>`;
    }

    /** The destination as the connection details name it. */
    destinationName(): string {
        return this.lastSearch?.destination.text ?? this.read('destination').text;
    }

    /**
     * Earlier / later connections. `/journey` has no paging, so this searches again from
     * the edge of what is shown and adds whatever is new.
     */
    async loadMore(scrollType: 'before' | 'after'): Promise<void> {
        const widget = this.widget;
        const state = widget.state;
        const search = this.lastSearch;
        const button = (scrollType === 'before' ? widget.elements.topEarlierBtn : widget.elements.topLaterBtn) as HTMLButtonElement | null;
        const noMore = () => {
            if (scrollType === 'before') state.hasMoreBeforeToActivity = false;
            else state.hasMoreAfterToActivity = false;
        };
        const query = pageQuery(state.toConnections, scrollType === 'before' ? 'earlier' : 'later');
        if (!search || !query) {
            noMore();
            widget.updateScrollButtons();
            return;
        }

        if (button) {
            button.disabled = true;
            button.classList.add('loading');
        }
        try {
            const result = await this.request(search, query.instant, query.isArrival);
            const incoming = this.prepare(result.connections);
            const selected = state.selectedToConnection;
            const {merged, added} = mergeConnections(state.toConnections, incoming);
            if (added === 0) {
                noMore();
            } else {
                state.toConnections = merged;
                widget.renderTimeSlots('topSlider', merged, 'to');
                widget.addSwipeBehavior('topSlider');
                const index = selected ? merged.indexOf(selected) : -1;
                if (index !== -1) {
                    state.recommendedToIndex = index;
                    widget.elements.topSlider?.querySelectorAll('button').forEach(b => b.classList.remove('active-time'));
                    widget.elements.topSlider?.querySelector(`button[data-index="${index}"]`)?.classList.add('active-time');
                }
            }
        } catch (error) {
            const apiError = error as ApiError;
            if (apiError.isSessionExpired) return;
            const code = (apiError.body as {code?: string} | undefined)?.code;
            if (!code || !NO_CONNECTION_CODES.has(String(code))) console.error('Journey paging failed:', error);
            noMore();
        } finally {
            if (button) {
                button.disabled = false;
                button.classList.remove('loading');
            }
            widget.updateScrollButtons();
        }
    }
}
