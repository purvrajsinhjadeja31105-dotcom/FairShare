const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { updateProfileSchema } = require('../validation/userValidation');

router.use(authMid);

router.put('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { upi_id } = req.body;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const cleanUpi = upi_id ? upi_id.trim() : null;

        await userRef.update({
            upi_id: cleanUpi
        });

        res.json({ message: 'Profile updated successfully', upi_id: cleanUpi });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
