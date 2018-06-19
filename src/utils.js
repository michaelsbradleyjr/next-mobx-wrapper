import App from 'next/app';

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

export const extendsApp = (Component) => (
    (Component.prototype instanceof App) || (Component === App)
);

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
