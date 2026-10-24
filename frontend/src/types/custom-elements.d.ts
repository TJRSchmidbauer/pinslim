/**
 * JSX typing for the Web Components the canvas renders (wokwi-elements and
 * Velxio's own velxio-* parts). React 19 resolves intrinsic elements from
 * `React.JSX`, not the global `JSX` namespace the older per-file
 * declarations augmented, so those never applied. Pattern index signatures
 * cover every current and future tag of both families.
 */
import 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      [tag: `wokwi-${string}`]: any;
      [tag: `velxio-${string}`]: any;
    }
  }
}
