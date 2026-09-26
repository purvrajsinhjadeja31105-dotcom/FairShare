const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || err.status || 500;
    let errorType = err.name || 'InternalServerError';
    let message = err.message || 'An unexpected error occurred on the server.';

    // Check specific Firebase / database errors
    if (err.code === 'permission-denied' || err.code === 7) {
        statusCode = 403;
        errorType = 'ForbiddenError';
        message = 'You do not have permission to perform this action.';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorType = 'UnauthorizedError';
        message = 'Invalid authentication token. Please login again.';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorType = 'UnauthorizedError';
        message = 'Authentication token expired. Please login again.';
    } else if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        errorType = 'BadRequestError';
        message = 'Request body is not valid JSON.';
    } else if (err.message === 'Not allowed by CORS') {
        statusCode = 403;
        errorType = 'CorsError';
    }

    if (statusCode >= 500) {
        console.error('[Global Error Handler] Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code
        });
        // Don't leak internal error details (database messages, stack traces) to clients in production
        if (process.env.NODE_ENV === 'production') {
            message = 'An unexpected error occurred on the server. Please try again.';
        }
    }

    // `error` carries the human-readable message, matching every route's { error } responses
    res.status(statusCode).json({
        error: message,
        type: errorType,
        ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack })
    });
};

module.exports = errorHandler;
