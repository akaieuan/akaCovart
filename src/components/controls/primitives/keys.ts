import type { StudioState } from "@/lib/store";

// Keys that hold a numeric value on the store.
export type NumKey = {
  [K in keyof StudioState]: StudioState[K] extends number ? K : never;
}[keyof StudioState];

// Keys that hold a boolean value on the store.
export type BoolKey = {
  [K in keyof StudioState]: StudioState[K] extends boolean ? K : never;
}[keyof StudioState];

// Keys that hold a string value on the store.
export type StrKey = {
  [K in keyof StudioState]: StudioState[K] extends string ? K : never;
}[keyof StudioState];
