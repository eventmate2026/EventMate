export const AVATAR_FRAME_OPTIONS = [
  { value: "NONE", label: "No Frame", description: "Minimal and clean.", group: "Basic" },
  { value: "AURORA", label: "Aurora Flow", description: "Soft shifting gradients.", group: "Classic Animated" },
  { value: "NEON", label: "Neon Pulse", description: "Electric animated ring.", group: "Classic Animated" },
  { value: "COMET", label: "Comet Orbit", description: "Rotating comet streak.", group: "Classic Animated" },
  { value: "SOLAR", label: "Solar Flare", description: "Warm glowing shimmer.", group: "Classic Animated" },
  {
    value: "INFERNO_RELIC",
    label: "Inferno Relic",
    description: "Crimson relic frame.",
    group: "Relic Frames",
  },
  { value: "OBSIDIAN_FANG", label: "Obsidian Fang", description: "Black-gold edged hunter ring.", group: "Relic Frames" },
  { value: "EMBER_SIGIL", label: "Ember Sigil", description: "Runic ember spiral with sparks.", group: "Relic Frames" },
  { value: "SERAPHIC_WING", label: "Seraphic Wing", description: "Winged halo with celestial crest.", group: "Wing Frames" },
  { value: "PHOENIX_WING", label: "Crimson Sovereign", description: "Red-gold royal ring with feathered wings.", group: "Wing Frames" },
  { value: "STORM_WING", label: "Solar Empress", description: "Fiery gold wings and radiant magenta arc.", group: "Wing Frames" },
  { value: "FROST_WING", label: "Celestial Bloom", description: "Blue floral wreath with heart jewel.", group: "Wing Frames" },
  { value: "SHADOW_WING", label: "Arcane Raven", description: "Dark rune ring crowned with raven spirit.", group: "Wing Frames" },
  { value: "EMERALD_WING", label: "Verdant Aegis", description: "Emerald laurel wings and guardian gem.", group: "Wing Frames" },
];

export const DEFAULT_AVATAR_FRAME = "NONE";

export const isValidAvatarFrame = (value) =>
  AVATAR_FRAME_OPTIONS.some((option) => option.value === value);

export const isAvatarFrameAllowedForRole = (value, role = "") => {
  const normalizedValue = String(value || "").toUpperCase();
  const normalizedRole = String(role || "").toUpperCase();
  const option = AVATAR_FRAME_OPTIONS.find((item) => item.value === normalizedValue);
  if (!option) return false;
  if (!Array.isArray(option.roles) || option.roles.length === 0) return true;
  return option.roles.includes(normalizedRole);
};

export const getAvatarFrameOptionsForRole = (role = "") => {
  const normalizedRole = String(role || "").toUpperCase();
  return AVATAR_FRAME_OPTIONS.filter((option) => {
    if (!Array.isArray(option.roles) || option.roles.length === 0) return true;
    return option.roles.includes(normalizedRole);
  });
};

export const normalizeAvatarFrame = (value) => {
  const normalized = String(value || "").toUpperCase();
  return isValidAvatarFrame(normalized) ? normalized : DEFAULT_AVATAR_FRAME;
};
