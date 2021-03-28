import SerialPort from 'serialport';
const debug_logFrames = false;

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

function CanMsgToFrame(data: any): CanFrame {
    const result = {} as CanFrame;

    const msg: Array<string> = [];
    data.forEach((char: any) => {
        msg.push(String.fromCharCode(char));
            
    });

    if (msg.length < 2)
        throw `message too short : ${msg.length}`;

    if(msg[0] == 'T') {
        result.type = 'extended';
        result.id = 0;
        for (let i = 1; i < 9; i++) {
            result.id *= 10;
            result.id += parseInt(msg[i]);
        }
        result.dataLength = parseInt(msg[9]);
        result.data = [];
        for (let i = 0; i < result.dataLength; i++) {
            result.data.push(parseInt(msg[10 + 2*i] + msg[10 + 2*i + 1], 16));
        }
    } else if(msg[0] == 't') {
        result.type = 'standard';
        result.id = 0;
        for (let i = 1; i < 4; i++) {
            result.id *= 10;
            result.id += parseInt(msg[i]);
        }
        result.dataLength = parseInt(msg[4]);
        result.data = [];
        for (let i = 0; i < result.dataLength; i++) {
            result.data.push(parseInt(msg[5 + 2*i] + msg[5 + 2*i + 1], 16));
        }
    } else {
        throw `unknown message type (short or extended) : ${msg[0]}`;
    }

    return result;
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
} = {
    isOpen: false,
    port: new SerialPort('COM6', { // /dev/ttyACM0
        autoOpen: false,
        baudRate: 115200
    }),
    parser: undefined,
    dataCallback: (frame) => null,
    init (dataCallback: DataCallback):void {
        this.dataCallback = dataCallback;
        this.port.open((err: Error | null | undefined) => {
            if (err) {
                console.log('Error opening port: ', err.message);
                console.log(`retying in 5 seconds...`);
                setTimeout(() => {
                    this.init(dataCallback);
                }, 5000);
            }
        });

        this.port.on('open', () => {
            console.log('port opened!');

            this.parser = this.port.pipe(new SerialPort.parsers.Readline({delimiter: '\r'}));
            this.parser.on('data', (data: any) => {
                try {
                    const frame = CanMsgToFrame(data);
                    if(debug_logFrames) { console.log(frame); }
                    this.dataCallback(frame);
                } catch (error) {
                    console.error(error);
                }
            });

            this.initCanModule();
        });
    },
    initCanModule (): void {
        this.port.write('S3\r', (err: Error | null | undefined) => {
            if (err) {
                return console.log('Error on write: ', err.message);
            }
    
            this.port.write('O\r', (err: Error | null | undefined) => {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
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
    }
};

export {
    can,
    CanFrame
};
