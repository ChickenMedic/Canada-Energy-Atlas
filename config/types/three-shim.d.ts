// Three.js type shim — the 8th Wall runtime exposes THREE globally
// We declare it as `any` to avoid needing @types/three as a dependency

declare module 'three' {
  const THREE: any
  export = THREE
}

declare const THREE: any
