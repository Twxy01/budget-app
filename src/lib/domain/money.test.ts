import { describe, expect, it } from 'vitest';
import { formatCents, formatCHF, formatShort, parseAmount } from './money';

describe('formatCents', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [3250, '32.50'],
    [158345, "1'583.45"],
    [123456789, "1'234'567.89"],
    [-1200, '-12.00'],
  ])('%i → %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it('version courte sans centimes ronds', () => {
    expect(formatShort(6800)).toBe('68');
    expect(formatShort(-1200)).toBe('-12');
    expect(formatShort(6850)).toBe('68.50');
    expect(formatShort(158300)).toBe("1'583");
  });

  it('ajoute la devise', () => {
    expect(formatCHF(6800)).toBe('68.00 CHF');
  });
});

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12,50', 1250],
    ['0.05', 5],
    ["1'200", 120000],
    [' 470 ', 47000],
  ])('"%s" → %i', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '12.345', '1.2.3', '.5'])('refuse "%s"', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
