// backend/middleware/botLogger.js
const logHistory = [];
const MAX_LOGS = 100;

const botLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        };

        logHistory.push(logEntry);

        if (logHistory.length > MAX_LOGS) {
            logHistory.shift();
        }
    });

    next();
};

const getLogs = () => {
    return logHistory;
};

module.exports = { botLogger, getLogs };
