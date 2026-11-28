import {expect} from '@loopback/testlab';
import {assertSafeFilter} from '../../interceptors/filter-sanitizer.interceptor';

describe('assertSafeFilter (SQL injection hardening)', () => {
  it('accepts valid order/limit/skip values', () => {
    expect(() =>
      assertSafeFilter({
        order: ['fecemision DESC', 'numdoc ASC', 'cuota'],
        limit: 10,
        skip: '5',
        offset: 0,
      }),
    ).not.to.throw();
    expect(() => assertSafeFilter({order: 'cuota asc'})).not.to.throw();
    expect(() => assertSafeFilter({where: {a: 1}})).not.to.throw();
  });

  const maliciousOrders = [
    'cuota ASC; DROP TABLE x',
    'cuota ASC, (SELECT 1 FROM SYSIBM.SYSDUMMY1)',
    'cuota DESC -- comment',
    '1) UNION SELECT 1',
    'cuota ASC||CHR(65)',
    '"cuota"',
    'cuota ASC NULLS LAST',
    '',
  ];
  for (const order of maliciousOrders) {
    it(`rejects order ${JSON.stringify(order)}`, () => {
      expect(() => assertSafeFilter({order: [order]})).to.throw(
        /Invalid filter: order/,
      );
    });
  }

  it('rejects non-string order entries', () => {
    expect(() => assertSafeFilter({order: [{a: 1}]})).to.throw();
    expect(() => assertSafeFilter({order: [1]})).to.throw();
  });

  const badNumbers: unknown[] = [-1, 1.5, '1; DROP', 'abc', {}, [1], true];
  for (const value of badNumbers) {
    it(`rejects limit ${JSON.stringify(value)}`, () => {
      expect(() => assertSafeFilter({limit: value})).to.throw(
        /Invalid filter: limit/,
      );
    });
  }

  it('rejects an invalid skip or offset', () => {
    expect(() => assertSafeFilter({skip: '1 OR 1=1'})).to.throw(/skip/);
    expect(() => assertSafeFilter({offset: -3})).to.throw(/offset/);
  });
});
