import React, { useState } from "react";

type TeamLogoProps = {
  logoFile?: string;
  name: string;
  className?: string;
};

const TeamLogo: React.FC<TeamLogoProps> = ({ logoFile, name, className }) => {
  const [error, setError] = useState(false);
  const base = import.meta.env.BASE_URL || "/";
  const src = logoFile ? `${base}logos/${logoFile}` : "";

  if (!logoFile || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gray-200 text-gray-600 ${
          className || "h-12 w-12 text-sm"
        }`}
        aria-label={name}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={className || "h-12 w-12 rounded-full object-contain"}
      onError={() => setError(true)}
    />
  );
};

export default TeamLogo;
