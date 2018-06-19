import {makeWrapper, setupConfig, setupOptions} from './helpers';
import {StoreFactory} from './store';

export * from './store';

// notes, todo
/* =============================================================================

(+) clean up package.json "scripts" -- some may not be necessary; clarify
    whether it's really necessary to build w/ babel to import withMobX from
    pages/ scripts, i.e. next-redux-wrapper imports from '../lib' but maybe can
    import from '../src'; if can import from '../scr' then revise "start" (and
    may not need "watch")

(+) strategy change: don't automatically use inject/observer, just wrap page
    component in Provider and leave it to this lib's user to call
    inject/observer on a page and/or its children and/or their children in
    turn, and so on

(+) strateogy change: use "__withMobX_" prefixed name-variants for isServer
    and initialStoreConstructorArgs properties

(+) strategy change: throw an error if withMobX was called on a non-page/app
    component; the error will come a bit late, i.e. when a page is in the
    process of being rendered based on detecting that getInitialProps was not
    called, i.e. based on missing "__withMobX_" prefixed properties

(+) use WeakMap with page/app wrapper objects (name the functions! -- pass to
    factory's "make" and on to StoreHouse instance's "handle"), involving a
    combo of keys and counters, to have a mechanism that expunges store-name
    keys in a StoreHouse; this should address problems that will likely arise
    from hot reload during development (possibly in production too)... need to
    experiment and test

(+) revise error messages and warnings using template literals and "dedent";
    see: https://github.com/dmnd/dedent

(+) figure out guidance/usage re: `mobxReact.useStaticRendering(true)` in
    server environment; it can be called repeatedly w/o bad effect, so perhaps
    do it in getInitialProps of page/app... any implications for doing that
    automatically as opposed to users of this lib using a custom next-server
    approach that calls it only once (or doesn't call it for some reason)
    during server initialization? perhaps withMobX can support a 1st/2nd
    argument that could be a boolean and if so would be a flag
    ("autoDisableStaticRenderingOnServer", default `true`) indicating whether
    to automatically call useStaticRendering... would be better to use an
    options argument for both this flag and a non-default StoreFactory
    constructor; so 1st arg would either be options object or a string

(+) StoreHouse "handle" method should be revised so that it subsumes task of
    checking for existing store-name key, and therefore the next steps after it
    is called can proceed to setting/using a value based on handle's return
    value; or maybe just have handle do everything including store
    instatiation/return

(+) StoreHouse can be revised (e.g. its "set" and "handle" methods) so that
    it's stricter about the relationships between Store constructors and
    instances and StoreFactory constructors

(+) revise impl of extendsDocument to avoid use of eval
    see: https://arunoda.me/blog/ssr-and-server-only-modules
    maybe can just put the package name ('next/document') into a variable and
    invoke require via a function that would be called w/ that variable, so
    that webpack can't analyze it... need to test using the "webpack analyzer"
    mentioned in the blog post (link above)

(+) formal tests

(+) docs and examples

(+) docs/examples should probably include heads-up re: mutation of store
    constructor args w/in getInitialConstructorArgs and store constructors

(+) docs/examples should explain that withMobX cannot be used with Next's
    Document nor with non-page/app components

(+) docs should explain implications of "autoDisableStaticRenderingOnServer"
    withMobX flag

(+) a "with-mobx-wrapper" pull request for zeit/next.js

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
        && ((args0.prototype instanceof StoreFactory)
            || (args0 === StoreFactory))) {
        defaultStoreFactory = args0;
        count += 1;
        args.shift();
    } else {
        defaultStoreFactory = StoreFactory;
    }
    const storeConstructorArgs = {},
          storeFactories = [];
    let storeNames = new Set();
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
        if (storeNames.has(name)) {
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
                factory = new defaultStoreFactory(factory);
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
            || !args[0][Symbol.iterator]
            || typeof args[0] === 'string'
           ) {
            constructorArgs = null;
        } else {
            count += 1;
            constructorArgs = args.shift();
        }
        storeConstructorArgs[name] = constructorArgs
            ? [...constructorArgs]
            : [];
        storeFactories.push(factory);
        storeNames.add(name);
    }
    storeNames = [...storeNames];
    return function (Component) {
        let _Component;
        if (extendsDocument(Component)) {
            throw new TypeError(
                'Component cannot have Next.js Document in its prototype' +
                    ' chain nor be identity with Document'
            );
        }
        if (extendsApp(Component)) {
            const AppComponent = Component;
            _Component = function _Component({Component, pageProps, router}) {
                // ^ can pass _Component to factory's "make" and StoreHouse
                // instance's "handle" for use w/ WeakMap mechanism
                const isServer = !!_Component.isServer;
                const [stores, _pageProps] = componentSetup(
                    isServer, storeFactories, storeNames, pageProps
                );
                const appComponentProps = {router};
                appComponentProps.Component = function (props) {
                    return wrapComponent(
                        Component, storeNames, stores, props
                    );
                };
                appComponentProps.pageProps = _pageProps;
                return wrapAppComponent(AppComponent, appComponentProps);
            };

            _Component.getInitialProps = async function (
                {Component, ctx, initialStoreConstructorArgs, router}
            ) {
                const isServer = !!ctx.req;
                _Component.isServer = isServer;
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
            _Component = function _Component(props) {
                // ^ can pass _Component to factory's "make" and StoreHouse
                // instance's "handle" for use w/ WeakMap mechanism
                const isServer = !!_Component.isServer;
                return wrapComponent(
                    Component,
                    storeNames,
                    ...componentSetup(
                        isServer, storeFactories, storeNames, props
                    )
                );
            };

            _Component.getInitialProps = async function (
                {initialStoreConstructorArgs, ...ctx}
            ) {
                const isServer = !!ctx.req;
                _Component.isServer = isServer;
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
