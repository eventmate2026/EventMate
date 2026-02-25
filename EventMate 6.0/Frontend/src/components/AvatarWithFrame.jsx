import { useEffect, useMemo, useState } from "react";
import { normalizeAvatarFrame } from "../constants/profileCustomization";

const FRAME_CLASS_MAP = {
  NONE: "avatar-frame-none",
  AURORA: "avatar-frame-aurora",
  NEON: "avatar-frame-neon",
  COMET: "avatar-frame-comet",
  SOLAR: "avatar-frame-solar",
  INFERNO_RELIC: "avatar-frame-inferno-relic",
  OBSIDIAN_FANG: "avatar-frame-obsidian-fang",
  EMBER_SIGIL: "avatar-frame-ember-sigil",
  SERAPHIC_WING: "avatar-frame-seraphic-wing",
  PHOENIX_WING: "avatar-frame-phoenix-wing",
  FROST_WING: "avatar-frame-frost-wing",
  SHADOW_WING: "avatar-frame-shadow-wing",
  EMERALD_WING: "avatar-frame-emerald-wing",
  STORM_WING: "avatar-frame-storm-wing",
};

export default function AvatarWithFrame({
  src = "",
  alt = "Avatar",
  frame = "NONE",
  className = "",
  coreClassName = "",
  imageClassName = "",
  fallback = null,
  onError = null,
}) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [src]);

  const normalizedFrame = useMemo(() => normalizeAvatarFrame(frame), [frame]);
  const frameClass = FRAME_CLASS_MAP[normalizedFrame] || FRAME_CLASS_MAP.NONE;
  const showImage = Boolean(src) && !imageLoadFailed;

  return (
    <div className={`avatar-frame-shell ${frameClass} ${className}`.trim()}>
      <div className={`avatar-frame-core ${coreClassName}`.trim()}>
        {showImage ? (
          <img
            src={src}
            alt={alt}
            className={`h-full w-full object-cover ${imageClassName}`.trim()}
            onError={(event) => {
              setImageLoadFailed(true);
              if (typeof onError === "function") onError(event);
            }}
          />
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
