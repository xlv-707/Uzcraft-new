const User = require("../models/User");
const LoginHistory = require("../models/LoginHistory");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const activityService = require("../services/activityService");
const { parseUserAgent, getClientIp } = require("../utils/uaParser");

const MAX_FAILED_ATTEMPTS = 5;

// =========================
// REGISTER
// =========================

exports.register = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            phone,
            address
        } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Barcha maydonlarni to'ldiring."
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Bu email allaqachon mavjud."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            fullName: username,
            email,
            password: hashedPassword,
            phone,
            address,
            role: "client",
            status: "online",
            lastSeen: new Date()
        });

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        await activityService.logActivity(user._id, "registered");

        res.status(201).json({
            success: true,
            token,
            user
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server xatosi."
        });

    }
};

// =========================
// LOGIN
// =========================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        const ip = getClientIp(req);
        const userAgentString = req.headers["user-agent"] || "";
        const { browser, os } = parseUserAgent(userAgentString);

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Email yoki parol noto'g'ri."
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {

            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            user.lastFailedLoginAt = new Date();
            await user.save();

            await LoginHistory.create({
                user: user._id,
                success: false,
                ip,
                browser,
                os,
                userAgent: userAgentString,
                reason: "Noto'g'ri parol"
            });

            return res.status(400).json({
                success: false,
                message: "Email yoki parol noto'g'ri."
            });
        }

        if (user.accountStatus === "blocked") {
            return res.status(403).json({
                success: false,
                message: "Hisobingiz bloklangan. Administratsiya bilan bog'laning."
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        user.failedLoginAttempts = 0;
        user.status = "online";
        user.lastSeen = new Date();
        await user.save();

        await LoginHistory.create({
            user: user._id,
            success: true,
            ip,
            browser,
            os,
            userAgent: userAgentString
        });

        await activityService.logActivity(user._id, "login", {
            meta: { ip, browser, os }
        });

        res.json({
            success: true,
            token,
            user
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server xatosi."
        });

    }

};

exports.MAX_FAILED_ATTEMPTS = MAX_FAILED_ATTEMPTS;
