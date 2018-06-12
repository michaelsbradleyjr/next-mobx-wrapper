import {inject, observer, Provider} from 'mobx-react';
import App from 'next/app';
import React from 'react';

// notes, todo
/* =============================================================================

(+) formal tests

(+) docs and examples

(+) a "with-mobx-wrapper" pull request for zeit/next.js

(+) docs/examples should probably include heads-up re: mutation of store
    constructor args w/in getInitialStoreConstructorArgs and store constructors

(+) docs/examples should explain that withMobX can be used with non-page/app
    components but that such usage won't result in stores' constructors' static
    "getInitialStoreConstructorArgs" methods being invoked, same as how
    non-page/app components don't support getInitialProps per Next's docs

(+) double-check storeConstructorArgs forwarding so that factory's make
    gets forwarded args even if getInitialStoreDonstructorArgs isn't called

(+) figure out something with WeakMap and Page/App/Component objects (involving
    a combination of keys and counters) in relation to store names; need to see
    how problems crop up w.r.t. hot reload during development-usage (may be
    an issue during production-usage too)

(+) StoreHouse can be revised (e.g. its "set" and "enforce" methods) so that
    it's stricter about the relationships between Store constructors and
    instances and StoreFactory constructors

(+) StoreHouse "enforce" method should be revised so that it subsumes task
    of checking for existing key, and therefore the next steps after it is
    called can proceed to setting/using a value based on enforce's return value

(+) revise error messages and warnings using template literals and "dedent";
    see: https://github.com/dmnd/dedent

*/

// lib
// =============================================================================

export default function withMobX(...args) {
    if (args.length < 2) {
        throw new TypeError('expects at least 2 arguments');
    }
    const args0 = args[0];
    let count = 0,
        defaultStoreFactory;
    if (args0
        && (typeof args0 === 'function')
        && (args0 === StoreFactory
            || (args0.prototype instanceof StoreFactory))) {
        defaultStoreFactory = args0;
        count += 1;
        args.shift();
    } else {
        defaultStoreFactory = StoreFactory;
    }
    const storeConstructorArgs = [],
          storeFactories = [],
          storeNames = [],
          storeNamesSet = new Set();
    while (args.length) {
        count += 1;
        const name = args.shift();
        if (typeof name !== 'string') {
            if (count === 1) {
                throw new TypeError(
                    '1st argument must be a string or a' +
                        ' constructor that has StoreFactory in its prototype' +
                        ' chain (or is identity with StoreFactory)'
                );
            } else {
                throw new TypeError(
                    ordinalSuffixOf(count) +
                        ' argument must be a string when ' +
                        ordinalSuffixOf(count - 1) +
                        ' argument is an instance of (or valid constructor' +
                        ' argument for) the default StoreFactory or is a' +
                        ' non-string iterable or is a constructor that has' +
                        ' StoreFactory in its prototype chain (or is identity' +
                        ' with StoreFactory)'
                );
            }
        }
        if (storeNamesSet.has(name)) {
            throw new Error(
                'duplicate store name "' + name + '" within current invocation'
            );
        }
        count += 1;
        if (!args.length) {
            throw new TypeError(
                'expects ' + count + ' arguments when ' +
                    ordinalSuffixOf(count - 1) + ' argument is a string'
            );
        }
        let factory = args.shift();
        if (!(factory instanceof StoreFactory)) {
            try {
                factory = defaultStoreFactory(factory);
            } catch (e) {
                console.error(e);
            }
        }
        if (!(factory instanceof StoreFactory)) {
            throw new TypeError(
                ordinalSuffixOf(count) +
                    ' argument must be an instance of (or valid constructor' +
                    ' argument for) the default StoreFactory when' +
                    ordinalSuffixOf(count - 1) + ' argument is a string'
            );
        }
        let constructorArgs;
        if (!args.length
            || !args[count][Symbol.iterator]
            || typeof args[count] === 'string'
           ) {
            constructorArgs = null;
        } else {
            count += 1;
            constructorArgs = args.shift();
        }
        storeConstructorArgs.push(constructorArgs);
        storeFactories.push(factory);
        storeNames.push(name);
        storeNamesSet.add(name);
    }
    return function (Component) {
        let _Component;
        if (Component instanceof App) {
            const AppComponent = Component;
            _Component = function ({Component, pageProps, router}) {
                const [stores, _pageProps] = componentSetup(
                    storeFactories, storeNames, pageProps
                );
                const appComponentProps = {router};
                appComponentProps.Component = function (props) {
                    return wrapComponent(Component, storeNames, stores, props);
                };
                appComponentProps.pageProps = _pageProps;
                return React.createElement(AppComponent, appComponentProps);
            };

            _Component.getInitialProps = async function (
                {Component, ctx, initialStoreConstructorArgs, isServer, router}
            ) {
                const pageProps = await resolveStoreConstructorArgs(
                    ctx,
                    initialStoreConstructorArgs,
                    isServer,
                    storeConstructorArgs,
                    storeFactories,
                    storeNames
                );
                return (
                    AppComponent.getInitialProps
                        ? {...(await AppComponent.getInitialProps(
                            Component, ctx, router)),
                           ...pageProps}
                    : pageProps
                );
            };
        } else {
            _Component = function (props) {
                return wrapComponent(
                    Component,
                    storeNames,
                    ...componentSetup(storeFactories, storeNames, props)
                );
            };

            _Component.getInitialProps = async function (
                {initialStoreConstructorArgs, isServer, ...ctx}
            ) {
                const props = await resolveStoreConstructorArgs(
                    ctx,
                    initialStoreConstructorArgs,
                    isServer,
                    storeConstructorArgs,
                    storeFactories,
                    storeNames
                );
                return (
                    Component.getInitialProps
                        ? {...(await Component.getInitialProps(ctx)),
                           ...props}
                    : props
                );
            };
        }
        return _Component;
    };
};

export class StoreFactory {
    constructor(Store, {stores = defaultStoreHouse} = {}) {
        const len = arguments.length;
        if (!len) {
            throw new TypeError('expects at least 1 argument');
        }
        if (len > 2) {
            throw new TypeError('expects no more than 2 arguments');
        }
        if (typeof Store !== 'function'
            || (isConstructor !== null && !isConstructor(Store))) {
            throw new TypeError(
                '1st argument must be a function that is invokable via the' +
                    ' "new" operator'
            );
        }
        if (!(stores instanceof StoreHouse)) {
            throw new TypeError(
                '"stores" option must be an instance of StoreHouse'
            );
        }
        Object.assign(this, {Store, stores});
    }

    make(constructorArgs, isServer, name) {
        const len = arguments.length;
        if (len !== 3) {
            throw new TypeError('expects exactly 3 arguments');
        }
        if (typeof isServer !== 'boolean') {
            throw new TypeError('1st argument must be a boolean');
        }
        if (typeof name !== 'string') {
            throw new TypeError('2nd argument must be a string');
        }
        if (!constructorArgs[Symbol.iterator]) {
            throw new TypeError('3rd argument must be iterable');
        }
        const {Store, stores} = this;
        let _store;

        // revise stores.enforce so the following is cleaner

        if (!stores.has(name)) {
            _store = new Store(...constructorArgs);
            stores.set(name, isServer ? Store : _store);
        } else {
            stores.enforce(Store, isServer, name);
            _store = isServer
                ? new Store(...constructorArgs)
                : stores.get(name);
        }
        return _store;
    }
}

export class StoreHouse extends Map {
    constructor(iterable, {singletons = true,
                           warnOnSingletons = true} = {}) {
        super(iterable);
        const len = arguments.length;
        if (len > 2) {
            throw new TypeError('expects no more than 2 arguments');
        }
        if (typeof singletons !== 'boolean') {
            throw new TypeError('"singletons" option must be a boolean');
        }
        if (typeof warnOnSingletons !== 'boolean') {
            throw new TypeError('"warnOnsingletons" option must be a boolean');
        }
        Object.assign(this, {singletons, warnOnSingletons});
    }

    enforce(ExtraStore, isServer, name) {
        const len = arguments.length;
        if (len !== 3) {
            throw new TypeError('expects exactly 3 arguments');
        }
        let ExistingStore;
        if (isServer) {
            ExistingStore = this.get(name);
        } else {
            ExistingStore = this.get(name).constructor;
        }
        if (ExtraStore !== ExistingStore) {
            throw new Error(
                'duplicate name "' + name + '" for use with non-identical' +
                    ' Store constructors within the same StoreHouse instance'
            );
        }
        if (!this.singletons) {
            throw new Error(
                'duplicate name "' + name + '" for use with identical Store' +
                    ' constructors within the same *no-singletons* StoreHouse' +
                    ' instance'
            );
        }
        if (this.warnOnSingletons) {
            console.warn(
                'additional use of name "' + name + '" for identical Store' +
                    ' constructors within the same *singletons-enforcing*' +
                    ' StoreHouse instance,' +
                    (!isServer
                     ? ' a new Store instance was not constructed and'
                     : '')
                    + ' the current value was not overwritten'
            );
        }
    }
}

export const defaultStoreHouse = new StoreHouse();

/*

  Store impls can have an async static method named
  'getInitialStoreConstructorArgs'
  =================================================

    class Store {
        static async getInitialStoreConstructorArgs(
            {isServer, seedArgs, ctx}
        ) {
            return seedArgs;
        }
    }

*/

// helpers
// =============================================================================

const cleanProps = (props) => {
    const _props = {};
    Object.keys(_props).foreEach((key) => {
        if (!['initialStoreConstructorArgs',
              'isServer'].includes(key)) {
            _props[key] = props[key];
        }
    });
    return _props;
};

const componentSetup = (storeFactories, storeNames, props) => {
    return [
        makeStores(
            props.initialStoreConstructorArgs,
            props.isServer,
            storeFactories,
            storeNames
        ),
        cleanProps(props)
    ];
};

const ctxExtrasSetup = (ctx, initialStoreConstructorArgs, isServer) => {
    let _initialStoreConstructorArgs, _isServer;
    if (initialStoreConstructorArgs === undefined) {
        _initialStoreConstructorArgs = {};
    } else {
        _initialStoreConstructorArgs = (
            {...initialStoreConstructorArgs}
        );
    }
    if (isServer === undefined) {
        _isServer = !!ctx.req;
    } else {
        _isServer = !!isServer;
    }
    return {_initialStoreConstructorArgs, _isServer};
};

const isConstructor = (
    () => {
        if (typeof Proxy === 'undefined') {
        return null;
        } else {
            const handler = {
                construct() {
                    return handler;
                }
            };
            return (x) => {
                try {
                    return !!(new (new Proxy(x, handler))());
                } catch (e) {
                    return false;
                }
            };
        }
    }
)();

const makeStores = (
    (initialStoreConstructorArgs,
     isServer,
     storeFactories,
     storeNames) => {
         const stores = {};
         storeNames.forEach((name, index) => {
             stores[name] = storeFactories[index].make(
                 initialStoreConstructorArgs[name], isServer, name
             );
         });
         return stores;
     }
);

const ordinalSuffixOf = (i) => {
    const j = i % 10,
          k = i % 100;
    let n;
    if (j == 1 && k != 11) {
        n = i + 'st';
    } else if (j == 2 && k != 12) {
        n = i + 'nd';
    } else if (j == 3 && k != 13) {
        n = i + 'rd';
    } else {
        n = i + 'th';
    }
    return n;
};

const resolveStoreConstructorArgs = (
    async (ctx,
           initialStoreConstructorArgs,
           isServer,
           storeConstructorArgs,
           storeFactories,
           storeNames) => {
              const {_initialStoreConstructorArgs, _isServer} = (
                  ctxExtrasSetup(ctx, initialStoreConstructorArgs, isServer)
              );
              const len = storeNames.length;
              for (let index = 0; index < len; index++) {
                  const factory = storeFactories[index],
                        name = storeNames[index],
                        seedArgs = (
                            [...storeConstructorArgs[index]] || []
                        );
                  if (!_initialStoreConstructorArgs[name]) {
                      const Store = factory.Store;
                      if (Store.getInitialStoreConstructorArgs) {
                          _initialStoreConstructorArgs[name] = [...(
                              await Store.getInitialStoreConstructorArgs(
                                  {_isServer, seedArgs, ctx}
                              )
                          )];
                      } else {
                          _initialStoreConstructorArgs[name] = seedArgs;
                      }
                  }
              }
              return {_initialStoreConstructorArgs, _isServer};
          }
);

const wrapComponent = (Component, storeNames, stores, props) => {
    return React.createElement(
        Provider,
        stores,
        React.createElement(
            inject(...storeNames)(observer(Component)),
            props
        )
    );
};
