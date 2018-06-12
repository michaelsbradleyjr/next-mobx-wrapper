import App from 'next/app';
import React from 'react';

import * as utils from './utils';
import {StoreFactory, StoreHouse, defaultStoreHouse} from './store';
export {StoreFactory, StoreHouse, defaultStoreHouse} from './store';

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

(+) consider checking in withMobX whether the Component is an instance of next's
    Document class and throwing an 'unsupported' error

*/

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
                    utils.ordinalSuffixOf(count) +
                        ' argument must be a string when ' +
                        utils.ordinalSuffixOf(count - 1) +
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
                    utils.ordinalSuffixOf(count - 1) + ' argument is a string'
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
                utils.ordinalSuffixOf(count) +
                    ' argument must be an instance of (or valid constructor' +
                    ' argument for) the default StoreFactory when' +
                    utils.ordinalSuffixOf(count - 1) + ' argument is a string'
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
                const [stores, _pageProps] = utils.componentSetup(
                    storeFactories, storeNames, pageProps
                );
                const appComponentProps = {router};
                appComponentProps.Component = function (props) {
                    return utils.wrapComponent(
                        Component, storeNames, stores, props
                    );
                };
                appComponentProps.pageProps = _pageProps;
                return React.createElement(AppComponent, appComponentProps);
            };

            _Component.getInitialProps = async function (
                {Component, ctx, initialStoreConstructorArgs, isServer, router}
            ) {
                const pageProps = await utils.resolveStoreConstructorArgs(
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
                return utils.wrapComponent(
                    Component,
                    storeNames,
                    ...utils.componentSetup(storeFactories, storeNames, props)
                );
            };

            _Component.getInitialProps = async function (
                {initialStoreConstructorArgs, isServer, ...ctx}
            ) {
                const props = await utils.resolveStoreConstructorArgs(
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
