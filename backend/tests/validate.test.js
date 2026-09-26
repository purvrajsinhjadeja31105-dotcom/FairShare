const { z } = require('zod');
const { validateBody, validateQuery } = require('../middleware/validate');

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('validate middleware', () => {
    const schema = z.object({ name: z.string().min(1, 'Name is required') });

    test('returns a 400 with field details on invalid input', () => {
        const res = mockRes();
        const next = jest.fn();
        validateBody(schema)({ body: {} }, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0]).toMatchObject({
            error: 'Validation Error',
            details: [{ field: 'name' }]
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('replaces the body with parsed data and calls next', () => {
        const req = { body: { name: 'Asha', extra: true } };
        const next = jest.fn();
        validateBody(schema)(req, mockRes(), next);

        expect(req.body).toEqual({ name: 'Asha' });
        expect(next).toHaveBeenCalledWith();
    });

    test('works when the source is a read-only getter (Express 5 req.query)', () => {
        const req = Object.create({ get query() { return { name: 'Asha' }; } });
        const next = jest.fn();
        validateQuery(schema)(req, mockRes(), next);

        expect(req.query).toEqual({ name: 'Asha' });
        expect(next).toHaveBeenCalledWith();
    });
});
