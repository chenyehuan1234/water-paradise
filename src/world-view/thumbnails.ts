import { ACESFilmicToneMapping, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import type { ObjectKind } from '../world/types';
import { gargoyle, prototype } from './models';
/** Small, locally rendered model previews share the actual in-scene shapes and materials. */
export function fillThumbnails(root: HTMLElement) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(144, 108); renderer.setPixelRatio(1); renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new Scene(),camera=new OrthographicCamera(-.93,.93,.7,-.7,.1,30);
  camera.position.set(3,3.5,4);camera.lookAt(0,.5,0);scene.add(new HemisphereLight('#fff2d8','#68857a',2.4));const sun=new DirectionalLight('#ffe3c8',2.5);sun.position.set(-3,5,4);scene.add(sun);
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-tool]')){
    const kind=button.dataset.tool!;if(kind==='source')continue;
    const model=kind==='spawn'?gargoyle().root:prototype(kind as ObjectKind);if(kind==='barrier'){model.scale.setScalar(.6);model.position.y=-.02;}if(kind==='bridge')model.position.y=.5;
    scene.add(model);renderer.render(scene,camera);const img=document.createElement('img');img.src=renderer.domElement.toDataURL('image/png');img.alt='';img.width=72;img.height=54;button.querySelector('.thumbnail')!.replaceChildren(img);scene.remove(model);
  }
  renderer.dispose();
}
