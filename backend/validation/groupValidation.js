const { z } = require('zod');

const createGroupSchema = z.object({
    name: z.string().trim().min(1, 'Group name cannot be empty').max(100).default('Personal Group'),
    is_personal: z.boolean().optional().default(false),
    members: z.array(z.string()).optional().default([])
});

const addMemberSchema = z.object({
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    userId: z.string().optional()
}).refine(data => data.email || data.userId, {
    message: 'Either email or userId must be provided',
    path: ['email']
});

const voteSchema = z.object({
    pollId: z.string().min(1, 'Poll ID is required'),
    candidateId: z.string().min(1, 'Candidate ID is required')
});

module.exports = {
    createGroupSchema,
    addMemberSchema,
    voteSchema
};
