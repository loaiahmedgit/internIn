/**
 * Small inline brand-colored marks for the integrations grid — simplified
 * geometric approximations in the correct brand color, not the official
 * trademarked artwork. Recognizable at a glance without redistributing
 * copyrighted logo files.
 */

export function TeamsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#5059C9" />
      <circle cx="15.5" cy="8.5" r="2.5" fill="#fff" />
      <rect x="13" y="11" width="7" height="7" rx="1.5" fill="#fff" />
      <circle cx="8.5" cy="9" r="3" fill="#fff" fillOpacity="0.9" />
      <rect x="5" y="12" width="7" height="6" rx="1.5" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#E5E7EB" />
      <path
        d="M18.5 12.2c0-.6-.05-1.1-.15-1.65H12v3.1h3.65c-.15.85-.65 1.55-1.4 2.05v1.7h2.25c1.3-1.2 2-3 2-5.2z"
        fill="#4285F4"
      />
      <path
        d="M12 19c1.9 0 3.5-.6 4.65-1.6l-2.25-1.7c-.6.4-1.4.65-2.4.65-1.85 0-3.4-1.2-3.95-2.9H5.7v1.75A7 7 0 0 0 12 19z"
        fill="#34A853"
      />
      <path d="M8.05 13.45a4.2 4.2 0 0 1 0-2.9V8.8H5.7a7 7 0 0 0 0 6.4l2.35-1.75z" fill="#FBBC05" />
      <path
        d="M12 8.65c1.05 0 1.95.35 2.7 1.05l2-1.95C15.5 6.6 13.9 6 12 6a7 7 0 0 0-6.3 3.8l2.35 1.75c.55-1.7 2.1-2.9 3.95-2.9z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function SlackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#E5E7EB" />
      <path d="M9.5 14.5a1.5 1.5 0 1 1-1.5-1.5h1.5v1.5z" fill="#E01E5A" />
      <path d="M10.25 14.5a1.5 1.5 0 1 1 3 0v3.75a1.5 1.5 0 1 1-3 0V14.5z" fill="#E01E5A" />
      <path d="M9.5 9.5a1.5 1.5 0 1 1 1.5-1.5V9.5H9.5z" fill="#36C5F0" />
      <path d="M9.5 10.25a1.5 1.5 0 1 1 0 3H5.75a1.5 1.5 0 1 1 0-3H9.5z" fill="#36C5F0" />
      <path d="M14.5 9.5a1.5 1.5 0 1 1 1.5 1.5h-1.5V9.5z" fill="#2EB67D" />
      <path d="M13.75 9.5a1.5 1.5 0 1 1-3 0V5.75a1.5 1.5 0 1 1 3 0V9.5z" fill="#2EB67D" />
      <path d="M14.5 14.5a1.5 1.5 0 1 1-1.5 1.5v-1.5h1.5z" fill="#ECB22E" />
      <path d="M15.25 14.5a1.5 1.5 0 1 1 0-3h3.75a1.5 1.5 0 1 1 0 3H15.25z" fill="#ECB22E" />
    </svg>
  );
}

export function NotionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#000" />
      <path
        d="M8 7.2c0-.5.4-.9.9-.85l7.4.55c.4.03.7.37.7.77v8.4c0 .5-.42.9-.92.85l-7.4-.6a.8.8 0 0 1-.68-.79V7.2z"
        fill="#fff"
      />
      <path d="M9.6 8.6l5.3.35v6.6l-5.3-.4V8.6z" fill="#000" />
    </svg>
  );
}

export function JiraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#E5E7EB" />
      <path d="M12 5.5 6.2 11.3a1.3 1.3 0 0 0 0 1.85L12 18.9l1.9-1.9-4.15-4.15L14 8.5 12 5.5z" fill="#2684FF" />
      <path d="M17.8 11.3 12 5.5l-1.9 1.9 4.15 4.15L10 15.75l2 3 5.8-5.8a1.3 1.3 0 0 0 0-1.85z" fill="#2684FF" opacity="0.6" />
    </svg>
  );
}
