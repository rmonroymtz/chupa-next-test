import type { ReactNode, SVGProps } from 'react';

/*
 * Small decorative icons ported from the legacy theme as inline SVG so they
 * inherit `currentColor` and cost no request. Always `aria-hidden`: the
 * control that holds them carries the accessible name.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Svg({ viewBox, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Legacy `IconUser`. */
export function UserIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 50.697 50.697" fill="currentColor" {...props}>
      <path d="M43.273,7.424A25.349,25.349,0,0,0,7.424,43.273,25.349,25.349,0,0,0,43.273,7.424ZM12.708,43.8a12.836,12.836,0,0,1,25.281,0,22.33,22.33,0,0,1-25.281,0Zm4.581-21.637a8.06,8.06,0,1,1,8.06,8.06A8.069,8.069,0,0,1,17.289,22.167ZM40.562,41.744a15.831,15.831,0,0,0-9.2-10.332,11.03,11.03,0,1,0-12.021,0,15.829,15.829,0,0,0-9.2,10.332,22.378,22.378,0,1,1,30.427,0Z" />
    </Svg>
  );
}

/** Legacy search bar `SearchIcon` (drop shadow omitted). */
export function SearchIcon(props: IconProps) {
  return (
    <Svg viewBox="4 3 23 22" fill="currentColor" {...props}>
      <path d="M25.742 22.5779L19.7704 16.8922C20.9606 15.5118 21.6182 13.7473 21.6234 11.92C21.5613 9.76282 20.6517 7.7183 19.0939 6.23432C17.5361 4.75033 15.4571 3.94785 13.3122 4.00266C11.1671 3.9476 9.08785 4.74997 7.52984 6.23398C5.97182 7.718 5.06211 9.76266 5 11.92C5.06283 14.0769 5.97285 16.1209 7.53078 17.6043C9.08872 19.0877 11.1676 19.8897 13.3122 19.8346C15.1991 19.8415 17.0355 19.2213 18.5359 18.0703L24.5075 23.756C24.6758 23.9129 24.8967 24 25.1261 24C25.3555 24 25.5764 23.9129 25.7447 23.756C25.8254 23.6808 25.8898 23.5896 25.9338 23.4881C25.9777 23.3866 26.0003 23.2771 26 23.1664C25.9997 23.0557 25.9767 22.9462 25.9323 22.845C25.8878 22.7437 25.823 22.6528 25.742 22.5779ZM13.3122 18.1689C11.6192 18.2124 9.97814 17.5792 8.7483 16.4082C7.51845 15.2371 6.80005 13.6236 6.75041 11.921C6.79981 10.2181 7.51811 8.60437 8.74798 7.43314C9.97786 6.2619 11.6191 5.62864 13.3122 5.67204C15.0051 5.62864 16.6462 6.26177 17.8761 7.43281C19.1059 8.60385 19.8243 10.2174 19.8739 11.92C19.8245 13.6229 19.1062 15.2366 17.8764 16.4079C16.6465 17.5791 15.0053 18.2124 13.3122 18.1689Z" />
    </Svg>
  );
}

/** Venia `navTrigger` icon (feather `Menu`). */
export function MenuIcon(props: IconProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Svg>
  );
}

/** Feather `ChevronDown`, as in the legacy megamenu item. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

/** Legacy footer `SocialButton` Facebook glyph. */
export function FacebookIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 49.932 49.932" fill="currentColor" {...props}>
      <path d="M49.932,24.966A24.966,24.966,0,1,0,24.966,49.932c.146,0,.293,0,.439-.01V30.5H20.041V24.244H25.4v-4.6c0-5.335,3.257-8.241,8.016-8.241a43.571,43.571,0,0,1,4.808.244v5.578H34.952c-2.584,0-3.092,1.229-3.092,3.033v3.979h6.193l-.809,6.251H31.861V48.967A24.974,24.974,0,0,0,49.932,24.966Z" />
    </Svg>
  );
}

/** Legacy footer `SocialButton` Instagram glyph. */
export function InstagramIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 49.599 49.599" fill="currentColor" {...props}>
      <path
        d="M33,32.552a6.177,6.177,0,1,1-6.273,6.176A6.225,6.225,0,0,1,33,32.552Zm0-2.47a8.647,8.647,0,1,0,8.783,8.646A8.715,8.715,0,0,0,33,30.082ZM42.053,28a2.471,2.471,0,1,0,2.509,2.47A2.471,2.471,0,0,0,42.053,28ZM26.869,25.315H39.13a7.167,7.167,0,0,1,7.222,7.109V45.031a7.166,7.166,0,0,1-7.222,7.109H26.869a7.166,7.166,0,0,1-7.222-7.109V32.425A7.167,7.167,0,0,1,26.869,25.315Zm-1.156-2.459a8.519,8.519,0,0,0-8.585,8.451V46.148A8.518,8.518,0,0,0,25.712,54.6H40.286a8.518,8.518,0,0,0,8.585-8.451V31.308a8.519,8.519,0,0,0-8.585-8.451ZM33,13.929a24.8,24.8,0,1,1-24.8,24.8A24.8,24.8,0,0,1,33,13.929Z"
        transform="translate(-8.2 -13.929)"
      />
    </Svg>
  );
}
