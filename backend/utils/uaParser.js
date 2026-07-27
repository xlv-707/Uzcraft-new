// ============================================================
// LIGHTWEIGHT USER-AGENT PARSER
// Tashqi npm paketsiz, Browser va OS ni aniqlaydi
// ============================================================

function parseUserAgent(uaString) {

    const ua = uaString || "";

    let browser = "Noma'lum";

    if (/Edg\//.test(ua)) browser = "Microsoft Edge";
    else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
    else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";

    let os = "Noma'lum";

    if (/Windows NT 10\.0/.test(ua)) os = "Windows 10/11";
    else if (/Windows NT/.test(ua)) os = "Windows";
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Linux/.test(ua)) os = "Linux";

    return { browser, os };

}

function getClientIp(req) {

    const forwarded = req.headers["x-forwarded-for"];

    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    return req.socket?.remoteAddress || req.ip || "";

}

module.exports = { parseUserAgent, getClientIp };
