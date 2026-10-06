import * as THREE from 'three';
import type { ItemType } from './types';
const palette = { dark: '#182d36', metal: '#537778', light: '#adc3a2', cream: '#eee2bc', orange: '#e2a34a', red: '#b85045', green: '#75a96b', blue: '#6badd0' };
const materials = new Map<string, THREE.MeshLambertMaterial>();
function material(c: string): THREE.MeshLambertMaterial{ if(!materials.has(c)) materials.set(c,new THREE.MeshLambertMaterial({color:c})); return materials.get(c)!; }
function box(g: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, c: string): THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c)); m.position.set(x,y,z); g.add(m); return m; }

export function itemModel(type: ItemType): THREE.Group{
 const g=new THREE.Group();
 if(type==='water'){box(g,0,0,0,.58,1.15,.52,palette.blue);box(g,0,.67,0,.36,.22,.34,palette.cream);box(g,0,-.05,.273,.6,.35,.02,palette.cream);box(g,-.18,.22,.28,.1,.36,.03,'#bce7e9');}
 if(type==='potato'){box(g,0,0,0,.77,.55,.55,'#b88749');box(g,.08,.25,0,.48,.18,.4,'#c9a360');box(g,-.23,-.07,.29,.09,.08,.03,'#6c563e');box(g,.18,.12,.29,.08,.09,.03,'#6c563e');}
 if(type==='plastic'){box(g,0,0,0,.63,.32,.45,'#9ec4c1');box(g,.24,.2,0,.24,.28,.28,palette.blue);box(g,-.18,.1,.18,.33,.14,.13,palette.cream);}
 if(type==='fertilizer'){box(g,0,0,0,.66,.74,.44,'#a7b26d');box(g,0,.42,0,.48,.16,.38,'#c3cc83');box(g,0,-.03,.24,.35,.34,.03,'#4e7954');box(g,0,.03,.27,.1,.2,.03,'#c5d797');}
 if(type==='metal'){box(g,0,0,0,1.1,.24,.4,'#718b91');box(g,-.23,.2,-.07,.58,.2,.34,'#a4b2ad');box(g,.33,.04,.22,.25,.13,.03,'#af704c');}
 if(type==='knife'){box(g,0,-.38,0,.22,.55,.2,'#986b46');box(g,0,-.09,0,.45,.1,.28,'#dfbf7c');box(g,.035,.42,0,.27,.9,.12,'#bacbd1');box(g,-.07,.78,0,.09,.2,.12,'#e5eddb');}
 if(type==='backpack'){box(g,0,0,0,.92,.98,.48,'#6a805c');box(g,0,-.17,.31,.69,.49,.19,'#a4aa72');box(g,-.34,.15,.29,.13,.8,.11,'#bd9b65');box(g,.34,.15,.29,.13,.8,.11,'#bd9b65');box(g,0,.58,0,.47,.16,.17,'#b0ae7a');}
 return g;
}

export function litScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#dcecc6', .9));
  const light = new THREE.DirectionalLight('#fff1c3', 1.3);
  light.position.set(-7, 15, 8); scene.add(light); return scene;
}
export function createWorldScene(aspect: number) {
 const scene=litScene(); scene.background=new THREE.Color('#253e48');
 const halfHeight = 3;
 const camera=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.1,100);camera.position.set(3,8,25);camera.lookAt(-.7,.8,0);
 const ground=new THREE.Group();scene.add(ground);box(ground,0,-1.25,0,70,.3,45,'#384f4a');
 for(let i=-23;i<24;i++){box(ground,i*1.1,-1.01,.2,.24,.15,5,'#253735');}for(const z of [-1.35,1.65])box(ground,0,-.89,z,65,.14,.12,'#93a49b');
 let rng=912;function rand(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
 for(let i=0;i<100;i++){const x=(rand()-.5)*60,z=(rand()-.5)*35;if(Math.abs(z)<3)continue;box(ground,x,-.85,z,.25+rand()*.8,.3+rand()*.8,.3+rand()*.7,['#586755','#63755d','#2c4542'][i%3]);}
 for(let i=0;i<5;i++){box(ground,9+i*2,-.8,-5,1.8,.5,5,'#52615b');}
 const train=new THREE.Group();scene.add(train);box(train,0,-.2,0,15,.4,4,'#152e36');box(train,0,.09,0,14.8,.22,3.9,'#baad7e');
 for(let x=-7;x<7.5;x+=.45)box(train,x,.215,0,.025,.025,3.8,'#8e8e65');
 for(const x of [-5.7,-4.5,4.5,5.7])for(const z of [-1.9,1.9]){box(train,x,-.57,z,.75,.75,.32,'#101f2b');box(train,x,-.57,z+(z>0?.18:-.18),.32,.32,.05,'#7e9393');}
 box(train,0,1.15,-1.95,14.7,2,.2,'#557a77');box(train,0,2.2,-1.95,15,.16,.28,'#a4b497');
 for(const x of [-5,-1.4,2.1,5.4]){box(train,x,1.4,-1.82,1.6,.8,.1,'#233e48');box(train,x,1.4,-1.74,1.32,.57,.04,'#7ca8a4');box(train,x,1.4,-1.69,.08,.66,.05,'#c2c29d');}
 box(train,0,.45,1.95,15,.5,.2,'#42666a');box(train,0,.75,1.95,15,.12,.26,'#8fa99b');
 for(const x of [-7.4,-2.5,2.6,7.4]){box(train,x,1.2,-1.88,.18,2.3,.2,'#c1c49d');box(train,x,.65,1.9,.18,.9,.2,'#a1b399');}
 // Original cutaway locomotive: roof silhouette, headlamps, smokestack.
 box(train,-7.7,.85,0,1.8,1.45,3.6,'#426b69');box(train,-8.3,1.53,0,1.1,.24,3.4,'#78938a');box(train,-8.55,1.85,-.4,.48,.7,.5,'#233941');box(train,-8.8,.3,0,.5,.4,4.2,'#a79f6f');
 for(const z of [-1.2,1.2])box(train,-8.65,1,z,.07,.43,.43,'#f7d483');
 // Cargo: stacked wooden crates, shelves and hanging tools.
 for(const [x,z,h] of [[-5.8,-.8,1.1],[-4.5,-.8,.7],[-5.8,.6,.6]]){box(train,x,.25+h/2,z,1,h,1,'#9c8556');box(train,x,.25+h/2,z+.51,.75,.13,.03,'#ccb375');box(train,x-.34,.25+h/2,z+.52,.1,h,.03,'#6c684d');box(train,x+.34,.25+h/2,z+.52,.1,h,.03,'#6c684d');}
 box(train,-3.65,.69,-.9,.45,.9,1.2,'#70877a');box(train,-3.65,1.18,-.9,.55,.1,1.3,'#c2c4a1');
 // Cultivation bay and crop voxels.
 box(train,-.7,.6,-.45,2.3,.75,1.55,'#835f49');box(train,-.7,1,-.45,2.5,.15,1.7,'#b79867');box(train,-.7,1.09,-.45,2.1,.05,1.35,'#413d35');
 const leaves=new THREE.Group();train.add(leaves);for(const x of [-1.4,-.7,0])for(const z of [-.85,-.1]){box(leaves,x,1.36,z,.12,.55,.12,'#668557');box(leaves,x-.19,1.4,z,.42,.18,.32,'#80ae65');box(leaves,x+.16,1.58,z,.43,.16,.3,'#a3c780');}
 // Filter plumbing, blue drum, workbench.
 box(train,4.7,.72,-.55,1.15,1.1,1.2,'#4c8b9e');box(train,4.7,1.34,-.55,1.24,.18,1.27,'#a8c1b2');for(const y of [.4,1])box(train,4.7,y,.07,1.2,.1,.04,'#c1d6bc');box(train,5.75,1.12,-.55,.18,1.65,.18,'#c1c9ac');box(train,5.2,1.9,-.55,1.25,.16,.16,'#c1c9ac');box(train,6.2,.6,.6,1.2,.8,1,'#718778');box(train,6.2,1.04,.6,1.3,.12,1.15,'#baa982');
 // Traveller with pack and lantern.
 const person=new THREE.Group();train.add(person);person.position.set(1.4,.3,.9);box(person,0,.24,0,.32,.5,.28,'#303b43');box(person,0,.65,0,.52,.55,.35,'#c29458');box(person,0,1.11,0,.38,.36,.36,'#dbb789');box(person,0,1.31,0,.57,.15,.46,'#70866c');box(person,-.32,.66,0,.16,.45,.2,'#bd9159');box(person,.32,.65,0,.16,.45,.2,'#bd9159');box(person,.5,.43,0,.2,.27,.23,'#efd38b');
 const smoke: THREE.Mesh[]=[];for(let i=0;i<5;i++)smoke.push(box(scene,-8.5-i*.3,3+i*.5,-.4,.3+i*.1,.3+i*.1,.3+i*.1,'#8b9c87'));

 return { scene, camera, update(t: number, active: boolean) {
   ground.position.x=active?-(t*.0008%1.1):0;
   person.position.y=.3+Math.sin(t*.002)*.035;
   leaves.rotation.z=Math.sin(t*.001)*.009;
   smoke.forEach((m,i)=>{m.position.y=2.7+((t*.00035+i*.4)%2);m.scale.setScalar(.6+(m.position.y-2.7)*.3);});
   (scene.background as THREE.Color).set(active?'#202d40':'#253e48');
 }, dispose() { scene.traverse(object => { if(object instanceof THREE.Mesh) object.geometry.dispose(); }); } };
}
