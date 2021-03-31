import {can, CanFrame} from './can';
import MQTT from 'mqtt';

const mqtt = MQTT.connect('mqtt://192.168.0.150');

const COMMAND_SET_CONFIG = 1;
const COMMAND_SET_OUTPUT = 2;
const COMMAND_GET_INPUTS = 3;
const COMMAND_GET_OUTPUTS = 4;

const lightboardCommandAddress = 0x601;
const inputsAddress = 0x701;
const outputsAddress = 0x702;

const inputs: Array<boolean> = [];
const outputs: Array<boolean> = [];

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
        console.log(error);
    }
}

can.init((frame: CanFrame) => {
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
    default:
        break;
    }
});

mqtt.on('connect', () => {

    setInterval(async () => {
        for (let index = 0; index < 64; index++) {
            mqtt.publish(`lightboard/get/inputs/${index}`, inputs[index] ? 'ON' : 'OFF');
            mqtt.publish(`lightboard/get/outputs/${index}`, outputs[index] ? 'ON' : 'OFF');
        }
        await sendCommand(COMMAND_GET_INPUTS);
        await sendCommand(COMMAND_GET_OUTPUTS);
    }, 1000);

    for (let index = 0; index < 64; index++) {
        mqtt.subscribe(`lightboard/set/outputs/${index}`, err => {if (err) console.error(err);});
    }

    mqtt.on('message', (topic: string, message) => {
        // console.log(`topic: ${topic} : ${message}`);
        const topicPath = topic.split('/');
        if (topicPath[0] === 'lightboard') {
            if (topicPath[1] === 'set') {
                if (topicPath[2] === 'outputs') {
                    const address = parseInt(topicPath[3]);
                    const state = (message.toString() === 'ON') ? 1 : 0;
                    // console.log(`state: ${state}`);
                    sendCommand(COMMAND_SET_OUTPUT, address, state);
                }
            }
        }
    });
});

mqtt.on('error', console.error);
