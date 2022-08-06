import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, prettyPrint, metadata } = format;
/* eslint @typescript-eslint/no-var-requires: 0 */
const DailyRotateFile = require('winston-daily-rotate-file');

const transport = new DailyRotateFile({
    filename: './logs/log-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '100m',
    maxFiles: '14d'
});

const timezoned = () => {
    return new Date().toLocaleString('pl-PL', {
        timeZone: 'Europe/Amsterdam'
    });
};

const logger = createLogger({
    level: 'silly',
    format:  combine(
        timestamp({ format: timezoned }),
        prettyPrint(),
        metadata()
    ),
    // defaultMeta: { service: 'user-service' },
    transports: [
        transport
    ],
});
  
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.timestamp({ format: timezoned }),
            format.align(),
            format.printf((info) => {
                const {
                    timestamp, level, message, ...args
                } = info;

                let args_ = args;

                delete args_.metadata.timestamp;
                if (Object.keys(args_.metadata).length === 0) {
                    delete args_.metadata;
                } else {
                    args_ = args_.metadata;
                }

                return `${timestamp} [${level}]: ${message} ${Object.keys(args_).length ? JSON.stringify(args_, null, 2) : ''}`;
            }),
        )
    }));
}

export {logger};