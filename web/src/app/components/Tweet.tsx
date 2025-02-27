'use client';

import { useEffect, useRef } from 'react';

export default function Tweet({ id }: { id: string }) {
  const tweetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // @ts-ignore
    if (window.twttr) {
      // @ts-ignore
      window.twttr.widgets.load(tweetRef.current);
    }
  }, [id]);

  return (
    <div ref={tweetRef}>
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={`https://twitter.com/x/status/${id}`}></a>
      </blockquote>
    </div>
  );
} 