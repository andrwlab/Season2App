import React, { useState } from "react";

type TeamLogoProps = {
  logoFile?: string;
  name?: string;
  className?: string;
};

const TeamLogo: React.FC<TeamLogoProps> = ({ logoFile, name, className }) => {
  const [error, setError] = useState(false);
  const base = import.meta.env.BASE_URL || "/";
  const src = logoFile ? `${base}logos/${logoFile}` : "";
  const safeName = (name || "").trim() || "??";

  if (!logoFile || error) {
    return (
      <div
        className={`avatar-fallback flex items-center justify-center rounded-full ${
          className || "h-12 w-12 text-sm"
        }`}
        aria-label={safeName}
      >
        {safeName.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={safeName}
      className={className || "h-12 w-12 rounded-full object-contain"}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={() => setError(true)}
    />
  );
};

export default TeamLogo;
