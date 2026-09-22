import { resolveSortField } from './pagination-query.dto.js';

describe('resolveSortField', () => {
  it('uses the requested field when it is in the whitelist', () => {
    expect(resolveSortField('name', ['name', 'createdAt'], 'createdAt')).toBe('name');
  });

  it('falls back to the default field when the requested field is not whitelisted', () => {
    expect(resolveSortField('passwordHash', ['name', 'createdAt'], 'createdAt')).toBe('createdAt');
  });

  it('falls back to the default field when nothing is requested', () => {
    expect(resolveSortField(undefined, ['name', 'createdAt'], 'createdAt')).toBe('createdAt');
  });
});
