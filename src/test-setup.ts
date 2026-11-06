// Leaflet (MapComponent) observes its container size and draws routes with SVG; jsdom has neither API.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
if (!('createSVGRect' in SVGSVGElement.prototype)) {
  Object.defineProperty(SVGSVGElement.prototype, 'createSVGRect', {
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
}

// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
