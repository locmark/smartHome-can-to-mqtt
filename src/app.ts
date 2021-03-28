import {can, CanFrame} from './can';

const COMMAND_SET_CONFIG = 1;
const COMMAND_SET_OUTPUT = 2;
const COMMAND_GET_INPUTS = 3;
const COMMAND_GET_OUTPUTS = 4;

const inputs: Array<boolean> = [];
const outputs: Array<boolean> = [];

can.init((frame: CanFrame) => {
    if(frame.dataLength < 1) {
        return;
    }

    switch (frame.data[0]) {
    case COMMAND_GET_INPUTS:
        for (let port = 0; port < 5; port++) {
            for (let pin = 0; pin < 8; pin++) {
                inputs[port * 8 + pin] = ( ((frame.data[port+1] >> pin) & 1) > 0 );
            }
        }
        break;
    case COMMAND_GET_OUTPUTS:
        for (let port = 0; port < 3; port++) {
            for (let pin = 0; pin < 8; pin++) {
                outputs[port * 8 + pin] = ( ((frame.data[port+1] >> pin) & 1) > 0 );
            }
        }
        break;
    default:
        break;
    }
});
