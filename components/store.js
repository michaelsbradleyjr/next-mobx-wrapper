/* global clearInterval setInterval */

import {action, observable} from 'mobx';

export default class Store {
    @observable lastUpdate = null;
    @observable light = false;

    timer = null;

    static async getInitialConstructorArgs(
        {isServer, seedArgs, ctx}
    ) {
        if (!seedArgs[0]) { seedArgs[0] = Date.now(); }
        return seedArgs;
    }

    constructor (lastUpdate = Date.now()) {
        this.lastUpdate = lastUpdate;
    }

    @action start = () => {
        this.timer = setInterval(() => {
            this.lastUpdate = Date.now();
            this.light = true;
        }, 1000);
    };

    stop = () => clearInterval(this.timer);
};
