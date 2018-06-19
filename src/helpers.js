import {inject, observer, Provider, useStaticRendering} from 'mobx-react';
import React from 'react';
import {StoreFactory} from './store';
import {extendsApp, extendsDocument, ordinalSuffixOf} from './utils';

export const cleanProps = ({props}) => {
    const _props = {};
    Object.keys(props).forEach((key) => {
        if (!['__withMobX_initialStoreConstructorArgs',
              '__withMobX_isServer'].includes(key)) {
            _props[key] = props[key];
        }
    });
    return _props;
};

export const getInitialProps = async (...args) => {
    const [_args, Component, config, ctx, Wrapper] = args;
    const {isServer, props} = await setupIsServerAndProps(
        Wrapper, config, ctx
    );
    return (
        Component.getInitialProps
            ? {...(await Component.getInitialProps(..._args)),
               ...props}
        : props
    );
};

export const isServer = Symbol('isServer');

export const makeAppComponent = (AppComponent, config) => {
    const _AppComponent = ({Component, pageProps, router}) => {
        // ^ can pass _AppComponent to factory's "make" and StoreHouse
        // instance's "handle" for use w/ WeakMap mechanism
        const {initialStoreConstructorArgs, isServer} = setupAppOrPage(
            _AppComponent, pageProps
        );
        const [_pageProps, stores] = setupPropsAndStores(
            {...config,
             isServer,
             props: pageProps,
             storeConstructorArgs: initialStoreConstructorArgs}
        );
        const appProps = {router};
        appProps.Component = (props) => (
            wrapPageComponent(Component, props, stores)
        );
        appProps.pageProps = _pageProps;
        return wrapAppComponent(AppComponent, appProps);
    };

    _AppComponent.getInitialProps = async ({Component, ctx, router}) => {
        return await getInitialProps(
            [Component, ctx, router],
            AppComponent,
            config,
            ctx,
            _AppComponent
        );
    };

    return _AppComponent;
};

export const makePageComponent = (PageComponent, config) => {
    const _PageComponent = (props) => {
        // ^ can pass _Component to factory's "make" and StoreHouse
        // instance's "handle" for use w/ WeakMap mechanism
        const {initialStoreConstructorArgs, isServer} = setupAppOrPage(
            _PageComponent, props
        );
        return wrapPageComponent(
            PageComponent,
            ...setupPropsAndStores(
                {...config,
                 isServer,
                 props,
                 storeConstructorArgs: initialStoreConstructorArgs}
            )
        );
    };

    _PageComponent.getInitialProps = async (ctx) => {
        return await getInitialProps(
            [ctx],
            PageComponent,
            config,
            ctx,
            _PageComponent
        );
    };

    return _PageComponent;
};

export const makeStores = (config) => {
    const {isServer, storeConstructorArgs, storeFactories, storeNames} = config,
          stores = {};
    storeNames.forEach((name, index) => {
        stores[name] = storeFactories[index].make(
            storeConstructorArgs[name], isServer, name
        );
    });
    return stores;
};

export const makeWrapper = (Component, config) => {
    if (extendsDocument(Component)) {
        throw new TypeError(
            'Component cannot have Next.js Document in its prototype chain' +
                ' nor be identity with Document'
        );
    }
    let make;
    if (extendsApp(Component)) {
        make = makeAppComponent;
    } else {
        make = makePageComponent;
    }
    return make(Component, config);
};

export const parseName = (args, counter, storeNames) => {
    counter.count += 1;
    const name = args.shift();
    if (typeof name !== 'string') {
        if (counter.count === 1) {
            throw new TypeError('1st argument of withMobX must be a string');
        } else {
            throw new TypeError(
                ordinalSuffixOf(counter.count) +
                    ' argument of withMobX must be a string when its ' +
                    ordinalSuffixOf(counter.count - 1) +
                    ' argument is an instance of (or valid constructor' +
                    ' argument for) the default StoreFactory or is a' +
                    ' non-string iterable'
            );
        }
    }
    if (storeNames.has(name)) {
        throw new Error(
            'duplicate store name "' + name + '" within current invocation' +
                ' of withMobX'
        );
    }
    return name;
};

export const parseFactory = (args, counter, options) => {
    counter.count += 1;
    if (!args.length) {
        throw new TypeError(
            'withMobX expects ' + counter.count + ' arguments when its ' +
                ordinalSuffixOf(counter.count - 1) + ' argument is a string'
        );
    }
    let factory = args.shift();
    if (!(factory instanceof StoreFactory)) {
        try {
            factory = new options.defaultStoreFactory(factory);
        } catch (e) {
            console.error(e);
        }
    }
    if (!(factory instanceof StoreFactory)) {
        throw new TypeError(
            ordinalSuffixOf(counter.count) +
                ' argument of withMobX must be an instance of (or valid' +
                ' constructor argument for) the default StoreFactory when' +
                ' its ' + ordinalSuffixOf(counter.count - 1) + ' argument is' +
                ' a string'
        );
    }
    return factory;
};

export const parseConstructorArgs = (args, counter) => {
    let constructorArgs;
    if (!args.length
        || !args[0][Symbol.iterator]
        || typeof args[0] === 'string'
       ) {
        constructorArgs = null;
    } else {
        counter.count += 1;
        constructorArgs = args.shift();
    }
    return constructorArgs;
};

export const resolveStoreConstructorArgs = async (config) => {
    const {ctx,
           isServer,
           storeConstructorArgs,
           storeFactories,
           storeNames} = config,
          __withMobX_initialStoreConstructorArgs = {},
          len = storeNames.length;
    for (let index = 0; index < len; index++) {
        const factory = storeFactories[index],
              name = storeNames[index],
              seedArgs = [...storeConstructorArgs[name]];
        const Store = factory.Store;
        if (Store.getInitialConstructorArgs) {
            __withMobX_initialStoreConstructorArgs[name] = [...(
                await Store.getInitialConstructorArgs(
                    {isServer, seedArgs, ctx}
                )
            )];
        } else {
            __withMobX_initialStoreConstructorArgs[name] = (
                seedArgs
            );
        }
    }
    return {
        __withMobX_initialStoreConstructorArgs,
        __withMobX_isServer: isServer
    };
};

export const setupAppOrPage = (Component, componentProps) => {
    if (!Component.hasOwnProperty(isServer)) {
        throw new TypeError(
            'Wrapped component was not invoked as a Next.js App or Page'
        );
    }
    return {
        initialStoreConstructorArgs:
        componentProps.__withMobX_initialStoreConstructorArgs,
        isServer:
        Component[isServer]
    };
};

export const setupConfig = (args, options) => {
    if (args.length < 2) {
        throw new TypeError('withMobX expects at least 2 arguments');
    }
    const counter = {count: 0},
          storeConstructorArgs = {},
          storeFactories = [];
    let storeNames = new Set();
    while (args.length) {
        const name = parseName(args, counter, storeNames),
              factory = parseFactory(args, counter, options),
              constructorArgs = parseConstructorArgs(args, counter);
        storeConstructorArgs[name] = constructorArgs
            ? [...constructorArgs]
            : [];
        storeFactories.push(factory);
        storeNames.add(name);
    }
    storeNames = [...storeNames];
    return {storeConstructorArgs, storeFactories, storeNames};
};

export const setupIsServerAndProps = async (Component, config, ctx) => {
    const _isServer = !!ctx.req;
    if (_isServer && config.options.autoEnableStaticRenderingOnServer) {
        useStaticRendering(true);
    }
    Component[isServer] = _isServer;
    const props = await resolveStoreConstructorArgs(
        {...config,
         ctx,
         isServer: _isServer},
    );
    return {isServer: _isServer, props};
};

export const setupOptions = (defaultOptions, options) => {
    if (!arguments.length) {
        throw new TypeError('expects exactly 1 argument');
    }
    if (typeof options !== 'object') {
        throw new TypeError('argument must be an object');
    }
    const _options = {...defaultOptions, ...options},
          {autoEnableStaticRenderingOnServer, defaultStoreFactory} = _options;
    if (typeof autoEnableStaticRenderingOnServer !== 'boolean') {
        throw new TypeError(
            '"autoEnableStaticRenderingOnServer" option must be a boolean'
        );
    }
    if (!((defaultStoreFactory.prototype instanceof StoreFactory)
          || (defaultStoreFactory === StoreFactory))) {
        throw new TypeError(
            '"defaultStoreFactory" option must be a constructor that has' +
                ' StoreFactory in its prototype chain or is identity with' +
                ' StoreFactory');
    }
    return _options;
};

export const setupPropsAndStores = (config) => {
    return [
        cleanProps(config),
        makeStores(config),
    ];
};

export const wrapAppComponent = (Component, props) => {
    return React.createElement(
        Component,
        props
    );
};

export const wrapPageComponent = (Component, props, stores) => {
    return React.createElement(
        Provider,
        stores,
        React.createElement(
            Component,
            props
        )
    );
};
