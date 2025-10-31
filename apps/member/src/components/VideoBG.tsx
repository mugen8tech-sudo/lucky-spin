'use client';

export default function VideoBG({
  src = '/bg.webm',
  mp4Src,          // opsional fallback
  poster,          // opsional placeholder
  className = '',
}: { src?: string; mp4Src?: string; poster?: string; className?: string }) {
  return (
    <div className={`bg-video ${className}`} aria-hidden>
      <video
        key={src}
        className="bg-video-el"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
      >
        <source src={src} type="video/webm" />
        {mp4Src ? <source src={mp4Src} type="video/mp4" /> : null}
      </video>
      <div className="bg-video-shade" />
    </div>
  );
}
