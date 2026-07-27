const ActivityLog = require("../models/ActivityLog");

// ============================================================
// ACTIVITY TYPE -> O'ZBEKCHA TAVSIF
// ============================================================

const TYPE_LABELS = {
    registered: "Ro'yxatdan o'tdi",
    login: "Tizimga kirdi",
    logout: "Tizimdan chiqdi",
    updated_profile: "Profilni yangiladi",
    added_to_cart: "Savatchaga mahsulot qo'shdi",
    removed_from_cart: "Savatchadan mahsulot o'chirdi",
    added_to_wishlist: "Sevimlilarga qo'shdi",
    removed_from_wishlist: "Sevimlilardan o'chirdi",
    placed_order: "Buyurtma berdi",
    payment_completed: "To'lovni amalga oshirdi",
    order_status_changed: "Buyurtma holati o'zgardi",
    order_delivered: "Buyurtma yetkazib berildi",
    order_cancelled: "Buyurtmani bekor qildi",
    opened_chat: "Chatni ochdi",
    sent_message: "Xabar yubordi",
    changed_address: "Manzilni o'zgartirdi",
    changed_password: "Parolni o'zgartirdi",
    other: "Amal bajardi"
};

// ============================================================
// LOG ACTIVITY
// Xatolik chatni yoki asosiy oqimni to'xtatmasligi uchun
// har doim try/catch bilan o'raladi va xatoni faqat log qiladi.
// ============================================================

exports.logActivity = async (userId, type, options = {}) => {

    try {

        if (!userId) return null;

        const description = options.description || TYPE_LABELS[type] || TYPE_LABELS.other;

        return await ActivityLog.create({
            user: userId,
            type: TYPE_LABELS[type] ? type : "other",
            description,
            meta: options.meta || {}
        });

    } catch (error) {

        console.error("Activity log xatosi:", error.message);
        return null;

    }

};

exports.TYPE_LABELS = TYPE_LABELS;
