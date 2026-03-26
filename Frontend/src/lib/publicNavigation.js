export const PUBLIC_SECTION_IDS = {
  home: "",
  events: "events",
  contact: "contact",
};

export const getPublicNavOffset = () => {
  if (typeof document === "undefined") return 88;

  const nav =
    document.querySelector('[data-public-nav="true"]') ||
    document.querySelector("nav");
  const navHeight = nav?.getBoundingClientRect?.().height || 72;

  return Math.max(64, Math.ceil(navHeight + 16));
};

export const scrollToPublicSection = (sectionId, options = {}) => {
  if (typeof window === "undefined") return false;

  const behavior = options.behavior || "smooth";
  if (!sectionId) {
    window.scrollTo({ top: 0, behavior });
    return true;
  }

  const target = document.getElementById(sectionId);
  if (!target) return false;

  const top = Math.max(
    0,
    window.scrollY + target.getBoundingClientRect().top - getPublicNavOffset()
  );

  window.scrollTo({ top, behavior });
  return true;
};
