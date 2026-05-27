import { useCallback } from 'react';
import type { MemberTabLink } from '../lib/memberTabs';
import { openMemberTabInNewWindow, parseMemberTabFromHref } from '../lib/memberTabs';
import { copyTextToClipboard } from '../lib/copyToClipboard';
import { isLessonBodyHtml, LESSON_COPY_BLOCK_CLASS, sanitizeLessonBodyHtml } from '../lib/lessonBodyHtml';

type Props = {
  bodyText: string;
  onNavigateMemberTab?: (tab: MemberTabLink) => void;
};

export function LessonBodyContent({ bodyText, onNavigateMemberTab }: Props) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const copyBlock = (e.target as HTMLElement).closest(`.${LESSON_COPY_BLOCK_CLASS}`);
      if (copyBlock) {
        const text = copyBlock.getAttribute('data-copy') || '';
        if (text) {
          e.preventDefault();
          void copyTextToClipboard(text).then((ok) => {
            const copyBtn = copyBlock.querySelector('[data-copy-btn]') as HTMLButtonElement | null;
            if (copyBtn) {
              const prev = copyBtn.textContent;
              copyBtn.textContent = ok ? 'Copiado!' : 'Erro';
              window.setTimeout(() => {
                copyBtn.textContent = prev || 'Copiar';
              }, 2000);
            }
          });
        }
        return;
      }

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const tab =
        (anchor.getAttribute('data-member-tab') as MemberTabLink | null) || parseMemberTabFromHref(href);
      const newTab = anchor.getAttribute('target') === '_blank';

      if (tab && onNavigateMemberTab) {
        e.preventDefault();
        if (newTab) {
          openMemberTabInNewWindow(tab);
        } else {
          onNavigateMemberTab(tab);
        }
        return;
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
