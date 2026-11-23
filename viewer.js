// Small interactive STL viewer (three.js). Drag to rotate; it spins by itself until you touch it.
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const OCCT = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/";
let occtPromise;
function loadOcct() {
  occtPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OCCT + "occt-import-js.js";
    s.onload = () => window.occtimportjs({ locateFile: (f) => OCCT + f }).then(resolve, reject);
    s.onerror = reject;
    document.head.append(s);
  });
  return occtPromise;
}

// STEP files are converted to a mesh in the browser, then shown like an STL.
async function loadStep(url) {
  const [occt, buf] = await Promise.all([loadOcct(), fetch(url).then((r) => r.arrayBuffer())]);
  const res = occt.ReadStepFile(new Uint8Array(buf), null);
  if (!res.success || !res.meshes.length) throw new Error("Could not read STEP file");
  const geos = res.meshes.map((m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
    if (m.attributes.normal) g.setAttribute("normal", new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
    g.setIndex(m.index.array);
    return g;
  });
  return geos.length === 1 ? geos[0] : mergeGeometries(geos);
}

const geoCache = new Map();
function getGeometry(url) {
  if (!geoCache.has(url)) {
    const p = (/\.(step|stp)$/i.test(url)
      ? loadStep(url)
      : new Promise((res, rej) => new STLLoader().load(url, res, undefined, rej)))
      .then((geo) => { geo.computeVertexNormals(); geo.center(); geo.computeBoundingSphere(); return geo; });
    p.catch(() => geoCache.delete(url));
    geoCache.set(url, p);
  }
  return geoCache.get(url);
}

// One live WebGL view. Browsers allow only ~8-16 at once, so lazyStl() makes them while on screen and frees them after.
function mountStl(box, url, color = 0xec3750) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  box.prepend(renderer.domElement);

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
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  let dead = false;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
  const ready = getGeometry(url).then((geo) => {
    if (dead) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // STL is Z-up
    scene.add(mesh);
    const r = geo.boundingSphere.radius;
    camera.position.set(0, r * 1.2, r * 2.6);
    camera.near = r / 50; camera.far = r * 50; camera.updateProjectionMatrix();
    controls.update();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    box.classList.add("ready");
  });

  return {
    ready,
    dispose() {
      dead = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      box.classList.remove("ready");
    },
  };
}

export function lazyStl(box, url, onError) {
  let view = null;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !view) {
      view = mountStl(box, url);
      view.ready.catch((err) => { console.error(err); onError?.(err); });
    } else if (!e.isIntersecting && view) {
      view.dispose();
      view = null;
    }
  }, { rootMargin: "250px" }).observe(box);
}
