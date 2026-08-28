import { SiZoom, SiGooglecalendar, SiGoogledrive, SiJira, SiLinear, SiTrello, SiNotion, SiAsana } from "@icons-pack/react-simple-icons";

/**
 * Real official marks via simple-icons wherever the brand permits redistribution
 * (Zoom, Google, Jira, Linear, Trello, Notion, Asana are all in the open
 * simple-icons set — the standard, broadly-accepted way apps show "works with X").
 *
 * Slack and every Microsoft product icon (Teams, Outlook) were pulled from
 * simple-icons after trademark takedown requests from those companies — they
 * are not available to redistribute here. Below are restrained, brand-colored
 * approximations for exactly those three, not literal reproductions.
 */

const ICON_SIZE = 20;

export function ZoomIcon() {
  return <SiZoom color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function GoogleCalendarIcon() {
  return <SiGooglecalendar color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function GoogleDriveIcon() {
  return <SiGoogledrive color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function JiraIcon() {
  return <SiJira color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function LinearIcon() {
  return <SiLinear color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function TrelloIcon() {
  return <SiTrello color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function NotionIcon() {
  return <SiNotion color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function AsanaIcon() {
  return <SiAsana color="default" size={ICON_SIZE} aria-hidden="true" />;
}

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

export function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#0A2767" />
      <rect x="12" y="5" width="8" height="14" rx="1" fill="#0364B8" />
      <rect x="12" y="5" width="8" height="4.5" fill="#28A8EA" />
      <rect x="12" y="14.5" width="8" height="4.5" fill="#0F6CBD" />
      <rect x="4" y="7" width="9" height="10" rx="1.5" fill="#fff" />
      <ellipse cx="8.5" cy="12" rx="2.6" ry="3" fill="#0364B8" />
    </svg>
  );
}
