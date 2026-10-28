import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/useProjectStore';
import { ShareModal } from './ShareModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { TouchToggle } from './TouchToggle';
import { useLocalizedHref, useCurrentLocale } from '../../i18n/useLocalizedNavigate';
import { blogUrlFor } from '../../i18n/path';
import { trackVisitGitHub } from '../../utils/analytics';
import { PINSLIM_REPO_URL } from '../../lib/pinslimLinks';
import { PinslimLogo } from './PinslimLogo';
import { applyStripLayout, STRIP_BELOW_CLASS } from './headerStripFit';
import './LanguageSwitcher.css';


interface AppHeaderProps {
  /** Editor variant: a File/Edit menu bar rendered next to the logo. When
   *  set, the marketing nav links (Home / Docs / Pricing / …) are hidden —
   *  inside the editor they are noise that costs exactly the width the
   *  toolbar is starved of on small screens; the logo still links home.
   *  Same mechanism the Tauri desktop build uses (VITE_DESKTOP). */
  editorMenu?: React.ReactNode;
  /** Editor variant: the unified toolbar strip rendered in the header's
   *  middle — the space the marketing nav used to occupy. One row instead
   *  of header + toolbar stacked; the strip wraps internally when narrow
   *  and the header grows to fit (height: auto on the modifier class). */
  editorToolbar?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ editorMenu, editorToolbar }) => {
  const location = useLocation();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { t } = useTranslation();
  const localize = useLocalizedHref();
  const currentLocale = useCurrentLocale();

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Editor variant: where does the toolbar strip go — on the brand row or
  // on its own bar below, labelled or icon-only? Measured, not guessed —
  // see headerStripFit.ts, which sets `app-header--strip-below` on the
  // header and `unified-toolbar--compact` on the strip. Re-measured
  // whenever the strip host, the brand block or a strip zone resizes
  // (window, docked chat, board controls mounting). The first measure runs
  // before paint; later ones are deferred a frame so toggling the classes
  // never re-enters ResizeObserver delivery.
  const headerRef = useRef<HTMLElement>(null);
  const hasStrip = !!editorToolbar;
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || !hasStrip) return;
    const apply = () => {
      applyStripLayout(header);
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };
    const ro = new ResizeObserver(schedule);
    const content = header.querySelector<HTMLElement>(':scope > .header-content');
    const left = content?.querySelector<HTMLElement>(':scope > .header-left');
    const host = content?.querySelector<HTMLElement>(':scope > .header-editor-toolbar');
    const strip = host?.firstElementChild;
    for (const el of [left, host, ...(strip ? Array.from(strip.children) : [])]) {
      if (el) ro.observe(el);
    }
    // Zones mount their controls later (the canvas side is a portal) —
    // pick up children that appear after mount.
    const mo = strip
      ? new MutationObserver(() => {
          for (const z of Array.from(strip.children)) ro.observe(z);
          schedule();
        })
      : null;
    if (strip && mo) mo.observe(strip, { childList: true });
    return () => {
      ro.disconnect();
      mo?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      header.classList.remove(STRIP_BELOW_CLASS);
    };
  }, [hasStrip]);

  // Tauri desktop: skip the header entirely. The marketing nav was
  // already hidden, but the strip itself was still painting an empty
  // black bar over the editor. Brand/auto-save/share/auth-slot all
  // live elsewhere in desktop: title bar shows "Velxio Desktop", the
  // native menubar has File/Edit/View/Help, auto-save is a Pro cloud
  // feature (desktop saves to .vlx), share generates a velxio.dev URL
  // that doesn't apply to a desktop session, and the license flow
  // owns its own DesktopWelcomePage.
  if (import.meta.env.VITE_DESKTOP) {
    return null;
  }

  // Compare with the trailing slash ignored: /editor is served (and
  // canonicalized) as /editor/ since it is prerendered, while client-side
  // navigation still lands on /editor.
  const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
  const isActive = (path: string) =>
    samePath(location.pathname, localize(path)) ? ' header-nav-link-active' : '';

  return (
    <header ref={headerRef} className={"app-header" + (editorToolbar ? ' app-header--with-toolbar' : '')}>
      <div className="header-content">
        <div className="header-left">
          {/* Brand */}
          <div className="header-brand">
            <Link to={localize('/')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <PinslimLogo size={22} showText={true} />
            </Link>
          </div>

          {/* Main nav links (web only). The Tauri desktop build hides
              this nav and surfaces the equivalent actions via the
              native menubar (see pro/desktop/src-tauri/src/menu.rs in
              velxio-prod). VITE_DESKTOP is the env flag the Tauri
              build sets — main.tsx already uses it to gate the @pro
              overlay, same pattern here. */}
          {editorMenu}
          {!import.meta.env.VITE_DESKTOP && !editorMenu && (
          <nav className={'header-nav-links' + (menuOpen ? ' header-nav-open' : '')}>
            {/* Marketing routes live in the pro overlay; the OSS build has
                no /docs, /about, /pricing… to link to. Editor + Examples
                (the app's own pages) and the GitHub link stays everywhere. */}
            {import.meta.env.VITE_PRO_BUILD && (
              <>
                <Link to={localize('/')} className={'header-nav-link' + isActive('/')}>
                  {t('header.nav.home')}
                </Link>
                {/* Full-page link: the docs portal is a static Starlight
                    site served by nginx at /docs/, not a SPA route. */}
                <a href="/docs/" className="header-nav-link">
                  {t('header.nav.documentation')}
                </a>
              </>
            )}
            <Link to={localize('/examples')} className={'header-nav-link' + isActive('/examples')}>
              {t('header.nav.examples')}
            </Link>
            <Link to={localize('/editor/')} className={'header-nav-link' + isActive('/editor')}>
              {t('header.nav.editor')}
            </Link>
            {import.meta.env.VITE_PRO_BUILD && (
              <>
                <Link to={localize('/about')} className={'header-nav-link' + isActive('/about')}>
                  {t('header.nav.about')}
                </Link>
                <Link to={localize('/pricing')} className={'header-nav-link' + isActive('/pricing')}>
                  {t('header.nav.pricing')}
                </Link>
                <Link to={localize('/classroom')} className={'header-nav-link' + isActive('/classroom')}>
                  {t('header.nav.classroom', 'For schools')}
                </Link>
                <Link
                  to={localize('/account/desktop-install')}
                  className={'header-nav-link' + isActive('/account/desktop-install')}
                >
                  {t('header.nav.download')}
                </Link>
                <a
                  href={blogUrlFor(currentLocale)}
                  className="header-nav-link"
                  rel="noopener"
                >
                  {t('header.nav.blog')}
                </a>
              </>
            )}
            <a
              href={PINSLIM_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="header-nav-link"
              onClick={trackVisitGitHub}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
              </svg>
              {t('header.nav.github')}
            </a>
          </nav>
          )}
        </div>

        {/* Editor toolbar strip — fills the middle the nav vacated. */}
        {editorToolbar && <div className="header-editor-toolbar">{editorToolbar}</div>}

        {/* Right: language + share + auth + mobile hamburger. In the
            desktop-editor variant this block does not render at all: the
            language switcher and the account button move to the corner box
            below (bottom-left), Share lives in File > Share/Embed, and the
            autosave dot rides next to the menus — every pixel of the row
            goes to the toolbar, which is what lets 1440px-with-chat keep
            the single-row layout. */}
        {!editorToolbar && (
        <div className="header-right">
          {/* Hidden on the marketing pages, which pin themselves to dark
              (pro DarkSurface) — offering a switch that visibly does nothing
              would be worse than not offering one. */}
          <ThemeToggle className="header-theme-toggle" />
          <TouchToggle className="header-theme-toggle" />
          <LanguageSwitcher />

          {/* Share button — visible when a project is loaded */}
          {currentProject && samePath(location.pathname, localize('/editor')) && (
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                background: 'transparent',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: '#ccc',
                fontSize: 13,
              }}
              title={t('header.shareProject', 'Share project')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          )}

          {/* Auth UI lives in the pro overlay — sign-in/sign-up buttons
              when anonymous, user dropdown when logged in. The overlay's
              mountPro() portals its HeaderAuth component into this slot
              via mountIntoSlot('header-auth'). In OSS without the
              overlay this slot stays empty, which is correct because the
              OSS image has no auth backend either. */}
          <div data-velxio-slot="header-auth" style={{ display: 'contents' }} />

          {/* Mobile hamburger — useless in desktop where the nav it
              would expand is itself hidden, and in the editor variant,
              where there is no nav to expand at all. */}
          {!import.meta.env.VITE_DESKTOP && !editorMenu && (
            <button
              className="header-hamburger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t('ui.toggleMenu', 'Toggle menu')}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>
        )}
      </div>

      {/* The account + language block lives in the file-explorer footer now
          (EditorPage renders it) — fused so a long file tree never scrolls
          underneath a floating box. */}

      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
    </header>
  );
};
