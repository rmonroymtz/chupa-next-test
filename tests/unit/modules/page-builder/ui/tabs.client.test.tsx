// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs, type TabsProps } from '@/modules/page-builder/ui/tabs.client';

afterEach(cleanup);

function renderTabs(props: Partial<TabsProps> = {}) {
  const panels = props.panels ?? ['Panel A', 'Panel B', 'Panel C'];
  const element = (overrides: Partial<TabsProps> = {}) => (
    <Tabs
      headers={['A', 'B', 'C']}
      panels={panels}
      defaultIndex={0}
      alignment="left"
      className=""
      style={{}}
      contentStyle={{}}
      {...props}
      {...overrides}
    />
  );
  const result = render(element());
  return {
    ...result,
    rerenderWith: (overrides: Partial<TabsProps>) => result.rerender(element(overrides)),
  };
}

const tabs = () => screen.getAllByRole('tab');
const selected = () => tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true');
const focusable = () => tabs().filter((tab) => tab.tabIndex === 0);

function expectActive(index: number) {
  expect(selected()).toEqual([tabs()[index]]);
  expect(focusable()).toEqual([tabs()[index]]);
  const panels = screen.getAllByRole('tabpanel', { hidden: true });
  expect(panels.filter((panel) => !panel.hidden)).toEqual([panels[index]]);
}

describe('Tabs', () => {
  it('renders nothing without panels', () => {
    const { container } = renderTabs({ panels: [] });
    expect(container.innerHTML).toBe('');
  });

  it('starts on the admin default tab', () => {
    renderTabs({ defaultIndex: 2 });
    expectActive(2);
  });

  it.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['too large', 7],
    ['fractional', 1.5],
  ])('clamps a %s default index so exactly one tab is selected and focusable', (_, index) => {
    renderTabs({ defaultIndex: index });
    expect(selected()).toHaveLength(1);
    expect(focusable()).toHaveLength(1);
  });

  it('clamps the active tab when panels shrink', () => {
    const { rerenderWith } = renderTabs({ defaultIndex: 2 });
    rerenderWith({ panels: ['Panel A'], headers: ['A'] });
    expectActive(0);
  });

  it('arrow keys move with wraparound; Home and End jump; focus follows', () => {
    renderTabs();
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowLeft' });
    expectActive(2);
    expect(document.activeElement).toBe(tabs()[2]);
    fireEvent.keyDown(tabs()[2]!, { key: 'ArrowRight' });
    expectActive(0);
    fireEvent.keyDown(tabs()[0]!, { key: 'End' });
    expectActive(2);
    fireEvent.keyDown(tabs()[2]!, { key: 'Home' });
    expectActive(0);
    expect(document.activeElement).toBe(tabs()[0]);
    fireEvent.keyDown(tabs()[0]!, { key: 'a' });
    expectActive(0);
  });

  it('click selects a tab and links tab and panel', () => {
    renderTabs();
    fireEvent.click(tabs()[1]!);
    expectActive(1);
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[1]!.id);
    expect(tabs()[1]!.getAttribute('aria-controls')).toBe(panel.id);
  });
});
