// @flow
const Maybe = require('folktale/maybe');
import { indexOf as _indexOf } from 'lodash';

const SUPPORTED_AUTOMATION_SERVERS = ['gocd', 'jenkins'];

export const parseEnvironments = (env: string = '') => {
    if (!env.length) return Maybe.Nothing();

    return Maybe.Just(env.split(',').map((i) => i.trim()));
};

export const parseAutomationServer = (automationServer: any) => {
    if (!automationServer) return Maybe.Nothing();

    if(_indexOf(SUPPORTED_AUTOMATION_SERVERS, automationServer) >= 0) {
        return Maybe.Just(automationServer);
    } else {
        return Maybe.Nothing();
    }
};