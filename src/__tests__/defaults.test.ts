/**
 * Unit tests for constants/defaults.ts
 */
import { DEFAULT_CONFIG, REQUIRED_CONFIG_FIELDS } from '../constants/defaults';

describe('DEFAULT_CONFIG', () => {
    it('ships no placeholder activity name', () => {
        // A default like '[Activity Name]' used to leak into the header, the destination
        // field and the activity card of any widget configured without a name.
        expect('activityName' in DEFAULT_CONFIG).toBe(false);
    });

    it('does not require an activity name', () => {
        expect(REQUIRED_CONFIG_FIELDS).not.toContain('activityName');
    });
});
