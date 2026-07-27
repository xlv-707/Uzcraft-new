const express = require("express");
const router = express.Router();

const {
    getSettings,
    updateSettings,
    testStripe,
    testEmail
} = require("../controllers/settingsController");

router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.post("/settings/stripe/test", testStripe);
router.post("/settings/email/test", testEmail);

module.exports = router;
