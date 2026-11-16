import type { ReactNode, SVGProps } from 'react';

function Svg({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}
type P = SVGProps<SVGSVGElement>;

export const IconHome = (p: P) => <Svg {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6.5 10v9h11v-9" /></Svg>;
export const IconBook = (p: P) => <Svg {...p}><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h9.5" /></Svg>;
export const IconChart = (p: P) => <Svg {...p}><path d="M5 20V11" /><path d="M12 20V4" /><path d="M19 20v-6" /></Svg>;
export const IconGear = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></Svg>;
export const IconStop = (p: P) => <Svg {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" /></Svg>;
export const IconReplay = (p: P) => <Svg {...p}><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" /><path d="M4.5 4.5v4h4" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M9.5 5.5 16 12l-6.5 6.5" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5 10 17.5 19 7" /></Svg>;
export const IconFlame = (p: P) => <Svg {...p}><path d="M12 3.5c.5 3.5 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-1.8.8-3 1.8-4 .2 1.5 1 2.2 1.7 2.5C10.5 8.5 10.5 6 12 3.5z" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 13v7" /></Svg>;
export const IconBell = (p: P) => <Svg {...p}><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z" /><path d="M10.5 20.5h3" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconUsers = (p: P) => <Svg {...p}><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.7.6 2.7 2 3 4.2" /></Svg>;
export const IconTarget = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></Svg>;
export const IconNote = (p: P) => <Svg {...p}><path d="M9.5 17.5V6l9-2v11.5" /><ellipse cx="7" cy="17.5" rx="2.5" ry="2" /><ellipse cx="16" cy="15.5" rx="2.5" ry="2" /></Svg>;
