import * as THREE from 'three';

const loader = new THREE.TextureLoader();

/**
 * 创建绿幕抠图材质 — 自动移除绿色背景，保留武器前景
 * @param {string} textureUrl  图片路径
 * @param {object} options     { threshold, spillReduction }
 */
export function createChromaKeyMaterial(textureUrl, options = {}) {
  const threshold = options.threshold ?? 0.15;
  const spillReduction = options.spillReduction ?? 0.08;

  const texture = loader.load(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      threshold: { value: threshold },
      spillReduction: { value: spillReduction },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float threshold;
      uniform float spillReduction;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(map, vUv);

        // 绿幕检测：绿色通道远高于红和蓝 → 丢弃
        float greenDiff = color.g - max(color.r, color.b);
        if (greenDiff > threshold) discard;

        // 绿色溢出抑制：边缘处降低绿色
        color.g = min(color.g, max(color.r, color.b) + spillReduction);

        gl_FragColor = color;
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
