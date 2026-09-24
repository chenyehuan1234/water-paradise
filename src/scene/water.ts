import { Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector4, TorusGeometry, MeshBasicMaterial } from 'three';
import { palette } from './config';
import type { DisplaySceneConfig } from './config';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const surfaceShader = `
  uniform float time;
  uniform vec3 deepColor;
  uniform vec3 lightColor;
  uniform vec3 foamColor;
  uniform vec2 size;
  uniform vec2 flow;
  uniform vec4 edgeFoam;
  uniform vec2 foamGap;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * size;
    vec2 q = p + flow * time * .24;
    float wave = sin(q.x * 3.6 + sin(q.y * 4.1)) * sin(q.y * 5.3 - q.x * 1.5);
    float caustic = pow(max(0.0, 1.0 - abs(sin(q.x * 5.8 + sin(q.y * 5.2) * 1.4))), 13.0);
    caustic *= .5 + .5 * sin(q.y * 3.0 - time * .3);
    float glint = pow(max(0.0, sin(q.x * 8.0 - q.y * 12.0 + time * .4)), 45.0);
    float wobble = sin(p.x * 16.0 + time) * .012 + sin(p.y * 18.0 - time * .7) * .009;
    float nearEdge = p.x > foamGap.x && p.x < foamGap.y ? 10.0 : p.y;
    float edge = min(min(mix(10.0, p.x, edgeFoam.x), mix(10.0, size.x-p.x, edgeFoam.y)),
                     min(mix(10.0, nearEdge, edgeFoam.z), mix(10.0, size.y-p.y, edgeFoam.w)));
    float foam = 1.0 - smoothstep(.035, .09, edge + wobble);
    vec3 color = mix(deepColor, lightColor, .32 + .16 * wave + .17 * vUv.y);
    color = mix(color, foamColor, clamp(foam * .88 + caustic * .22 + glint * .08, 0.0, .95));
    gl_FragColor = vec4(color, .9);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const fallShader = `
  uniform float time;
  uniform vec3 deepColor;
  uniform vec3 foamColor;
  varying vec2 vUv;
  void main() {
    float stream = sin(vUv.x * 67.0 + sin(vUv.y * 11.0 + time * 2.6) * .8);
    float fine = pow(max(0.0, sin(vUv.x * 112.0 + sin(vUv.y * 4.0 + time * 1.8))), 7.0);
    float edge = 1.0 - smoothstep(.02, .15, min(vUv.x, 1.0 - vUv.x));
    float streak = sin(vUv.y * 23.0 + time * 4.8 + vUv.x * 9.0) * .09;
    vec3 color = mix(deepColor, foamColor, .42 + .12 * stream + edge * .34 + fine * .18 + streak);
    float alpha = .65 + edge * .25 + fine * .1;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class WaterVisual {
  readonly group = new Group();
  private shaders: ShaderMaterial[] = [];
  private rings: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];
  private time = 0;
  paused = false;

  constructor(config: DisplaySceneConfig) {
    for (const pool of config.pools) {
      const material = new ShaderMaterial({
        uniforms: {
          time: { value: 0 }, deepColor: { value: new Color(palette.water) },
          lightColor: { value: new Color(palette.waterLight) }, foamColor: { value: new Color(palette.foam) },
          size: { value: new Vector2(...pool.size) }, flow: { value: new Vector2(...pool.flow) },
          edgeFoam: { value: new Vector4(...pool.edgeFoam) },
          foamGap: { value: new Vector2(...(pool.foamGap ?? [-1, -1])) },
        },
        vertexShader, fragmentShader: surfaceShader, transparent: true, depthWrite: false, side: DoubleSide,
      });
      const mesh = new Mesh(new PlaneGeometry(...pool.size), material);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(...pool.center); mesh.renderOrder = 1;
      this.group.add(mesh); this.shaders.push(material);
    }
    const fallMaterial = new ShaderMaterial({
      uniforms: { time: { value: 0 }, deepColor: { value: new Color(palette.water) }, foamColor: { value: new Color(palette.foam) } },
      vertexShader, fragmentShader: fallShader, transparent: true, depthWrite: false, side: DoubleSide,
    });
    const fall = new Mesh(new PlaneGeometry(config.waterfall.width, config.waterfall.height), fallMaterial);
    fall.position.set(...config.waterfall.center); fall.renderOrder = 2;
    this.group.add(fall); this.shaders.push(fallMaterial);
    for (let i = 0; i < 4; i++) {
      const ring = new Mesh(new TorusGeometry(.3, .016, 4, 48), new MeshBasicMaterial({ color: palette.foam, transparent: true, opacity: .5, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(config.waterfall.center[0], .206 + i * .001, .03);
      ring.renderOrder = 2; this.rings.push(ring); this.group.add(ring);
    }
    this.update(0);
  }

  update(delta: number) {
    if (!this.paused) this.time += delta;
    for (const shader of this.shaders) shader.uniforms.time.value = this.time;
    this.rings.forEach((ring, i) => {
      const phase = (this.time * .35 + i / this.rings.length) % 1;
      ring.scale.setScalar(.55 + phase * 2.1);
      ring.material.opacity = (1 - phase) * .45;
    });
  }

  get elapsed() { return this.time; }
  dispose() {
    this.group.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    this.shaders.forEach(m => m.dispose()); this.rings.forEach(r => r.material.dispose());
  }
}
