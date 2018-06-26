import {isConstructor, NODE_ENV, reformat} from './utils';

export class StoreFactory {
    constructor(Store, options = defaultStoreFactoryOptions) {
        const len = arguments.length;
        if (!len) {
            throw new TypeError(`expects at least 1 argument`);
        }
        if (len > 2) {
            throw new TypeError(`expects no more than 2 arguments`);
        }
        if (typeof Store !== 'function'
            || (isConstructor !== null && !isConstructor(Store))) {
            throw new TypeError(reformat(`
                1st argument must be a function that is invokable via the "new"
                operator
            `));
        }
        if (typeof options !== 'object') {
            throw new TypeError(`2nd argument must be an object`);
        }
        const _options = {...defaultStoreFactoryOptions, ...options},
              {stores} = _options;
        if (!(stores instanceof StoreHouse)) {
            throw new TypeError(
                `"stores" option must be an instance of StoreHouse`
            );
        }
        Object.assign(this, {Store, stores});
    }

    make(constructorArgs, isServer, name) {
        const len = arguments.length;
        if (len !== 3) {
            throw new TypeError(`expects exactly 3 arguments`);
        }
        if (!constructorArgs[Symbol.iterator]) {
            throw new TypeError(`1st argument must be iterable`);
        }
        if (typeof isServer !== 'boolean') {
            throw new TypeError(`2nd argument must be a boolean`);
        }
        if (typeof name !== 'string') {
            throw new TypeError(`3rd argument must be a string`);
        }
        const {Store, stores} = this;
        let _store;
        if (!stores.has(name)) {
            _store = new Store(...constructorArgs);
            stores.set(name, isServer ? Store : _store);
        } else {
            stores.handle(Store, isServer, name);
            _store = isServer
                ? new Store(...constructorArgs)
                : stores.get(name);
        }
        return _store;
    }
}

export const defaultStoreHouseOptions = Object.freeze({
    singletons: true,
    warnOnSingletons: NODE_ENV !== 'production'
});

export class StoreHouse extends Map {
    constructor(iterable, options = defaultStoreHouseOptions) {
        super(iterable);
        const len = arguments.length;
        if (len > 2) {
            throw new TypeError(`expects no more than 2 arguments`);
        }
        if (typeof options !== 'object') {
            throw new TypeError(`2nd argument must be an object`);
        }
        const _options = {...defaultStoreHouseOptions, ...options},
              {singletons, warnOnSingletons} = _options;
        if (typeof singletons !== 'boolean') {
            throw new TypeError(`"singletons" option must be a boolean`);
        }
        if (typeof warnOnSingletons !== 'boolean') {
            throw new TypeError(`"warnOnsingletons" option must be a boolean`);
        }
        Object.assign(this, {singletons, warnOnSingletons});
    }

    handle(ExtraStore, isServer, name) {
        const len = arguments.length;
        if (len !== 3) {
            throw new TypeError(`expects exactly 3 arguments`);
        }
        let ExistingStore;
        if (isServer) {
            ExistingStore = this.get(name);
        } else {
            ExistingStore = this.get(name).constructor;
        }
        if (ExtraStore !== ExistingStore) {
            throw new Error(reformat(`
                duplicate name "${name}" for use with non-identical Store
                constructors within the same StoreHouse instance
            `));
        }
        if (!this.singletons) {
            throw new Error(reformat(`
                duplicate name "${name}" for use with identical Store
                constructors within the same \`singletons:false\` StoreHouse
                instance
            `));
        }
        if (this.warnOnSingletons) {
            const phrase = !isServer
                  ? reformat(`
                      , a new Store instance was not constructed and the
                      current value was not overwritten
                  `)
                  : '';
            console.warn(reformat(`
                additional use of name "${name}" for identical Store
                constructors within the same \`singletons:true\` StoreHouse
                instance${phrase}
            `));
        }
    }
}

export const defaultStoreHouse = new StoreHouse();

export const defaultStoreFactoryOptions = Object.freeze({
    stores: defaultStoreHouse
});

/* Store impls can have an async static method named
   'getInitialConstructorArgs'
   ================================================= */
// Example:
class Store {
    static async getInitialConstructorArgs(
        {isServer, seedArgs, ctx}
    ) {
        return seedArgs;
    }
}
