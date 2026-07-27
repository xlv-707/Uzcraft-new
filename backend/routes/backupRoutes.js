const express = require("express");
const router = express.Router();

const {
    createBackup,
    listBackups,
    downloadBackup,
    restoreBackup,
    clearStoreData,
    enableMaintenanceMode
} = require("../controllers/backupController");

router.post("/backups", createBackup);
router.get("/backups", listBackups);
router.get("/backups/:fileName", downloadBackup);
router.post("/restore", restoreBackup);
router.post("/danger/clear-data", clearStoreData);
router.post("/danger/delete-store", enableMaintenanceMode);

module.exports = router;
