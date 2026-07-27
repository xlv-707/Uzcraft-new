const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token topilmadi"
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch {

        res.status(401).json({
            success: false,
            message: "Token noto'g'ri"
        });

    }

};