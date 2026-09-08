"use client";

import * as React from "react";

interface RandomLetterSwapProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
}

export function RandomLetterSwap({
  text,
  className = "",
  ...props
}: RandomLetterSwapProps) {
  const [displayText, setDisplayText] = React.useState(text);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (!hovered) {
      const timeout = setTimeout(() => setDisplayText(text), 0);
      return () => clearTimeout(timeout);
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let iteration = 0;

    const timer = window.setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) return char;
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join(""),
      );

      iteration += 0.5;

      if (iteration >= text.length) {
        window.clearInterval(timer);
        setDisplayText(text);
      }
    }, 32);

    return () => window.clearInterval(timer);
  }, [hovered, text]);

  return (
    <button
      type="button"
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {displayText}
    </button>
  );
}
export default RandomLetterSwap;
