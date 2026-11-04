"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

/** Property photos: one large image with a thumbnail strip. Arrow keys move between photos. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <figure
      className="gallery"
      tabIndex={images.length > 1 ? 0 : undefined}
      aria-roledescription="carousel"
      aria-label={`${title} — photos`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="gallery-main">
        <img src={images[i]} alt={`${title} — photo ${i + 1} of ${images.length}`} />
        {images.length > 1 && (
          <>
            <button type="button" className="gallery-nav is-prev" onClick={() => go(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className="gallery-nav is-next" onClick={() => go(1)} aria-label="Next photo">
              ›
            </button>
            <span className="gallery-count num">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ol className="gallery-thumbs">
          {images.map((src, j) => (
            <li key={j}>
              <button type="button" className={cx(j === i && "is-on")} onClick={() => setI(j)} aria-label={`Show photo ${j + 1}`} aria-current={j === i || undefined}>
                <img src={src} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
