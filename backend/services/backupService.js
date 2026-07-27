const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Chat = require("../models/Chat");
const Notification = require("../models/Notification");
const settingsService = require("./settingsService");

const BACKUP_DIR = path.join(__dirname, "..", "backups");

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * A "backup" is a point-in-time export of the MongoDB collections written
 * to a timestamped .json file on disk, purely as a downloadable snapshot —
 * NOT a replacement data store. The live app always reads/writes MongoDB;
 * this file only exists so an admin can download/restore a snapshot.
 */
async function createBackup() {
    ensureBackupDir();

    const [users, products, orders, chat, notifications, settings] = await Promise.all([
        User.find().select("-password").lean(),
        Product.find().lean(),
        Order.find().lean(),
        Chat.find().lean(),
        Notification.find().lean(),
        settingsService.getSettings()
    ]);

    const backup = {
        createdAt: new Date().toISOString(),
        settings: settings.toObject ? settings.toObject() : settings,
        users,
        products,
        orders,
        chat,
        notifications
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup-${stamp}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, fileName), JSON.stringify(backup, null, 2), "utf8");

    return { fileName, backup };
}

function listBackups() {
    ensureBackupDir();
    return fs
        .readdirSync(BACKUP_DIR)
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
            const stat = fs.statSync(path.join(BACKUP_DIR, file));
            return { fileName: file, size: stat.size, createdAt: stat.birthtime };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBackupFilePath(fileName) {
    const safeName = path.basename(fileName);
    const file = path.join(BACKUP_DIR, safeName);
    return fs.existsSync(file) ? file : null;
}

/**
 * Restores a backup snapshot (from disk by fileName, or an uploaded object)
 * back into MongoDB. Upserts by _id where available so this is safe to
 * re-run.
 */
async function restoreBackup({ fileName, backup } = {}) {
    let data = backup;
    if (!data && fileName) {
        const file = getBackupFilePath(fileName);
        if (file) data = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    if (!data) throw new Error("Backup data is required");

    const upsertMany = async (Model, docs) => {
        if (!Array.isArray(docs) || !docs.length) return;
        const ops = docs
            .filter((doc) => doc && doc._id)
            .map((doc) => ({
                replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
            }));
        if (ops.length) await Model.bulkWrite(ops, { ordered: false });
    };

    await Promise.all([
        data.settings ? settingsService.saveSettings(data.settings) : null,
        upsertMany(User, data.users),
        upsertMany(Product, data.products),
        upsertMany(Order, data.orders),
        upsertMany(Chat, data.chat),
        upsertMany(Notification, data.notifications)
    ]);

    return true;
}

/** Deletes all store data except admin accounts. */
async function clearStoreData() {
    await Promise.all([
        User.deleteMany({ role: { $ne: "admin" } }),
        Product.deleteMany({}),
        Order.deleteMany({}),
        Chat.deleteMany({}),
        Notification.deleteMany({})
    ]);
}

/** Puts the store into maintenance mode instead of actually deleting it. */
async function enableMaintenanceMode() {
    const settings = await settingsService.getSettings();
    settings.advanced.maintenanceMode = true;
    await settings.save();
    return settings;
}

module.exports = {
    createBackup,
    listBackups,
    getBackupFilePath,
    restoreBackup,
    clearStoreData,
    enableMaintenanceMode
};
