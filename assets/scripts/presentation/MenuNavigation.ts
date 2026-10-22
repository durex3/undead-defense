export type CatalogRoute =
  | "weapons"
  | "achievements"
  | "detail"
  | "purchase"
  | "paths"
  | "manual"
  | "manual-confirm"
  | "recovery"
  | "restore-confirm"
  | "repair-entry"
  | "repair-confirm";
interface FocusLabel {
  label: { string: string };
  title: string;
  width: number;
}
/** Session-only menu state. Moving focus never reconstructs a screen or its transaction callbacks. */
export class MenuNavigation {
  route: CatalogRoute | null = null;
  focus = 0;
  actions: (() => void)[] = [];
  labels: FocusLabel[] = [];
  private backAction: (() => void) | null = null;
  open(route: CatalogRoute, back: () => void, initialFocus?: number) {
    if (this.route !== route) this.focus = 0;
    if (initialFocus !== undefined) this.focus = initialFocus;
    this.route = route;
    this.backAction = back;
  }
  clearButtons() {
    this.actions = [];
    this.labels = [];
  }
  close() {
    this.route = null;
    this.backAction = null;
    this.focus = 0;
    this.clearButtons();
  }
  back() {
    this.backAction?.();
  }
  /** Capture a parent screen and its focus before opening a child. */
  returnTo(render: () => void) {
    const focus = this.focus;
    return () => {
      render();
      this.focus = Math.max(0, Math.min(focus, this.actions.length - 1));
      this.refresh();
    };
  }
  move(delta: number) {
    if (!this.actions.length) {
      this.focus = 0;
      return;
    }
    this.focus =
      (this.focus + delta + this.actions.length) % this.actions.length;
    this.refresh();
  }
  activate() {
    this.actions[this.focus]?.();
  }
  refresh() {
    this.labels.forEach((b, i) => {
      b.label.string =
        (i === this.focus && b.width >= 100 ? "▸ " : "") + b.title;
    });
  }
}
