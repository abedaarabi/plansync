"use client";

export type HeroExperimentVariant = "control" | "value-first";

const HERO_EXPERIMENT_KEY = "marketing_exp_hero_message_v1";
const HERO_VARIANTS: HeroExperimentVariant[] = ["control", "value-first"];

function randomVariant<T extends string>(variants: readonly T[]): T {
  return variants[Math.floor(Math.random() * variants.length)] ?? variants[0];
}

export function getHeroExperimentVariant(): HeroExperimentVariant {
  if (typeof window === "undefined") return "control";
  const existing = window.localStorage.getItem(HERO_EXPERIMENT_KEY) as HeroExperimentVariant | null;
  if (existing && HERO_VARIANTS.includes(existing)) return existing;
  const assigned = randomVariant(HERO_VARIANTS);
  window.localStorage.setItem(HERO_EXPERIMENT_KEY, assigned);
  return assigned;
}
