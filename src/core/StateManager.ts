/**
 * State management logic for DianaWidget
 * 
 * Manages the widget's state and provides methods for state updates.
 */

import type {
    WidgetState,
    ActivityTimes,
    PreselectTimes,
    Connection,
    Suggestion
} from '../types';
import { DEFAULT_STATE } from '../constants';

/**
 * Callback type for state change notifications
 */
export type StateChangeCallback = (state: WidgetState) => void;

/**
 * State manager class for handling widget state
 */
export class StateManager {
    private state: WidgetState;
    private listeners: StateChangeCallback[];

    /**
     * Creates an instance of StateManager
     * @param initialState - Optional initial state to override defaults
     */
    constructor(initialState?: Partial<WidgetState>) {
        this.state = { ...DEFAULT_STATE, ...initialState };
        this.listeners = [];
    }

    /**
     * Gets a copy of the current state
     * @returns Copy of current state
     */
    getState(): WidgetState {
        return { ...this.state };
    }

    /**
     * Updates the state with partial updates
     * @param updates - Partial state updates
     */
    setState(updates: Partial<WidgetState>): void {
        // Check if any values actually changed
        let hasChanged = false;
        for (const key in updates) {
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                const updateKey = key as keyof WidgetState;
                if (this.state[updateKey] !== updates[updateKey]) {
                    hasChanged = true;
                    break;
                }
            }
        }
        
        if (hasChanged) {
            this.state = { ...this.state, ...updates };
            this.notifyListeners();
        }
    }

    /**
     * Resets state to default values
     */
    reset(): void {
        this.state = { ...DEFAULT_STATE };
        this.notifyListeners();
    }

    /**
     * Subscribes to state changes
     * @param callback - Function to call on state changes
     * @returns Unsubscribe function
     */
    subscribe(callback: StateChangeCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifies all listeners of state change
     * Creates a single copy of state and reuses for all listeners
     */
    private notifyListeners(): void {
        if (this.listeners.length === 0) return;
        const currentState = this.getState();
        this.listeners.forEach(callback => callback(currentState));
    }

    // ==================== Convenience Methods ====================

    /**
     * Gets the selected start date
     */
    get selectedDate(): Date | null {
        return this.state.selectedDate;
    }

    /**
     * Sets the selected start date
     */
    set selectedDate(date: Date | null) {
        this.setState({ selectedDate: date });
    }

    /**
     * Gets the selected end date
     */
    get selectedEndDate(): Date | null {
        return this.state.selectedEndDate;
    }

    /**
     * Sets the selected end date
     */
    set selectedEndDate(date: Date | null) {
        this.setState({ selectedEndDate: date });
    }

    /**
     * Gets the loading state
     */
    get loading(): boolean {
        return this.state.loading;
    }

    /**
     * Sets the loading state
     */
    set loading(isLoading: boolean) {
        this.setState({ loading: isLoading });
    }

    /**
     * Gets the error message
     */
    get error(): string | null {
        return this.state.error;
    }

    /**
     * Sets the error message
     */
    set error(message: string | null) {
        this.setState({ error: message });
    }

    /**
     * Gets the info message
     */
    get info(): string | null {
        return this.state.info;
    }

    /**
     * Sets the info message
     */
    set info(message: string | null) {
        this.setState({ info: message });
    }

    /**
     * Gets the suggestions array
     */
    get suggestions(): Suggestion[] {
        return this.state.suggestions;
    }

    /**
     * Sets the suggestions array
     */
    set suggestions(suggestions: Suggestion[]) {
        this.setState({ suggestions });
    }

    /**
     * Gets the to connections
     */
    get toConnections(): Connection[] {
        return this.state.toConnections;
    }

    /**
     * Sets the to connections
     */
    set toConnections(connections: Connection[]) {
        this.setState({ toConnections: connections });
    }

    /**
     * Gets the from connections
     */
    get fromConnections(): Connection[] {
        return this.state.fromConnections;
    }

    /**
     * Sets the from connections
     */
    set fromConnections(connections: Connection[]) {
        this.setState({ fromConnections: connections });
    }

    /**
     * Gets the selected to connection
     */
    get selectedToConnection(): Connection | null {
        return this.state.selectedToConnection;
    }

    /**
     * Sets the selected to connection
     */
    set selectedToConnection(connection: Connection | null) {
        this.setState({ selectedToConnection: connection });
    }

    /**
     * Gets the selected from connection
     */
    get selectedFromConnection(): Connection | null {
        return this.state.selectedFromConnection;
    }

    /**
     * Sets the selected from connection
     */
    set selectedFromConnection(connection: Connection | null) {
        this.setState({ selectedFromConnection: connection });
    }

    /**
     * Gets the activity times
     */
    get activityTimes(): ActivityTimes {
        return this.state.activityTimes;
    }

    /**
     * Sets the activity times
     */
    set activityTimes(times: ActivityTimes) {
        this.setState({ activityTimes: times });
    }

    /**
     * Gets the current content key
     */
    get currentContentKey(): string | null {
        return this.state.currentContentKey;
    }

    /**
     * Sets the current content key
     */
    set currentContentKey(key: string | null) {
        this.setState({ currentContentKey: key });
    }

    /**
     * Gets the preselect times
     */
    get preselectTimes(): PreselectTimes | null {
        return this.state.preselectTimes;
    }

    /**
     * Sets the preselect times
     */
    set preselectTimes(times: PreselectTimes | null) {
        this.setState({ preselectTimes: times });
    }

    /**
     * Gets the recommended to index
     */
    get recommendedToIndex(): number {
        return this.state.recommendedToIndex;
    }

    /**
     * Sets the recommended to index
     */
    set recommendedToIndex(index: number) {
        this.setState({ recommendedToIndex: index });
    }

    /**
     * Gets the recommended from index
     */
    get recommendedFromIndex(): number {
        return this.state.recommendedFromIndex;
    }

    /**
     * Sets the recommended from index
     */
    set recommendedFromIndex(index: number) {
        this.setState({ recommendedFromIndex: index });
    }

    // ==================== State Update Helpers ====================

    /**
     * Clears connection data
     */
    clearConnections(): void {
        this.setState({
            toConnections: [],
            fromConnections: [],
            selectedToConnection: null,
            selectedFromConnection: null,
            activityTimes: {
                start: '',
                end: '',
                duration: '',
                warning_duration: false
            }
        });
    }

    /**
     * Clears messages (error and info)
     */
    clearMessages(): void {
        this.setState({
            error: null,
            info: null
        });
    }

    /**
     * Sets connections data after search
     * @param toConnections - Connections to activity
     * @param fromConnections - Connections from activity
     * @param recommendedToIndex - Recommended to-connection index
     * @param recommendedFromIndex - Recommended from-connection index
     */
    setConnectionsData(
        toConnections: Connection[],
        fromConnections: Connection[],
        recommendedToIndex: number = 0,
        recommendedFromIndex: number = 0
    ): void {
        this.setState({
            toConnections,
            fromConnections,
            recommendedToIndex,
            recommendedFromIndex
        });
    }

    /**
     * Updates dates for single day mode
     * @param date - The selected date
     */
    updateSingleDate(date: Date | null): void {
        this.setState({
            selectedDate: date
        });
    }

    /**
     * Updates dates for multiday mode
     * @param startDate - The start date
     * @param endDate - The end date
     */
    updateDateRange(startDate: Date | null, endDate: Date | null): void {
        this.setState({
            selectedDate: startDate,
            selectedEndDate: endDate
        });
    }
}
