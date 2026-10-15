import { Node, UITransform, Label, Color, Graphics, EventTouch } from "cc";

/** Shared drawing primitives for selection, upgrade, shop and result menus. */
export class MenuWidgets {
  constructor(private make: (name: string, parent: Node) => Node) {}
  text(
    parent: Node,
    value: string,
    x: number,
    y: number,
    size = 22,
    color = "#f4e8d3",
    width = 1000,
  ) {
    const n = this.make("Text", parent);
    n.setPosition(x, y);
    n.getComponent(UITransform)!.setContentSize(width, Math.max(size * 3, value.split("\n").length * size * 1.5));
    const l = n.addComponent(Label);
    l.string = value;
    l.fontSize = size;
    l.lineHeight = size * 1.5;
    l.color = new Color().fromHEX(color);
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    l.verticalAlign = Label.VerticalAlign.CENTER;
    return l;
  }
  panel(
    parent: Node,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) {
    const n = this.make("Panel", parent);
    n.setPosition(x, y);
    n.getComponent(UITransform)!.setContentSize(w, h);
    const g = n.addComponent(Graphics);
    g.fillColor = new Color().fromHEX(color);
    g.roundRect(-w / 2, -h / 2, w, h, 8);
    g.fill();
    return n;
  }
  button(
    parent: Node,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fn: () => void,
  ) {
    const n = this.panel(parent, x, y, w, h, "#354451");
    const l = this.text(n, title, 0, 0, 20, "#f3deac", w - 16);
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      e.propagationStopped = true;
      fn();
    });
    return l;
  }
}
