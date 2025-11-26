/**
 * API Service for DianaWidget
 * 
 * Handles all HTTP communication with the backend API.
 */

import type { WidgetConfig } from '../types';

/**
 * Extended Error interface for API errors
 */
export interface ApiError extends Error {
    isSessionExpired?: boolean;
    response?: Response;
    body?: unknown;
}

/**
 * Options for fetch API calls
 */
export interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

/**
 * Callback type for handling session expiration
 */
export type SessionExpiredHandler = () => void;

/**
 * Callback type for token refresh
 */
export type TokenRefreshCallback = () => Promise<string | void>;

/**
 * API Service class for handling HTTP requests
 */
export class ApiService {
    private config: Pick<WidgetConfig, 'apiToken' | 'apiBaseUrl' | 'onApiTokenExpired'>;
    private onSessionExpired: SessionExpiredHandler;
    private getErrorMessage: (key: string) => string;

    /**
     * Creates an instance of ApiService
     * @param config - Widget configuration containing API settings
     * @param onSessionExpired - Callback when session expires
     * @param getErrorMessage - Function to get translated error messages
     */
    constructor(
        config: Pick<WidgetConfig, 'apiToken' | 'apiBaseUrl' | 'onApiTokenExpired'>,
        onSessionExpired: SessionExpiredHandler,
        getErrorMessage: (key: string) => string
    ) {
        this.config = config;
        this.onSessionExpired = onSessionExpired;
        this.getErrorMessage = getErrorMessage;
    }

    /**
     * Updates the API token
     * @param token - New API token
     */
    setApiToken(token: string): void {
        this.config.apiToken = token;
    }

    /**
     * Gets the base URL for API calls
     */
    get baseUrl(): string {
        return this.config.apiBaseUrl;
    }

    /**
     * Makes an authenticated API request
     * @param url - URL to fetch
     * @param options - Fetch options
     * @param isRetry - Whether this is a retry after token refresh
     * @returns Promise resolving to the Response
     * @throws ApiError on failure
     */
    async fetch(url: string, options: FetchOptions = {}, isRetry: boolean = false): Promise<Response> {
        const fetchOptions: FetchOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        };

        const response = await fetch(url, fetchOptions);

        if (response.ok) {
            return response;
        }

        // Handle 401 Unauthorized
        if (response.status === 401 && !isRetry) {
            return this.handleUnauthorized(url, options);
        }

        // Create and throw API error
        const error: ApiError = new Error(`API Error: ${response.status} ${response.statusText}`);
        error.response = response;
        try {
            error.body = await response.clone().json();
        } catch (e) {
            error.body = await response.clone().text();
        }
        throw error;
    }

    /**
     * Handles 401 Unauthorized response
     */
    private async handleUnauthorized(url: string, options: FetchOptions): Promise<Response> {
        if (typeof this.config.onApiTokenExpired === 'function') {
            try {
                const newToken = await this.config.onApiTokenExpired();
                if (typeof newToken === 'string' && newToken) {
                    this.config.apiToken = newToken;
                    return this.fetch(url, options, true);
                }
                throw new Error("onApiTokenExpired callback did not return a valid string token.");
            } catch (error) {
                console.error("Token refresh via onApiTokenExpired failed:", error);
                this.onSessionExpired();
                const sessionError: ApiError = new Error(this.getErrorMessage('errors.sessionExpired'));
                sessionError.isSessionExpired = true;
                throw sessionError;
            }
        } else {
            this.onSessionExpired();
            const sessionError: ApiError = new Error(this.getErrorMessage('errors.sessionExpired'));
            sessionError.isSessionExpired = true;
            throw sessionError;
        }
    }

    /**
     * Fetches address autocomplete suggestions
     * @param query - Search query
     * @returns Promise resolving to suggestion data
     */
    async fetchAddressSuggestions(query: string): Promise<{ features: unknown[] }> {
        const fetchLang = navigator.language.split("-")[0];
        const response = await this.fetch(
            `${this.config.apiBaseUrl}/address-autocomplete?q=${encodeURIComponent(query)}&lang=${fetchLang}`
        );
        return await response.json();
    }

    /**
     * Fetches reverse geocode data for coordinates
     * @param latitude - Latitude coordinate
     * @param longitude - Longitude coordinate
     * @returns Promise resolving to geocode data
     */
    async fetchReverseGeocode(latitude: number, longitude: number): Promise<unknown> {
        const response = await this.fetch(
            `${this.config.apiBaseUrl}/reverse-geocode?lat=${latitude}&lon=${longitude}`
        );
        return await response.json();
    }

    /**
     * Fetches connection data
     * @param params - Query parameters for the connections endpoint
     * @returns Promise resolving to connection data
     */
    async fetchConnections(params: Record<string, string | number | undefined>): Promise<unknown> {
        // Filter out undefined values and convert numbers to strings
        const cleanParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                cleanParams[key] = String(value);
            }
        }
        const queryString = new URLSearchParams(cleanParams);
        const response = await this.fetch(
            `${this.config.apiBaseUrl}/connections?${queryString}`
        );
        return await response.json();
    }

    /**
     * Generates a ticketshop link
     * @param data - Data to send for link generation
     * @returns Promise resolving to the ticketshop link response
     */
    async generateTicketshopLink(data: unknown): Promise<unknown> {
        const response = await this.fetch(`${this.config.apiBaseUrl}/generate-ticketshop-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    /**
     * Creates a share link
     * @param data - Data to share
     * @returns Promise resolving to the share response
     */
    async createShare(data: unknown): Promise<unknown> {
        const response = await this.fetch(`${this.config.apiBaseUrl}/share/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    /**
     * Fetches shared data by ID
     * @param shareId - ID of the shared data
     * @returns Promise resolving to the shared data
     */
    async fetchShare(shareId: string): Promise<unknown> {
        const response = await this.fetch(`${this.config.apiBaseUrl}/share/${shareId}/`);
        return await response.json();
    }
}

/**
 * Interface for API error body with code
 */
interface ApiErrorBody {
    code?: string;
    error?: string;
}

/**
 * Type guard to check if error body has a code property
 */
function hasErrorCode(body: unknown): body is ApiErrorBody {
    return typeof body === 'object' && body !== null && 'code' in body && typeof (body as ApiErrorBody).code === 'string';
}

/**
 * Helper function to determine error message from API error
 * @param error - The error object
 * @param getErrorMessage - Translation function
 * @returns Translated error message
 */
export function getApiErrorMessage(
    error: ApiError,
    getErrorMessage: (key: string) => string,
    getApiErrorTranslationKey: (code: string) => string
): string {
    if (error.body && hasErrorCode(error.body) && error.body.code) {
        return getErrorMessage(getApiErrorTranslationKey(error.body.code));
    } else if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        return !window.navigator.onLine 
            ? getErrorMessage('errors.api.networkError') 
            : getErrorMessage('errors.api.apiUnreachable');
    }
    return getErrorMessage('errors.api.unknown');
}
