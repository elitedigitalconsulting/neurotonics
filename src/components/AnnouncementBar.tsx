'use client';

import Link from 'next/link';
import siteContent from '@/content/site.json';

export default function AnnouncementBar() {
  const { announcement } = siteContent;

  if (!announcement) return null;

  return (
    <div className="bg-brand-navy text-white text-center py-2 px-4 text-xs sm:text-sm tracking-wide">
      <span>{announcement.text}</span>
      {announcement.link && (
        <>
          {' '}
          <Link href={announcement.link} className="underline font-semibold hover:text-brand-warm transition-colors">
            {announcement.linkText}
          </Link>
        </>
      )}
    </div>
  );
}