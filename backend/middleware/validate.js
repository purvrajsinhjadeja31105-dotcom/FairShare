const { ZodError } = require('zod');

// Zod 4 exposes validation problems as `issues` (the old `errors` alias was removed).
const formatZodError = (error) => ({
    error: 'Validation Error',
    details: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
    }))
});

const validate = (source) => (schema) => (req, res, next) => {
    try {
        // defineProperty because Express 5 exposes req.query as a read-only getter
        Object.defineProperty(req, source, {
            value: schema.parse(req[source]),
            writable: true,
            configurable: true,
            enumerable: true
        });
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json(formatZodError(error));
        }
        next(error);
    }
};

module.exports = {
    validateBody: validate('body'),
    validateQuery: validate('query'),
    validateParams: validate('params'),
    formatZodError
};
