import { describe, expect, it } from 'vitest';
import { parseProviderIds } from './config';

describe('parseProviderIds', () => {
  it.each([undefined, '', '   '])('is undefined when the variable is %j', (value) => {
    expect(parseProviderIds(value)).toBeUndefined();
  });

  it('splits a comma-separated list and trims the entries', () => {
    expect(parseProviderIds(' global-data , direct-dependencies,')).toEqual([
      'global-data',
      'direct-dependencies',
    ]);
  });
});
