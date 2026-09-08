"use client";

import * as React from "react";

interface LiquidMetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function LiquidMetalButton({
  children = "Start Scanning",
  className = "",
  ...props
}: LiquidMetalButtonProps) {
  return (
    <button
      className={`kisanx-liquid-button group relative isolate inline-flex h-12 items-center justify-center overflow-hidden rounded-full px-6 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 active:translate-y-0 ${className}`}
      {...props}
    >
      <span className="absolute inset-0 bg-[#d96d22]" />
      <span className="absolute -inset-8 bg-[radial-gradient(circle_at_30%_20%,rgba(255,196,122,0.7),transparent_25%),radial-gradient(circle_at_80%_80%,rgba(35,84,44,0.75),transparent_35%)] opacity-90 transition duration-500 group-hover:scale-110" />
      <span className="absolute inset-[1px] rounded-full border border-white/15" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
export default LiquidMetalButton;
