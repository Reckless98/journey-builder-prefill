import { describe, expect, it } from 'vitest';
import { clearMapping, formFieldSource, setMapping, sourceId } from './mappings';
import type { PrefillMappings } from './types';

const empty: PrefillMappings = new Map();
const emailOfA = formFieldSource('form-a', 'email');
const nameOfA = formFieldSource('form-a', 'name');

describe('sourceId', () => {
  it('is equal for equal sources', () => {
    expect(sourceId(formFieldSource('form-a', 'email'))).toBe(
      sourceId({ type: 'form_field', ownerId: 'form-a', key: 'email' }),
    );
  });

  it('differs when any part differs', () => {
    const ids = [
      sourceId({ type: 'form_field', ownerId: 'form-a', key: 'email' }),
      sourceId({ type: 'form_field', ownerId: 'form-b', key: 'email' }),
      sourceId({ type: 'form_field', ownerId: 'form-a', key: 'name' }),
      sourceId({ type: 'global', ownerId: 'form-a', key: 'email' }),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not collide when a separator character appears inside a part', () => {
    const left = sourceId({ type: 'x', ownerId: 'a:b', key: 'c' });
    const right = sourceId({ type: 'x', ownerId: 'a', key: 'b:c' });

    expect(left).not.toBe(right);
  });
});

describe('setMapping', () => {
  it('adds a mapping to a field', () => {
    const mappings = setMapping(empty, 'form-d', 'email', emailOfA);

    expect(mappings.get('form-d')?.get('email')).toEqual(emailOfA);
  });

  it('replaces an existing mapping', () => {
    const first = setMapping(empty, 'form-d', 'email', emailOfA);
    const second = setMapping(first, 'form-d', 'email', nameOfA);

    expect(second.get('form-d')?.get('email')).toEqual(nameOfA);
    expect(second.get('form-d')?.size).toBe(1);
  });

  it('keeps the other fields of the same form', () => {
    const first = setMapping(empty, 'form-d', 'email', emailOfA);
    const second = setMapping(first, 'form-d', 'name', nameOfA);

    expect(second.get('form-d')?.get('email')).toEqual(emailOfA);
    expect(second.get('form-d')?.get('name')).toEqual(nameOfA);
  });

  it('does not modify its input', () => {
    const before = setMapping(empty, 'form-d', 'email', emailOfA);
    setMapping(before, 'form-d', 'email', nameOfA);

    expect(before.get('form-d')?.get('email')).toEqual(emailOfA);
    expect(empty.size).toBe(0);
  });

  it('leaves other forms untouched, by identity', () => {
    const before = setMapping(empty, 'form-b', 'email', emailOfA);
    const after = setMapping(before, 'form-d', 'email', emailOfA);

    expect(after.get('form-b')).toBe(before.get('form-b'));
  });

  it('keeps apart fields that share a key on different forms', () => {
    const mappings = setMapping(empty, 'form-b', 'email', emailOfA);

    expect(mappings.get('form-d')?.get('email')).toBeUndefined();
  });

  it('handles field keys that are also object prototype members', () => {
    expect(empty.get('form-d')?.get('constructor')).toBeUndefined();

    const mappings = setMapping(empty, 'form-d', 'constructor', emailOfA);
    expect(mappings.get('form-d')?.get('constructor')).toEqual(emailOfA);
    expect(mappings.get('form-d')?.get('toString')).toBeUndefined();
  });
});

describe('clearMapping', () => {
  it('removes a mapping', () => {
    const before = setMapping(empty, 'form-d', 'email', emailOfA);
    const after = clearMapping(before, 'form-d', 'email');

    expect(after.get('form-d')?.get('email')).toBeUndefined();
  });

  it('keeps the other fields of the same form', () => {
    const before = setMapping(
      setMapping(empty, 'form-d', 'email', emailOfA),
      'form-d',
      'name',
      nameOfA,
    );
    const after = clearMapping(before, 'form-d', 'email');

    expect(after.get('form-d')?.get('name')).toEqual(nameOfA);
  });

  it('drops the form entry once its last mapping is cleared', () => {
    const before = setMapping(empty, 'form-d', 'email', emailOfA);

    expect(clearMapping(before, 'form-d', 'email').has('form-d')).toBe(false);
  });

  it('leaves other forms untouched, by identity', () => {
    const before = setMapping(
      setMapping(empty, 'form-b', 'email', emailOfA),
      'form-d',
      'email',
      emailOfA,
    );
    const after = clearMapping(before, 'form-d', 'email');

    expect(after.get('form-b')).toBe(before.get('form-b'));
  });

  it('returns the same object when there is nothing to clear', () => {
    const before = setMapping(empty, 'form-d', 'email', emailOfA);

    expect(clearMapping(before, 'form-d', 'name')).toBe(before);
    expect(clearMapping(before, 'form-x', 'email')).toBe(before);
  });

  it('does not modify its input', () => {
    const before = setMapping(empty, 'form-d', 'email', emailOfA);
    clearMapping(before, 'form-d', 'email');

    expect(before.get('form-d')?.get('email')).toEqual(emailOfA);
  });
});
