import * as THREE from 'three';

// 程序化纹理生成工具
export function createScalePatternTexture(baseColor, scaleColor, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 底色
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // 鳞甲图案
  ctx.fillStyle = scaleColor;
  const scaleW = size / 8;
  const scaleH = size / 10;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * scaleW + (row % 2 ? scaleW / 2 : 0);
      const y = row * scaleH;
      ctx.beginPath();
      ctx.ellipse(x + scaleW / 2, y + scaleH / 2, scaleW / 2.2, scaleH / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function createDragonPatternTexture(baseColor, lineColor, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;

  // 蜿蜒龙纹
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const startY = 40 + i * 80;
    ctx.moveTo(0, startY);
    for (let x = 0; x < size; x += 10) {
      const y = startY + Math.sin(x * 0.05 + i) * 20 + Math.sin(x * 0.02) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 龙爪
    for (let j = 0; j < 4; j++) {
      const cx = 30 + j * 55;
      const cy = startY + Math.sin(cx * 0.05 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 8, cy - 12);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 8, cy - 12);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 15);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createGripTexture(baseColor, lineColor, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  // 交叉防滑纹
  for (let i = -size; i < size * 2; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
}

export function createMetalBrushTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, size, size);

  // 拉丝金属纹路
  for (let i = 0; i < 200; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${150 + Math.random() * 60}, ${150 + Math.random() * 60}, ${150 + Math.random() * 60}, 0.3)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createWoodTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 木纹底色
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#5a2a0a');
  grad.addColorStop(0.3, '#7a3a1a');
  grad.addColorStop(0.6, '#5a2a0a');
  grad.addColorStop(1, '#6a3010');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 木纹线条
  ctx.strokeStyle = 'rgba(40, 15, 0, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const y = (i / 30) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 5) {
      ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 0.5) * 3);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createConcreteTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8a8a7a';
  ctx.fillRect(0, 0, size, size);

  // 噪点
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 100 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v - 10}, 0.3)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // 裂纹
  ctx.strokeStyle = 'rgba(60, 60, 50, 0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 10; j++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createMetalPanelTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6a6a5a';
  ctx.fillRect(0, 0, size, size);

  // 钢板接缝
  ctx.strokeStyle = 'rgba(40, 40, 30, 0.5)';
  ctx.lineWidth = 2;
  for (let x = 0; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // 铆钉
  ctx.fillStyle = '#555';
  for (let x = 32; x < size; x += 64) {
    for (let y = 0; y < size; y += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
