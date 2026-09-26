const { toPaise, fromPaise, roundMoney, splitEvenly } = require('../utils/money');

describe('toPaise', () => {
    test('converts rupees to integer paise', () => {
        expect(toPaise(12.34)).toBe(1234);
        expect(toPaise('99.99')).toBe(9999);
        expect(toPaise(0)).toBe(0);
    });

    test('avoids floating point artifacts', () => {
        // 0.1 + 0.2 === 0.30000000000000004 in floating point
        expect(toPaise(0.1 + 0.2)).toBe(30);
        expect(toPaise(19.99 * 3)).toBe(5997);
    });

    test('returns NaN for unparseable input', () => {
        expect(toPaise('abc')).toBeNaN();
        expect(toPaise(undefined)).toBeNaN();
    });
});

describe('roundMoney', () => {
    test('rounds to 2 decimals', () => {
        expect(roundMoney(33.333333)).toBe(33.33);
        expect(roundMoney('10.456')).toBe(10.46);
        expect(fromPaise(toPaise(5))).toBe(5);
    });
});

describe('splitEvenly', () => {
    test('shares always add up to the total', () => {
        for (const total of [1, 100, 10000, 9999, 12345]) {
            for (const count of [1, 2, 3, 6, 7]) {
                const shares = splitEvenly(total, count);
                expect(shares).toHaveLength(count);
                expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
            }
        }
    });

    test('distributes leftover paise to the first shares', () => {
        expect(splitEvenly(10000, 3)).toEqual([3334, 3333, 3333]);
        expect(splitEvenly(2, 3)).toEqual([1, 1, 0]);
    });

    test('shares never differ by more than one paisa', () => {
        const shares = splitEvenly(10001, 7);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    });

    test('rejects invalid input', () => {
        expect(() => splitEvenly(100, 0)).toThrow();
        expect(() => splitEvenly(10.5, 2)).toThrow();
        expect(() => splitEvenly(-1, 2)).toThrow();
    });
});
