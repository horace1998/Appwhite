import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSYNK } from "./Store";

export default function ThreeBackground({ completionRate, showCore = true }: { completionRate: number, showCore?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { accentColors } = useSYNK();

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Get container dimensions
    let w = container.clientWidth;
    let h = container.clientHeight;

    const scene = new THREE.Scene();
    // Dark background handled by CSS, keep scene transparent
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 8;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.error("WebGL initialization failed:", e);
      return;
    }
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Dynamic Colors from Store
    const color1 = new THREE.Color(accentColors[0] || "#60a5fa");
    const color2 = new THREE.Color(accentColors[1] || "#f472b6");
    const color3 = new THREE.Color(accentColors[2] || "#a78bfa");

    // Group for rotation - only add if showCore is true
    const group = new THREE.Group();
    if (showCore) {
      scene.add(group);
    }

    // Glowing Orb
    const orbGeo = new THREE.SphereGeometry(1.5, 32, 32);
    // Base color white, emissive changes based on rate
    const orbMat = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      emissive: new THREE.Color().lerpColors(color1, color2, completionRate),
      emissiveIntensity: 0.5 + completionRate, 
      roughness: 0.2,
      metalness: 0.8
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    if (showCore) group.add(orb);

    // Rings
    const ring1Geo = new THREE.TorusGeometry(3, 0.05, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: color3, transparent: true, opacity: 0.6 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 2;
    if (showCore) group.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(4, 0.02, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: color1, transparent: true, opacity: 0.3 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    if (showCore) group.add(ring2);

    // Particles with dynamic color (lerped)
    const partsGeo = new THREE.BufferGeometry();
    const partsCount = 500;
    const pos = new Float32Array(partsCount * 3);
    for(let i=0; i<partsCount*3; i++) pos[i] = (Math.random() - 0.5) * 20;
    partsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const partsMat = new THREE.PointsMaterial({ color: color2, size: 0.05, transparent: true, opacity: 0.5 });
    const particles = new THREE.Points(partsGeo, partsMat);
    scene.add(particles);

    // Lights
    const ambientLight = new THREE.AmbientLight(color1, 0.3);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(color2, 1.5, 50);
    scene.add(pointLight);

    let animationFrameId: number;

    const animate = () => {
      // Orb pulsing
      const time = performance.now() * 0.001;
      
      if (showCore) {
        const pulse = 1 + Math.sin(time * 2) * 0.05;
        orb.scale.set(pulse, pulse, pulse);

        // Rings rotating
        ring1.rotation.x += 0.005;
        ring1.rotation.y += 0.005;
        ring2.rotation.z -= 0.002;
        ring2.rotation.x -= 0.002;

        // Group float
        group.position.y = Math.sin(time) * 0.2;
      }

      // Particles slow rotation
      particles.rotation.y += 0.0005;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === container) {
          w = entry.contentRect.width;
          h = entry.contentRect.height;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [completionRate, showCore]);

  return <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[24px]" />;
}
