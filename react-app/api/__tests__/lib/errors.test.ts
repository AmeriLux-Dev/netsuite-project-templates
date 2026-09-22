import { describe, expect, it } from 'vitest';
import { describeErrorMessage } from '../../src/lib/errors';

// A lib function takes values and returns one, so it is called with plain inputs and nothing is mocked.
describe('describeErrorMessage', () => {
    it('answers the message of an Error', () => {
        expect(describeErrorMessage(new TypeError('field is read-only'))).toBe('field is read-only');
    });

    it('answers the message of an object that carries one, as a NetSuite error does', () => {
        expect(describeErrorMessage({ name: 'RCRD_DSNT_EXIST', message: 'That record does not exist.' })).toBe('That record does not exist.');
    });

    it('answers the text of anything else that was thrown', () => {
        expect(describeErrorMessage('timed out')).toBe('timed out');
        expect(describeErrorMessage(404)).toBe('404');
        expect(describeErrorMessage(undefined)).toBe('undefined');
    });
});
