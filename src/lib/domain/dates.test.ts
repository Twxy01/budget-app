import { describe, expect, it } from 'vitest';
import { addMonths, dayLabel, lastDayOf, monthLabel, monthRange, todayKey } from './dates';

describe('dates', () => {
  it('ajoute des mois en passant les années', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
  });

  it('liste les mois, bornes incluses', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-11', '2026-10')).toEqual([]);
  });

  it('libellé en français', () => {
    expect(monthLabel('2026-09')).toBe('Septembre 2026');
  });

  it('dernier jour du mois', () => {
    expect(lastDayOf('2026-09')).toBe('2026-09-30');
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
  });

  it('libellé du jour relatif', () => {
    expect(dayLabel('2026-09-21', '2026-09-21')).toBe("Aujourd'hui");
    expect(dayLabel('2026-09-30', '2026-10-01')).toBe('Hier');
  });

  it("date du jour en heure locale", () => {
    expect(todayKey(new Date(2026, 8, 21, 23, 30))).toBe('2026-09-21');
  });
});
