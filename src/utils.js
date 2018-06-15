import {inject, observer, Provider} from 'mobx-react';
import App from 'next/app';
import React from 'react';

export const cleanProps = (props) => {
    const _props = {};
    Object.keys(props).forEach((key) => {
        if (!['initialStoreConstructorArgs',
              'isServer'].includes(key)) {
            _props[key] = props[key];
        }
    });
    return _props;
};

// export const componentSetup = (
//     (storeConstructorArgs, storeFactories, storeNames, props) => {
//         return [
//             makeStores(
//                 props.initialStoreConstructorArgs || storeConstructorArgs,
//                 props.hasOwnProperty('isServer') ? props.isServer : isNode(),
//                 storeFactories,
//                 storeNames
//             ),
//             cleanProps(props)
//         ];
//     }
// );

// ^ call site is where the non-page/app detection should take place

export const componentSetup = (
    (isServer, storeFactories, storeNames, props) => {
        return [
            makeStores(
                isServer,
                props.initialStoreConstructorArgs,
                storeFactories,
                storeNames
            ),
            cleanProps(props)
        ];
    }
);

export const ctxExtrasSetup = (initialStoreConstructorArgs) => {
    let _initialStoreConstructorArgs;
    if (typeof initialStoreConstructorArgs === 'undefined') {
        _initialStoreConstructorArgs = {};
    } else {
        _initialStoreConstructorArgs = (
            {...initialStoreConstructorArgs}
        );
    }
    return {_initialStoreConstructorArgs};
};

export const extendsApp = (Component) => (
    (Component.prototype instanceof App) || (Component === App)
);

/* global process */
export const isNode = (
    () => {
        const isNode = (
            Object.prototype.toString.call(
                typeof process !== 'undefined' ? process : 0
            ) === '[object process]'
        );
        return () => isNode;
    }
)();

/* global global */
export const extendsDocument = (
    () => {
        let Document;
        if (isNode()) {
            try {
                // Document = eval('require("next/document")').default;
                // ^ prefer not to use eval... test solution below with
                // webpack-bundle-anaylyzer
                const p = 'next/document',
                      u = (m) => global['require'](m);
                Document = u(p).default;
            } catch (e) {}
        }
        return (
            typeof Document === 'undefined'
                ? (Component) => false
                : (Component) => (
                    (Component.prototype instanceof Document)
                        || (Component === Document)
                )
        );
    }
)();

export const isConstructor = (
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

export const makeStores = (
    (isServer,
     storeConstructorArgs,
     storeFactories,
     storeNames) => {
         const stores = {};
         storeNames.forEach((name, index) => {
             stores[name] = storeFactories[index].make(
                 storeConstructorArgs[name], isServer, name
             );
         });
         return stores;
     }
);

export const ordinalSuffixOf = (i) => {
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

export const resolveStoreConstructorArgs = (
    async (ctx,
           initialStoreConstructorArgs,
           isServer,
           storeConstructorArgs,
           storeFactories,
           storeNames) => {
               const {_initialStoreConstructorArgs} = (
                   ctxExtrasSetup(initialStoreConstructorArgs)
               );
               const len = storeNames.length;
               for (let index = 0; index < len; index++) {
                   const factory = storeFactories[index],
                         name = storeNames[index],
                         seedArgs = [...storeConstructorArgs[name]];
                   if (!_initialStoreConstructorArgs[name]) {
                       const Store = factory.Store;
                       if (Store.getInitialConstructorArgs) {
                           _initialStoreConstructorArgs[name] = [...(
                               await Store.getInitialConstructorArgs(
                                   {isServer, seedArgs, ctx}
                               )
                           )];
                       } else {
                           _initialStoreConstructorArgs[name] = seedArgs;
                       }
                   }
               }
               return {
                   initialStoreConstructorArgs: _initialStoreConstructorArgs
               };
           }
);

export const wrapAppComponent = (Component, props) => {
    return React.createElement(
        Component,
        props
    );
};

export const wrapComponent = (Component, storeNames, stores, props) => {
    return React.createElement(
        Provider,
        stores,
        React.createElement(
            Component,
            props
        )
    );
};
