declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}

declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "satori/yoga.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "@resvg/resvg-wasm/index_bg.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
