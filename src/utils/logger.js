import winston from 'winston';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

const ENABLE_FILE_LOGS = process.env.DOWNTUBE_FILE_LOGS === '1';
const ENABLE_VERBOSE = process.env.DOWNTUBE_VERBOSE === '1';
const LOG_DIR = path.resolve(process.cwd(), 'logs');

let FileLogger = null;

if (ENABLE_FILE_LOGS) {
    try {
        fs.ensureDirSync(LOG_DIR);
        FileLogger = winston.createLogger({
        level: 'debug',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
        ),
        transports: [
            new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
            new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') })
        ],
        exitOnError: false
        });
    } catch (err) {
        FileLogger = null;
        console.warn('⚠ Failed to initialize file logger, continuing without file logs:', err.message || err);
    }
}

const symbols = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✔'),
    warn: chalk.yellow('⚠'),
    error: chalk.red('✖'),
    debug: chalk.gray('•')
};

function safeFileLog(level, message, meta = {}) {
    if (!FileLogger) return;
    try {
        FileLogger.log({ level, message, ...meta });
    } catch (e) {
    }
}

const logger = {
    info(message, meta = {}) {
        console.log(`${symbols.info} ${chalk.cyan(String(message))}`);
        safeFileLog('info', String(message), meta);
    },

    success(message, meta = {}) {
        console.log(`${symbols.success} ${chalk.green(String(message))}`);
        safeFileLog('info', String(message), meta);
    },

    warn(message, meta = {}) {
        console.warn(`${symbols.warn} ${chalk.yellow(String(message))}`);
        safeFileLog('warn', String(message), meta);
    },

    error(message, meta = {}) {
        console.error(`${symbols.error} ${chalk.red(String(message))}`);
        safeFileLog('error', String(message), meta);
    },

    debug(message, meta = {}) {
        if (!ENABLE_VERBOSE) return;
        console.log(`${symbols.debug} ${chalk.gray(String(message))}`);
        safeFileLog('debug', String(message), meta);
    }
};

export default logger;
