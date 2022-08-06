import SerialPort from 'serialport';
import { logger } from './logger';
const debug_logFrames = true;

type CanFrame = {
    type: string,
    id: number,
    dataLength: number,
    data: Array<number>
};

type DataCallback = (frame: CanFrame) => void;

function timeout(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function CanMsgToFrame(msg: string): CanFrame {
    const result = {} as CanFrame;

    // const msg: Array<string> = [];
    // console.log(data);
    
    // data.forEach((char: any) => {
    //     msg.push(String.fromCharCode(char));
            
    // });

    if (msg.length < 2)
        throw `message too short : ${msg.length}`;

    if(msg[0] == 'T') {
        result.type = 'extended';
        result.id = 0;
        for (let i = 1; i < 9; i++) {
            result.id *= 16;
            result.id += parseInt(msg[i], 16);
        }
        result.dataLength = parseInt(msg[9], 16);
        result.data = [];
        for (let i = 0; i < result.dataLength; i++) {
            result.data.push(parseInt(msg[10 + 2*i] + msg[10 + 2*i + 1], 16));
        }
    } else if(msg[0] == 't') {
        result.type = 'standard';
        result.id = 0;
        for (let i = 1; i < 4; i++) {
            result.id *= 16;
            result.id += parseInt(msg[i], 16);
        }
        result.dataLength = parseInt(msg[4]), 16;
        result.data = [];
        for (let i = 0; i < result.dataLength; i++) {
            result.data.push(parseInt(msg[5 + 2*i] + msg[5 + 2*i + 1], 16));
        }
    } else {
        throw `unknown message type (short or extended) : ${msg[0]}`;
    }

    return result;
}

function pad(n: string, width:number, z = 0) {
    return n.length >= width ? n : new Array(width - n.length + 1).join(z.toString()) + n;
}

function FrameToCanMsg (frame: CanFrame): string {
    let msg = '';
    msg += frame.type === 'standard' ? 't' : 'T';
    msg += pad(frame.id.toString(16), 3);
    msg += frame.dataLength.toString(16);
    for (let index = 0; index < frame.dataLength; index++) {
        msg += pad(frame.data[index].toString(16), 2);
    }
    msg += '\r';
    return msg;
}

const test: {
    isOpen: boolean;
} = {
    isOpen: false
};

const can: {
    isOpen: boolean;
    port: SerialPort;
    parser: SerialPort.parsers.Readline | undefined;
    dataCallback: DataCallback;
    init (dataCallback: DataCallback): void;
    initCanModule (): void;
    write (message: string): Promise<void>;
    sendFrame (frame: CanFrame): Promise<void>;
} = {
    isOpen: false,
    port: new SerialPort('/dev/ttyACM0', { // /dev/ttyACM0
        autoOpen: false,
        baudRate: 115200
    }),
    parser: undefined,
    dataCallback: (frame) => null,

    init (dataCallback: DataCallback):void {
        this.dataCallback = dataCallback;
        this.port.open((err: Error | null | undefined) => {
            if (err) {
                logger.error('Error opening port: ', err.message);
                logger.info(`retying port opening in 5 seconds...`);
                setTimeout(() => {
                    this.init(dataCallback);
                }, 5000);
            }
        });

        this.port.on('open', () => {
            logger.info('port opened!');

            this.parser = this.port.pipe(new SerialPort.parsers.Readline({delimiter: '\r'}));
            this.parser.on('data', (data: any) => {
                try {
                    const frame = CanMsgToFrame(data);
                    if(debug_logFrames) { logger.debug(`new can frame: ${frame}`); }
                    this.dataCallback(frame);
                } catch (error) {
                    // console.error(error);
                }
            });

            this.initCanModule();
        });
    },

    initCanModule (): void {
        logger.info('initializing can module');
        this.port.write('S3\r', (err: Error | null | undefined) => {
            if (err) {
                return logger.error(`cannot set canbus speed; Error on write: ${err.message}`);
            }

            logger.info('can module speed set to S3');
    
            this.port.write('O\r', (err: Error | null | undefined) => {
                if (err) {
                    return logger.error(`cannot open canbus; Error on write: ${err.message}`);
                }
                logger.info('canbus opened successfully');
                this.isOpen = true;
            });
        });
    },

    async write (message: string): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject('port is not opened');
        }
        return new Promise((resolve, reject) => {
            this.port.write(message, async (err: Error | null | undefined) => {
                if (err) {
                    return reject(err);
                }
                await timeout(100);
                return resolve();
            });
        });
    },

    async sendFrame (frame: CanFrame): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject('port is not opened');
        }
        return new Promise((resolve, reject) => {
            this.port.write(FrameToCanMsg(frame), async (err: Error | null | undefined) => {
                if (err) {
                    return reject(err);
                }
                await timeout(100);
                return resolve();
            });
        });
    }
};

export {
    can,
    CanFrame
};
