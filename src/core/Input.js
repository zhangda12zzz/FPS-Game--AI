// 输入管理
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: {} };
    this.isLocked = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onContextMenu = (e) => e.preventDefault(); // 屏蔽右键菜单，供右键开镜使用
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  enablePointerLock() {
    this.canvas.requestPointerLock();
  }

  requestPointerLock() {
    this.canvas.requestPointerLock();
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.canvas;
  }

  _onKeyDown(e) {
    // 阻止 Tab 的默认焦点切换（防止选中左侧控制按钮），Tab 仅用于弹出计分板
    if (e.code === 'Tab') e.preventDefault();
    // 下蹲使用 Ctrl，阻止 Ctrl 及其与游戏按键的组合默认行为（如 Ctrl+R 刷新、Ctrl+S 保存）
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') e.preventDefault();
    if (e.ctrlKey && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Space'].includes(e.code)) e.preventDefault();
    if (!this.keys[e.code]) {
      this.justPressed.add(e.code);
    }
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    this.justReleased.add(e.code);
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.mouse.dx = e.movementX || 0;
    this.mouse.dy = e.movementY || 0;
  }

  _onMouseDown(e) {
    this.mouse.buttons[e.button] = true;
  }

  _onMouseUp(e) {
    this.mouse.buttons[e.button] = false;
  }

  isKeyPressed(code) { return !!this.keys[code]; }
  isKeyJustPressed(code) { return this.justPressed.has(code); }
  isKeyJustReleased(code) { return this.justReleased.has(code); }
  isMouseDown(button = 0) { return !!this.mouse.buttons[button]; }

  consumeMouseDelta() {
    const dx = this.mouse.dx;
    const dy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }

  /** 每帧结束时调用，清除单帧状态 */
  endFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }

  dispose() { this.destroy(); }
}
