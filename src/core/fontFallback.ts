import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';

const STYLE_ID = 'diana-widget-fallback-font';

/**
 * Font stack for pages that set no font of their own: Inter (Zuugle's corporate font), shipped
 * in the bundle so no third-party font service is contacted. A distinct family name keeps it
 * from mixing with an "Inter" the host page may declare. Inter has no Thai; Thai text falls
 * through to the system font.
 */
export const FALLBACK_FONT_STACK = '"Diana Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Registers the fallback face on the host document, once. @font-face rules inside a shadow
 * root are ignored by browsers; a face declared on the document is visible to every shadow root.
 */
export function registerFallbackFont(): void {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // Latin subset and unicode-range as published by @fontsource-variable/inter.
    style.textContent = `@font-face{font-family:'Diana Inter';font-style:normal;font-display:swap;font-weight:100 900;`
        + `src:url(${interLatin}) format('woff2');`
        + `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`;
    document.head.appendChild(style);
}
