const errorHandler = (err, req, res, next) => {
    console.error('[Global Error Handler] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code
    });

    let statusCode = err.statusCode || 500;
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
    }

    res.status(statusCode).json({
        error: errorType,
        message: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

module.exports = errorHandler;
