import { getLocationTypeIconHTML } from '../templates/partials/_locationIcons';

describe('getLocationTypeIconHTML', () => {
    it('returns a distinct icon for stations and addresses', () => {
        expect(getLocationTypeIconHTML('station')).not.toEqual(getLocationTypeIconHTML('address'));
    });

    it('falls back to the address pin for unknown, empty and missing types', () => {
        const pin = getLocationTypeIconHTML('address');
        expect(getLocationTypeIconHTML('poi')).toEqual(pin);
        expect(getLocationTypeIconHTML('')).toEqual(pin);
        expect(getLocationTypeIconHTML(undefined)).toEqual(pin);
        expect(getLocationTypeIconHTML(null)).toEqual(pin);
    });

    it('renders inline SVG that inherits the surrounding text colour', () => {
        for (const type of ['station', 'address']) {
            const icon = getLocationTypeIconHTML(type);
            expect(icon).toMatch(/^<svg /);
            expect(icon).toContain('stroke="currentColor"');
            expect(icon).toContain('width="16"');
            expect(icon).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        }
    });
});
