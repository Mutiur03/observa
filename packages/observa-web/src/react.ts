"use client";

import { useEffect } from "react";

import { init } from "./index.js";
import type { InitOptions } from "./index.js";

type ObservaProps = InitOptions;

let initialized = false;

export function Observa(props: ObservaProps) {
  useEffect(() => {
    if (!initialized && props.apiKey) {
      init(props);
      initialized = true;
    }
  }, [props.apiKey]);

  return null;
}
