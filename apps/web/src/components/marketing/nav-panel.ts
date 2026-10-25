type Edges = { left: number; right: number }

const GUTTER = 8

/** Panel centre and the bounds it must stay within, in px from the menu's left edge. */
export function panelAnchor({ root, bar, trigger }: { root: Edges; bar: Edges; trigger: Edges }) {
  return {
    x: (trigger.left + trigger.right) / 2 - root.left,
    min: bar.left - root.left + GUTTER,
    max: bar.right - root.left - GUTTER,
  }
}
