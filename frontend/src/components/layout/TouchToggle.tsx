import { useTranslation } from 'react-i18next';
import { useTouchMode } from '../../utils/useTouchDevice';
import { setTouchMode } from '../../lib/touchMode';

/**
 * Touch-mode switch, next to the light/dark toggle. Two-state like that one;
 * unlike the theme toggle it shows the CURRENT state (pressed = on), because
 * a hand icon that means "switch to touch" while touch is already on reads
 * backwards.
 */
export const TouchToggle = ({ className = '' }: { className?: string }) => {
  const { t } = useTranslation();
  const on = useTouchMode();
  const label = on
    ? t('editor.toolbar.touchOff', 'Touch mode is on — switch to mouse mode')
    : t('editor.toolbar.touchOn', 'Switch to touch mode');

  return (
    <button
      type="button"
      className={`tb-btn tb-btn-touch${on ? ' is-on' : ''} ${className}`.trim()}
      onClick={() => setTouchMode(!on)}
      title={label}
      aria-label={label}
      aria-pressed={on}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* pointing hand */}
        <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M12 9.5a1.5 1.5 0 0 1 3 0V11" />
        <path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-3.9-1.9L4.6 16.2a1.6 1.6 0 0 1 2.4-2.1L9 16" />
      </svg>
    </button>
  );
};
