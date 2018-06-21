import dedent from 'dedent';
import App from 'next/app';

export const extendsApp = (Component) => (
    (Component.prototype instanceof App) || (Component === App)
);

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

export const reformat = (s) => dedent(s).replace(/\s+/g, ' ').trim();
