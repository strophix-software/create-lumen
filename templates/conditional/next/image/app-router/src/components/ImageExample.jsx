import React from "react";
import Image from "next/image";

export function ImageExample({
  src = "/next.svg",
  alt = "Next.js logo",
  width = 180,
  height = 37,
  priority = false,
  className = "",
  caption = "Optimized with next/image",
}) {
  return (
    <figure className={`inline-flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/20 ${className}`}>
      <div className="relative flex items-center justify-center p-2">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="dark:invert transition-transform hover:scale-105"
        />
      </div>
      {caption && (
        <figcaption className="text-xs text-gray-500 dark:text-gray-400 text-center font-mono">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export default ImageExample;
