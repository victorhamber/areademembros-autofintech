import { useCallback } from 'react';
import type { MemberTabLink } from '../lib/memberTabs';
import { parseMemberTabFromHref } from '../lib/memberTabs';
import { isLessonBodyHtml, plainTextToLessonHtml, sanitizeLessonBodyHtml } from '../lib/lessonBodyHtml';

type Props = {
  bodyText: string;
  onNavigateMemberTab?: (tab: MemberTabLink) => void;
};

export function LessonBodyContent({ bodyText, onNavigateMemberTab }: Props) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const tab =
        (anchor.getAttribute('data-member-tab') as MemberTabLink | null) || parseMemberTabFromHref(href);
      const newTab = anchor.getAttribute('target') === '_blank';

      if (tab && !newTab && onNavigateMemberTab) {
        e.preventDefault();
        onNavigateMemberTab(tab);
        return;
      }

      if (tab && newTab && href.startsWith('#member-tab:')) {
        e.preventDefault();
        const url = `${window.location.origin}/?tab=${encodeURIComponent(tab)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [onNavigateMemberTab]
  );

  if (!bodyText.trim()) return null;

  if (isLessonBodyHtml(bodyText)) {
    const html = sanitizeLessonBodyHtml(bodyText);
    return (
      <div
        className="lesson-info-body lesson-info-body--rich"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
    );
  }

  return (
    <div className="lesson-info-body">
      {bodyText.split('\n').map((line, idx) => (
        <p key={idx}>{line || '\u00A0'}</p>
      ))}
    </div>
  );
}
