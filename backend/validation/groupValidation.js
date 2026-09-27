const { z } = require('zod');

const createGroupSchema = z.object({
    // Members join by invite link (or are added by email), never by passing raw user IDs
    name: z.string().trim().min(1, 'Group name cannot be empty').max(100)
});

const addMemberSchema = z.object({
    email: z.string().trim().email('Invalid email address')
});

module.exports = {
    createGroupSchema,
    addMemberSchema
};
