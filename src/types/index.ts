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
    ActivityTimes 
} from './state';

// API types
export type {
    Connection,
    ConnectionElement,
    ConnectionElementType,
    TransportLeg,
    TransportAlert,
    AlertSeverity,
    AlertScope,
    AlertTimeRange,
    FlexInfo,
    BookingType,
    BookingRule,
    LegBooking,
    TicketshopSegment,
    TicketUrls,
    Suggestion,
    SuggestionProperties,
    SuggestionGeometry,
    ActivityObject,
    ConnectionSearchResponse,
    AutocompleteResponse,
    ShareDataResponse,
    CreateShareResponse,
    ApiErrorResponse
} from './api';

// API type guards
export {
    isJourneyElement,
    isWalkElement,
    isTransferElement
} from './api';

// Translation types
export type { 
    Translations,
    LanguageTranslations,
    TranslationFunction,
    MenuTranslations,
    InfoTranslations,
    ErrorTranslations,
    ApiErrorTranslations,
    DebugTranslations,
    AriaLabelTranslations,
    WaitingTranslations,
    VehicleTranslations,
    AlertTranslations
} from './translations';
