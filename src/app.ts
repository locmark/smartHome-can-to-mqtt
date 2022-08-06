import {can, CanFrame} from './can';
import MQTT from 'mqtt';
import { logger } from './logger'

const mqtt = MQTT.connect('mqtt://localhost');

const COMMAND_SET_CONFIG = 1;
const COMMAND_SET_OUTPUT = 2;
const COMMAND_GET_INPUTS = 3;
const COMMAND_GET_OUTPUTS = 4;

const heatingUpstairsAddress = 0x500;
const lightboardCommandAddress = 0x601;
const inputsAddress = 0x701;
const outputsAddress = 0x702;

const inputs: Array<boolean> = [];
const outputs: Array<boolean> = [];
const heatingUpsatirsInputs: Array<boolean> = [false, false, false, false, false, false, false, false];

async function sendCommand(command: number, address = -1, value = -1) {
    const frame: CanFrame = {
        id: lightboardCommandAddress,
        type: 'standard',
        dataLength: 1,
        data: [command]
    };

    if(address != -1) {
        frame.dataLength++;
        frame.data.push(address);
    }
    
    if(value != -1) {
        frame.dataLength++;
        frame.data.push(value);
    }

    try {
        await can.sendFrame(frame);
    } catch (error) {
        logger.error(`cannot send command: ${error}`)
    }
}

can.init((frame: CanFrame) => {
    logger.info(`new can frame: id: ${frame.id}; len: ${frame.dataLength}; data: ${frame.data}`);

    if(frame.dataLength < 1) {
        return;
    }

    switch (frame.id) {
        case inputsAddress:
            for (let port = 0; port < 8; port++) {
                for (let pin = 0; pin < 8; pin++) {
                    inputs[port * 8 + pin] = ( ((frame.data[port] >> pin) & 1) > 0 );
                }
            }
            // console.log(inputs);
            break;
        case outputsAddress:
            for (let port = 0; port < 8; port++) {
                for (let pin = 0; pin < 8; pin++) {
                    outputs[port * 8 + pin] = ( ((frame.data[port] >> pin) & 1) > 0 );
                }
            }
            // console.log(outputs);
            break;

        case heatingUpstairsAddress:
            for (let pin = 0; pin < 8; pin++) {
                heatingUpsatirsInputs[pin] = ( ((frame.data[2] >> pin) & 1) > 0 );
            }
            // console.log(heatingUpsatirsInputs);
            break;
        default:
            console.log(frame.id);
            console.log(frame.data);
            break;
    }
});

mqtt.on('connect', () => {
    logger.info('mqtt connected')
    sendCommand(COMMAND_GET_INPUTS);
    sendCommand(COMMAND_GET_OUTPUTS);

    setInterval(async () => {
        for (let index = 0; index < 64; index++) {
            mqtt.publish(`lightboard/get/inputs/${index}`, inputs[index] ? 'ON' : 'OFF');
            mqtt.publish(`lightboard/get/outputs/${index}`, outputs[index] ? 'ON' : 'OFF');
        }

        for (let index = 0; index < 8; index++) {
            mqtt.publish(`heatingUpsatirs/get/inputs/${index}`, heatingUpsatirsInputs[index] ? 'ON' : 'OFF');
        }

        await sendCommand(COMMAND_GET_INPUTS);
        await sendCommand(COMMAND_GET_OUTPUTS);
    }, 1000);

    for (let index = 0; index < 64; index++) {
        mqtt.subscribe(`lightboard/set/outputs/${index}`, err => {if (err) console.error(err);});
    }

    for (let index = 0; index < 7; index++) {
        mqtt.subscribe(`lightboard/set/cover/${index}`, err => {if (err) console.error(err);});
    }

    let ignoreNewMqttMsgs = true;
    setTimeout(() => {
        ignoreNewMqttMsgs = false;
    }, 500);

    mqtt.on('message', (topic: string, message) => {
        logger.info(`new mqtt msg: topic: ${topic} ; content: ${message}`);
        if (ignoreNewMqttMsgs) {
            logger.info('ignoring this mqtt msg');
            return;
        }
        const topicPath = topic.split('/');
        if (topicPath[0] === 'lightboard') {
            if (topicPath[1] === 'set') {
                if (topicPath[2] === 'outputs') {
                    const address = parseInt(topicPath[3]);
                    const state = (message.toString() === 'ON') ? 1 : 0;
                    // console.log(`state: ${state}`);
                    sendCommand(COMMAND_SET_OUTPUT, address, state);
                } else if (topicPath[2] === 'cover') {
                    const address = parseInt(topicPath[3]);
                    switch (message.toString()) {
                        case 'OPEN':
                            logger.info(`opening cover ${address}`);
                            sendCommand(COMMAND_SET_OUTPUT, 18 + address * 2, 1);
                            setTimeout(() => { sendCommand(COMMAND_SET_OUTPUT, 18 + address * 2, 0); }, 1000);
                            break;
                        case 'CLOSE':
                            logger.info(`closing cover ${address}`);
                            sendCommand(COMMAND_SET_OUTPUT, 18 + address * 2 + 1, 1);
                            setTimeout(() => { sendCommand(COMMAND_SET_OUTPUT, 18 + address * 2 + 1, 0); }, 1000);
                            break;
                    }
                }
            }
        }
    });
});

mqtt.on('error', console.error);
