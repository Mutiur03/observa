"use client";

import { init } from "./index";
import type { InitOptions } from "./index";

type ObservaProps = InitOptions;

let initialized = false;

export function Observa(props: ObservaProps) {
  if (!initialized && props.apiKey) {
    initialized = true;
    queueMicrotask(() => init(props));
  }

  return null;
}
