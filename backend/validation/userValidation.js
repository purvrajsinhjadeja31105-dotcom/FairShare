const { z } = require('zod');

const updateProfileSchema = z.object({
    upi_id: z.string()
        .trim()
        .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID format (should be username@bank)')
        .or(z.literal('')) // Allow clearing UPI ID
        .optional()
});

module.exports = {
    updateProfileSchema
};
