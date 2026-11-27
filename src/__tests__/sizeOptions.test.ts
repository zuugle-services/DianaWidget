/**
 * maxWidth / maxHeight options: normalization to a CSS value and rejection of anything that
 * could inject other CSS.
 */
import { normalizeCssSize, validateConfig } from '../core/Validator';
import { DEFAULT_CONFIG } from '../constants/defaults';
import type { WidgetConfig } from '../types/config';

function config(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
    return {
        ...DEFAULT_CONFIG,
        activityName: 'Test',
        activityStartLocation: '47.7,13.0',
        activityStartLocationType: 'coordinates',
        activityEndLocation: '47.7,13.0',
        activityEndLocationType: 'coordinates',
        activityEarliestStartTime: '08:00',
        activityLatestStartTime: '14:00',
        activityEarliestEndTime: '10:00',
        activityLatestEndTime: '20:00',
        activityDurationMinutes: 180,
        timezone: 'Europe/Vienna',
        apiToken: 'x',
        ...overrides,
    } as WidgetConfig;
}

describe('normalizeCssSize', () => {
    it.each([
        [640, '640px'],
        [0, '0px'],
        ['640', '640px'],
        ['100%', '100%'],
        [' 640px ', '640px'],
        ['none', 'none'],
        ['40rem', '40rem'],
        ['90vw', '90vw'],
        ['calc(100% - 20px)', 'calc(100% - 20px)'],
        ['min(100%, 900px)', 'min(100%, 900px)'],
    ])('accepts %p as %p', (input, expected) => {
        expect(normalizeCssSize(input, 'max-width')).toBe(expected);
    });

    it.each([
        ['100%;color:red'],
        ['none}body{display:none'],
        ['100%!important'],
        ['url(x)'],
        ['red'],
        ['wide'],
        ['10 px'],
        [''],
        [-5],
        [NaN],
        [Infinity],
        [true],
        [{}],
    ])('rejects %p', (input) => {
        expect(normalizeCssSize(input, 'max-width')).toBeNull();
    });

    it('defers to CSS.supports when the browser has it', () => {
        const globalWithCss = globalThis as unknown as {CSS?: {supports: (p: string, v: string) => boolean}};
        const previous = globalWithCss.CSS;
        globalWithCss.CSS = {supports: () => false};
        try {
            expect(normalizeCssSize('calc(100% - )', 'max-width')).toBeNull();
            expect(normalizeCssSize(640, 'max-width')).toBe('640px');
        } finally {
            globalWithCss.CSS = previous;
        }
    });
});

describe('validateConfig size options', () => {
    it('defaults to null (CSS defaults of 470px / 790px apply)', () => {
        const {errors, config: result} = validateConfig(config());
        expect(errors).toEqual([]);
        expect(result.maxWidth).toBeNull();
        expect(result.maxHeight).toBeNull();
    });

    it('normalizes valid values', () => {
        const {config: result} = validateConfig(config({maxWidth: '100%', maxHeight: 600}));
        expect(result.maxWidth).toBe('100%');
        expect(result.maxHeight).toBe('600px');
    });

    it('warns and falls back to the default for invalid values without failing the widget', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const {errors, config: result} = validateConfig(config({maxWidth: '100%;}', maxHeight: 'tall'}));
            expect(errors).toEqual([]);
            expect(result.maxWidth).toBeNull();
            expect(result.maxHeight).toBeNull();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('maxWidth'));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('maxHeight'));
        } finally {
            warn.mockRestore();
        }
    });
});
