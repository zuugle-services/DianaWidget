/**
 * Type exports for DianaWidget
 */

// Configuration types
export type { 
    WidgetConfig, 
    PartialWidgetConfig, 
    LocationType, 
    Language 
} from './config';

// State types
export type { 
    WidgetState, 
    ActivityTimes, 
    PreselectTimes 
} from './state';

// API types
export type { 
    Connection, 
    ConnectionElement,
    TransportLeg, 
    TransportAlert,
    Suggestion,
    SuggestionProperties,
    SuggestionGeometry,
    ConnectionSearchResponse,
    AutocompleteResponse,
    ShareDataResponse,
    CreateShareResponse,
    ApiErrorResponse
} from './api';

// Translation types
export type { 
    Translations,
    LanguageTranslations,
    TranslationFunction,
    MenuTranslations,
    WarningTranslations,
    InfoTranslations,
    ErrorTranslations,
    ApiErrorTranslations,
    DebugTranslations,
    AriaLabelTranslations,
    WaitingTranslations,
    VehicleTranslations,
    AlertTranslations
} from './translations';
