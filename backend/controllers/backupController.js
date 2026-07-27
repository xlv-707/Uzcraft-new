const backupService = require("../services/backupService");
const notificationService = require("../services/notificationService");

exports.createBackup = async (req, res) => {
    try {
        const { fileName, backup } = await backupService.createBackup();
        await notificationService.createNotification({
            type: "success",
            title: "Backup created",
            message: fileName,
            source: "backup"
        });
        res.json({ success: true, fileName, backup });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.listBackups = (req, res) => {
    try {
        res.json(backupService.listBackups());
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.downloadBackup = (req, res) => {
    const file = backupService.getBackupFilePath(req.params.fileName);
    if (!file) return res.status(404).json({ success: false, message: "Backup not found" });
    res.download(file);
};

exports.restoreBackup = async (req, res) => {
    try {
        await backupService.restoreBackup({
            fileName: req.body.fileName,
            backup: req.body.backup
        });
        await notificationService.createNotification({
            type: "success",
            title: "Backup restored",
            message: req.body.fileName || "Uploaded backup",
            source: "backup"
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.clearStoreData = async (req, res) => {
    try {
        await backupService.clearStoreData();
        await notificationService.createNotification({
            type: "error",
            title: "All store data cleared",
            message: "Products, orders, customers and chat messages were cleared",
            source: "danger"
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.enableMaintenanceMode = async (req, res) => {
    try {
        const settings = await backupService.enableMaintenanceMode();
        await notificationService.createNotification({
            type: "error",
            title: "Store disabled",
            message: "Maintenance mode has been enabled",
            source: "danger"
        });
        res.json({ success: true, settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
