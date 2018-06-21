import {makeWrapper, setupConfig, setupOptions} from './helpers';
import {StoreFactory} from './store';

export * from './store';

// notes, todo
/* =============================================================================

(+) use WeakMap with page/app wrappers (pass wrapper to factory's "make" and on
    to StoreHouse instance's "handle"), involving a combo of keys and counters,
    to have a mechanism that expunges store-name keys in a StoreHouse; this
    should address problems that will likely arise from hot reload during
    development (possibly in production too)... need to experiment and
    test... it seems WeakRefs is really what's needed, WeakMap just doesn't
    offer the needed functionality

(+) ^ !!! may need a different approach; could label pages server-side with a
    hash derived from the file path (should be unique for each <page>.js and
    _app.js) and pair that w/ __withMobX_pageId on initial props; if the same
    page/app (i.e. same id) is a different object then decrement a store-key
    counter, or something like that; if counter hits zero then remove the
    store-key (the name of the store given to withMobX)... may run into some
    old-page pre/fetch logic issues w.r.t. other pages/app using same key name
    that have also changed though browser isn't navigated to them at that time

(+) StoreHouse "handle" method should be revised so that it subsumes task of
    checking for existing store-name key, and therefore the next steps after it
    is called can proceed to setting/using a value based on handle's return
    value; or maybe just have handle do everything including store
    instatiation/return

(+) StoreHouse can be revised (e.g. its "set" and "handle" methods) so that
    it's stricter about the relationships between Store constructors and
    instances and StoreFactory constructors

(+) formal tests

(+) docs and examples

(+) docs/examples should include heads-up re: mutation of store constructor
    args w/in getInitialConstructorArgs and store constructors

(+) docs/examples should explain that withMobX cannot be used with Next's
    Document nor with non-page/app components

(+) docs should explain implications of "autoEnableStaticRenderingOnServer"
    and "defaultStoreFactory" withMobX options

(+) a "with-mobx-wrapper" pull request for zeit/next.js

*/

export const defaultOptions = Object.freeze({
    autoEnableStaticRenderingOnServer: true,
    defaultStoreFactory: StoreFactory
});

export const makeWithMobX = (...args) => {
    if (args.length > 1) {
        throw new TypeError(`expects no more than 1 argument`);
    }
    const [options = defaultOptions] = args;
    if (typeof options !== 'object') {
        throw new TypeError(`argument must be an object`);
    }
    return (...args) => {
        const _options = setupOptions(defaultOptions, options),
              config = setupConfig(args, _options);
        return (Component) => (
            makeWrapper(Component, {...config, options: _options})
        );
    };
};

export const defaultWithMobX = makeWithMobX();

export default defaultWithMobX;
