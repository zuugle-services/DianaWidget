/**
 * Event management logic for DianaWidget
 * 
 * Handles DOM event binding and cleanup for the widget.
 */

/**
 * Event handler function type
 */
export type EventHandler = (event: Event) => void;

/**
 * Event binding configuration
 */
export interface EventBinding {
    /** Target element or elements */
    target: EventTarget | EventTarget[] | null;
    /** Event type (e.g., 'click', 'input') */
    type: string;
    /** Event handler function */
    handler: EventHandler;
    /** Optional event listener options */
    options?: AddEventListenerOptions;
}

/**
 * Registered event entry for tracking
 */
interface RegisteredEvent {
    target: EventTarget;
    type: string;
    handler: EventHandler;
    options?: AddEventListenerOptions;
}

/**
 * Event manager class for handling DOM event bindings
 */
export class EventManager {
    private registeredEvents: RegisteredEvent[];
    private documentEvents: RegisteredEvent[];

    /**
     * Creates an instance of EventManager
     */
    constructor() {
        this.registeredEvents = [];
        this.documentEvents = [];
    }

    /**
     * Adds an event listener and tracks it for cleanup
     * @param target - Target element(s) for the event
     * @param type - Event type
     * @param handler - Event handler function
     * @param options - Optional event listener options
     */
    on(
        target: EventTarget | EventTarget[] | null,
        type: string,
        handler: EventHandler,
        options?: AddEventListenerOptions
    ): void {
        if (!target) return;

        const targets = Array.isArray(target) ? target : [target];

        targets.forEach(t => {
            if (!t) return;
            t.addEventListener(type, handler, options);
            this.registeredEvents.push({ target: t, type, handler, options });
        });
    }

    /**
     * Adds a document-level event listener
     * @param type - Event type
     * @param handler - Event handler function
     * @param options - Optional event listener options
     */
    onDocument(
        type: string,
        handler: EventHandler,
        options?: AddEventListenerOptions
    ): void {
        document.addEventListener(type, handler, options);
        this.documentEvents.push({ target: document, type, handler, options });
    }

    /**
     * Removes a specific event listener
     * @param target - Target element
     * @param type - Event type
     * @param handler - Event handler function
     */
    off(target: EventTarget | null, type: string, handler: EventHandler): void {
        if (!target) return;

        target.removeEventListener(type, handler);
        this.registeredEvents = this.registeredEvents.filter(
            e => !(e.target === target && e.type === type && e.handler === handler)
        );
    }

    /**
     * Removes all event listeners from a specific target
     * @param target - Target element
     */
    offTarget(target: EventTarget | null): void {
        if (!target) return;

        const eventsToRemove = this.registeredEvents.filter(e => e.target === target);
        eventsToRemove.forEach(({ type, handler, options }) => {
            target.removeEventListener(type, handler, options);
        });

        this.registeredEvents = this.registeredEvents.filter(e => e.target !== target);
    }

    /**
     * Removes all registered event listeners (cleanup)
     */
    destroy(): void {
        // Remove all registered element events
        this.registeredEvents.forEach(({ target, type, handler, options }) => {
            target.removeEventListener(type, handler, options);
        });
        this.registeredEvents = [];

        // Remove all document events
        this.documentEvents.forEach(({ target, type, handler, options }) => {
            target.removeEventListener(type, handler, options);
        });
        this.documentEvents = [];
    }

    /**
     * Gets the count of registered events
     */
    get eventCount(): number {
        return this.registeredEvents.length + this.documentEvents.length;
    }

    // ==================== Convenience Methods ====================

    /**
     * Adds a click event listener
     * @param target - Target element(s)
     * @param handler - Click handler
     */
    onClick(target: EventTarget | EventTarget[] | null, handler: EventHandler): void {
        this.on(target, 'click', handler);
    }

    /**
     * Adds an input event listener
     * @param target - Target element(s)
     * @param handler - Input handler
     */
    onInput(target: EventTarget | EventTarget[] | null, handler: EventHandler): void {
        this.on(target, 'input', handler);
    }

    /**
     * Adds a change event listener
     * @param target - Target element(s)
     * @param handler - Change handler
     */
    onChange(target: EventTarget | EventTarget[] | null, handler: EventHandler): void {
        this.on(target, 'change', handler);
    }

    /**
     * Adds a keydown event listener
     * @param target - Target element(s)
     * @param handler - Keydown handler
     */
    onKeydown(target: EventTarget | EventTarget[] | null, handler: EventHandler): void {
        this.on(target, 'keydown', handler);
    }

    /**
     * Adds multiple event bindings at once
     * @param bindings - Array of event binding configurations
     */
    addBindings(bindings: EventBinding[]): void {
        bindings.forEach(({ target, type, handler, options }) => {
            this.on(target, type, handler, options);
        });
    }

    // ==================== Touch/Mouse Event Helpers ====================

    /**
     * Adds mouse drag event listeners (mousedown, mousemove, mouseup, mouseleave)
     * @param target - Target element
     * @param handlers - Object containing handlers for start, move, and end events
     */
    onDrag(
        target: EventTarget | null,
        handlers: {
            onStart: (pageX: number) => void;
            onMove: (pageX: number) => void;
            onEnd: () => void;
        }
    ): void {
        if (!target) return;

        this.on(target, 'mousedown', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            handlers.onStart(mouseEvent.pageX);
        });
        this.on(target, 'mousemove', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            mouseEvent.preventDefault();
            handlers.onMove(mouseEvent.pageX);
        });
        this.on(target, 'mouseup', handlers.onEnd);
        this.on(target, 'mouseleave', handlers.onEnd);
    }

    /**
     * Adds touch event listeners (touchstart, touchmove, touchend, touchcancel)
     * @param target - Target element
     * @param handlers - Object containing handlers for start, move, and end events
     * @param passive - Whether to use passive event listeners
     */
    onTouch(
        target: EventTarget | null,
        handlers: {
            onStart: (pageX: number) => void;
            onMove: (pageX: number) => void;
            onEnd: () => void;
        },
        passive: boolean = true
    ): void {
        if (!target) return;

        this.on(target, 'touchstart', (e: Event) => {
            const touchEvent = e as TouchEvent;
            handlers.onStart(touchEvent.touches[0].pageX);
        }, { passive });

        this.on(target, 'touchmove', (e: Event) => {
            const touchEvent = e as TouchEvent;
            handlers.onMove(touchEvent.touches[0].pageX);
        }, { passive: false });

        this.on(target, 'touchend', handlers.onEnd);
        this.on(target, 'touchcancel', handlers.onEnd);
    }

    /**
     * Adds both mouse and touch drag events
     * @param target - Target element
     * @param handlers - Object containing handlers for start, move, and end events
     */
    onSwipe(
        target: EventTarget | null,
        handlers: {
            onStart: (pageX: number) => void;
            onMove: (pageX: number) => void;
            onEnd: () => void;
        }
    ): void {
        this.onDrag(target, handlers);
        this.onTouch(target, handlers);
    }
}
