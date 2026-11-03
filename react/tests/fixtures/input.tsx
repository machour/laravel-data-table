import { createElement, forwardRef, type InputHTMLAttributes } from "react";

// Consumer-owned shadcn input; only its native input behavior is needed here.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => createElement("input", { ...props, ref }),
);
