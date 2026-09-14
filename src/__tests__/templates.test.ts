/**
 * Unit tests for the page templates, focused on how they render an activity
 * that the host page configured without a title.
 */
import { getFormPageTemplateHTML } from '../templates/formPageTemplate';
import { getResultsPageTemplateHTML } from '../templates/resultsPageTemplate';
import { getWidgetHeaderHTML } from '../templates/partials/_widgetHeader';
import { DEFAULT_CONFIG } from '../constants/defaults';
import translations from '../translations';
import type { WidgetConfig } from '../types/config';

/** Mirrors the widget's own lookup closely enough for template rendering. */
function t(key: string): string {
    return key.split('.').reduce<unknown>(
        (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
        translations.EN,
    ) as string ?? key;
}

function config(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
    return {
        ...DEFAULT_CONFIG,
        activityName: 'Marktschellenberger Eishöhle',
        activityStartLocation: 'Untersbergbahn',
        activityStartLocationType: 'address',
        activityStartLocationDisplayName: 'Untersbergbahn Talstation',
        activityEndLocation: 'Eishöhle',
        activityEndLocationType: 'address',
        activityEndLocationDisplayName: 'Eishöhle, Marktschellenberg',
        activityDurationMinutes: 180,
        timezone: 'Europe/Vienna',
        language: 'EN',
        ...overrides,
    } as WidgetConfig;
}

const formArgs = (cfg: WidgetConfig) => ({
    config: cfg,
    t,
    state: {useFlex: false},
    formatDateForDisplay: () => '24. Aug 2026',
    formatDatetime: () => '2026-08-24',
});

/** The text inside the header's heading div, whitespace collapsed. */
function headingText(html: string): string {
    const match = /class="widget-header-heading">([\s\S]*?)<\/div>/.exec(html);
    return (match?.[1] ?? '').trim();
}

/** The value="" of the read-only destination input. */
function destinationValue(html: string): string {
    const match = /id="destinationInput"[^>]*value="([^"]*)"/.exec(html);
    return match?.[1] ?? '';
}

describe('getWidgetHeaderHTML', () => {
    it('renders the heading empty rather than printing "undefined"', () => {
        const html = getWidgetHeaderHTML({t});
        expect(headingText(html)).toBe('');
        expect(html).not.toContain('undefined');
    });

    it('keeps the header bar and its buttons around an empty heading', () => {
        const html = getWidgetHeaderHTML({t, title: '', showBackButton: true, backButtonId: 'backBtn'});
        expect(html).toContain('class="widget-header"');
        expect(html).toContain('id="backBtn"');
        expect(html).toContain('class="menu-btn-dots"');
    });
});

describe('getFormPageTemplateHTML', () => {
    it('puts the activity name in the header and the destination field', () => {
        const html = getFormPageTemplateHTML(formArgs(config()));
        expect(headingText(html)).toBe('Marktschellenberger Eishöhle');
        expect(destinationValue(html)).toBe('Marktschellenberger Eishöhle');
    });

    it('prefers an explicit destinationInputName over the activity name', () => {
        const html = getFormPageTemplateHTML(formArgs(config({destinationInputName: 'Eishöhle Talstation'})));
        expect(destinationValue(html)).toBe('Eishöhle Talstation');
    });

    it.each([
        ['an empty name', ''],
        ['a whitespace-only name', '   '],
        ['a null name', null],
        ['no name at all', undefined],
    ])('leaves the heading empty and falls back to the activity location with %s', (_label, activityName) => {
        const html = getFormPageTemplateHTML(formArgs(config({activityName} as Partial<WidgetConfig>)));
        expect(headingText(html)).toBe('');
        expect(destinationValue(html)).toBe('Untersbergbahn Talstation');
        expect(html).not.toContain('[Activity Name]');
        expect(html).not.toContain('undefined');
    });

    it('falls back to the raw start location when there is no display name either', () => {
        const html = getFormPageTemplateHTML(formArgs(config({
            activityName: '',
            activityStartLocationDisplayName: null,
        })));
        expect(destinationValue(html)).toBe('Untersbergbahn');
    });
});

describe('getResultsPageTemplateHTML', () => {
    it('puts the activity name in the header', () => {
        const html = getResultsPageTemplateHTML({config: config(), t});
        expect(headingText(html)).toBe('Marktschellenberger Eishöhle');
    });

    it('renders an empty heading and an empty activity box without a name', () => {
        const html = getResultsPageTemplateHTML({config: config({activityName: ''}), t});
        expect(headingText(html)).toBe('');
        expect(html).toContain('<div id="activity-time" class="middle-box"></div>');
        expect(html).not.toContain('[Activity Name]');
    });

    it('never seeds the activity box with the name, even when one is configured', () => {
        // The box is filled by updateActivityTimeBox() as soon as results arrive.
        const html = getResultsPageTemplateHTML({config: config(), t});
        expect(html).toContain('<div id="activity-time" class="middle-box"></div>');
    });
});
