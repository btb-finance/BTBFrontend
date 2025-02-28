interface NodeOptions {
  phase?: number;
  offset?: number;
  frequency?: number;
  amplitude?: number;
}

interface LineOptions {
  spring: number;
}

interface CanvasContext extends CanvasRenderingContext2D {
  running: boolean;
  frame: number;
  canvas: HTMLCanvasElement;
}

type Position = {
  x: number;
  y: number;
};

class NodeClass {
  phase: number;
  offset: number;
  frequency: number;
  amplitude: number;
  
  constructor(e: NodeOptions = {}) {
    this.phase = e.phase || 0;
    this.offset = e.offset || 0;
    this.frequency = e.frequency || 0.001;
    this.amplitude = e.amplitude || 1;
  }
  
  update(): number {
    this.phase += this.frequency;
    const e = this.offset + Math.sin(this.phase) * this.amplitude;
    return e;
  }
  
  value(): number {
    return this.update();
  }
}

class NodeElement {
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
}

class LineClass {
  spring: number;
  friction: number;
  nodes: NodeElement[];
  
  constructor(e: LineOptions) {
    this.spring = e.spring + 0.1 * Math.random() - 0.05;
    this.friction = E.friction + 0.01 * Math.random() - 0.005;
    this.nodes = [];
    for (let n = 0; n < E.size; n++) {
      const t = new NodeElement();
      t.x = pos.x;
      t.y = pos.y;
      this.nodes.push(t);
    }
  }
  
  update(): void {
    let e = this.spring;
    let t = this.nodes[0];
    t.vx += (pos.x - t.x) * e;
    t.vy += (pos.y - t.y) * e;
    
    for (let i = 0, a = this.nodes.length; i < a; i++) {
      t = this.nodes[i];
      if (i > 0) {
        const n = this.nodes[i - 1];
        t.vx += (n.x - t.x) * e;
        t.vy += (n.y - t.y) * e;
        t.vx += n.vx * E.dampening;
        t.vy += n.vy * E.dampening;
      }
      t.vx *= this.friction;
      t.vy *= this.friction;
      t.x += t.vx;
      t.y += t.vy;
      e *= E.tension;
    }
  }
  
  draw(): void {
    let e: NodeElement;
    let t: NodeElement;
    let n = this.nodes[0].x;
    let i = this.nodes[0].y;
    
    ctx.beginPath();
    ctx.moveTo(n, i);
    
    for (let a = 1, o = this.nodes.length - 2; a < o; a++) {
      e = this.nodes[a];
      t = this.nodes[a + 1];
      n = 0.5 * (e.x + t.x);
      i = 0.5 * (e.y + t.y);
      ctx.quadraticCurveTo(e.x, e.y, n, i);
    }
    
    const a = this.nodes.length - 2;
    e = this.nodes[a];
    t = this.nodes[a + 1];
    ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
    ctx.stroke();
    ctx.closePath();
  }
}

function onMousemove(e: MouseEvent | TouchEvent) {
  function o() {
    lines = [];
    for (let e = 0; e < E.trails; e++) {
      lines.push(new LineClass({ spring: 0.45 + (e / E.trails) * 0.025 }));
    }
  }
  
  function c(e: MouseEvent | TouchEvent) {
    if ('touches' in e) {
      pos.x = e.touches[0].pageX;
      pos.y = e.touches[0].pageY;
    } else {
      pos.x = e.clientX;
      pos.y = e.clientY;
    }
    e.preventDefault();
  }
  
  function l(e: TouchEvent) {
    if (e.touches.length === 1) {
      pos.x = e.touches[0].pageX;
      pos.y = e.touches[0].pageY;
    }
  }
  
  document.removeEventListener("mousemove", onMousemove);
  document.removeEventListener("touchstart", onMousemove as EventListener);
  document.addEventListener("mousemove", c as EventListener);
  document.addEventListener("touchmove", c as EventListener);
  document.addEventListener("touchstart", l as EventListener);
  c(e);
  o();
  render();
}

function render() {
  if (ctx.running) {
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "hsla(" + Math.round(f.update()) + ",100%,50%,0.025)";
    ctx.lineWidth = 10;
    
    for (let t = 0; t < E.trails; t++) {
      const e = lines[t];
      e.update();
      e.draw();
    }
    
    ctx.frame++;
    window.requestAnimationFrame(render);
  }
}

function resizeCanvas() {
  ctx.canvas.width = window.innerWidth - 20;
  ctx.canvas.height = window.innerHeight;
}

var ctx: CanvasContext,
  f: NodeClass,
  pos: Position = { x: 0, y: 0 },
  lines: LineClass[] = [],
  E = {
    debug: true,
    friction: 0.5,
    trails: 80,
    size: 50,
    dampening: 0.025,
    tension: 0.99,
  };

export const renderCanvas = function () {
  const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
  if (!canvasElement) return;
  
  const context = canvasElement.getContext("2d");
  if (!context) return;
  
  // Extend the context with our custom properties
  ctx = context as CanvasContext;
  ctx.running = true;
  ctx.frame = 1;
  ctx.canvas = canvasElement;
  
  f = new NodeClass({
    phase: Math.random() * 2 * Math.PI,
    amplitude: 85,
    frequency: 0.0015,
    offset: 285,
  });
  
  document.addEventListener("mousemove", onMousemove as EventListener);
  document.addEventListener("touchstart", onMousemove as EventListener);
  document.body.addEventListener("orientationchange", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);
  
  window.addEventListener("focus", () => {
    if (!ctx.running) {
      ctx.running = true;
      render();
    }
  });
  
  window.addEventListener("blur", () => {
    ctx.running = true;
  });
  
  resizeCanvas();
};
