'use client';

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import styles from './page-builder.module.css';

export interface TabsProps {
  readonly headers: readonly string[];
  /** Server-rendered tab panels, one per header. */
  readonly panels: readonly ReactNode[];
  readonly defaultIndex: number;
  readonly alignment: 'left' | 'center' | 'right';
  readonly className: string;
  readonly style: CSSProperties;
  readonly contentStyle: CSSProperties;
  readonly styleId?: string | undefined;
}

/**
 * Page Builder tabs following the WAI-ARIA tabs pattern: arrow keys,
 * Home and End move between tabs (automatic activation) with a roving
 * tabindex. Without JavaScript the admin's default tab shows.
 */
export function Tabs({
  headers,
  panels,
  defaultIndex,
  alignment,
  className,
  style,
  contentStyle,
  styleId,
}: TabsProps) {
  const id = useId();
  const [active, setActive] = useState(defaultIndex);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = panels.length;
  if (count === 0) return null;

  const select = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % count
        : event.key === 'ArrowLeft'
          ? (index - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    select(target);
  };

  const alignmentClass =
    alignment === 'center'
      ? styles.tabListCenter
      : alignment === 'right'
        ? styles.tabListRight
        : '';

  return (
    <div className={`${styles.tabs} ${className}`} style={style} data-pb-style={styleId}>
      <div role="tablist" className={`${styles.tabList} ${alignmentClass}`}>
        {panels.map((_, index) => (
          <button
            key={index}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {headers[index] || `Pestaña ${index + 1}`}
          </button>
        ))}
      </div>
      <div className={styles.tabPanels} style={contentStyle}>
        {panels.map((panel, index) => (
          <div
            key={index}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            tabIndex={0}
            hidden={index !== active}
            className={styles.tabPanel}
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
