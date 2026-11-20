// Small interactive STL viewer (three.js). Drag to rotate; it spins by itself until you touch it.
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function mountStl(box, url, { color = 0xec3750 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  box.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 3);
  camera.add(key);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false; // keeps page scrolling working
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.5;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const resize = () => {
    const w = box.clientWidth || 300, h = box.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(box);
  resize();

  return new Promise((resolve, reject) => {
    new STLLoader().load(url, (geo) => {
      geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 }));
      mesh.rotation.x = -Math.PI / 2; // STL is Z-up
      scene.add(mesh);
      const r = geo.boundingSphere.radius;
      camera.position.set(0, r * 1.2, r * 2.6);
      camera.near = r / 50; camera.far = r * 50; camera.updateProjectionMatrix();
      controls.update();

      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
      renderer.setAnimationLoop(() => { if (visible) { controls.update(); renderer.render(scene, camera); } });
      box.classList.add("ready");
      resolve();
    }, undefined, reject);
  });
}
