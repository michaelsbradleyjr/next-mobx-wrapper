import {inject, observer, Provider} from 'mobx-react';
import React from 'react';

export const cleanProps = (props) => {
    const _props = {};
    Object.keys(_props).foreEach((key) => {
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
    (storeConstructorArgs, storeFactories, storeNames, props) => {
        return [
            makeStores(
                props.initialStoreConstructorArgs ,
                props.isServer,
                storeFactories,
                storeNames
            ),
            cleanProps(props)
        ];
    }
);

export const ctxExtrasSetup = (ctx, initialStoreConstructorArgs, isServer) => {
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
            inject(...storeNames)(observer(Component)),
            props
        )
    );
};
