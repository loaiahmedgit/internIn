import { SiZoom, SiGoogledrive, SiJira, SiLinear, SiTrello, SiNotion, SiAsana, SiStripe, SiCalendly, SiLoom } from "@icons-pack/react-simple-icons";

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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/google-calendar.svg" alt="" aria-hidden="true" className="size-5" />;
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
export function StripeIcon() {
  return <SiStripe color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function CalendlyIcon() {
  return <SiCalendly color="default" size={ICON_SIZE} aria-hidden="true" />;
}
export function LoomIcon() {
  return <SiLoom color="default" size={ICON_SIZE} aria-hidden="true" />;
}

// Official brand SVGs served as static assets — plain <img>, not next/image
// (next/image's optimizer is for photos, not vector marks like these).
export function TeamsIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/teams.svg" alt="" aria-hidden="true" className="size-5" />;
}

export function SlackIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/slack.svg" alt="" aria-hidden="true" className="size-5" />;
}

export function OutlookIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/outlook.svg" alt="" aria-hidden="true" className="size-5" />;
}

export function DropboxIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/dropbox.webp" alt="" aria-hidden="true" className="size-5" />;
}
