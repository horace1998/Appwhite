import { useEffect, useRef } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";

export default function CrystalPrism({ onShatter }: { onShatter: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastY = useRef<number | null>(null);
  const shakeIntensity = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 300;
    const h = containerRef.current.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Main Prism Geometry: A specialized polyhedron for that 'KWANGYA' look
    const geo = new THREE.IcosahedronGeometry(1.6, 0); // Sharp edges
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.05,
      transmission: 0.8,
      thickness: 2,
      ior: 2.4, // Higher IOR for more "sparkle"
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const prism = new THREE.Mesh(geo, mat);
    scene.add(prism);

    // Energy Field: Floating particles that gravitate towards the center
    const particlesCount = 200;
    const particlesGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 12;
    }
    
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0xB388FF,
      size: 0.02,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const blueLight = new THREE.PointLight(0x4D94FF, 15, 30);
    blueLight.position.set(5, 5, 5);
    scene.add(blueLight);

    const pinkLight = new THREE.PointLight(0xFF4DCC, 15, 30);
    pinkLight.position.set(-5, -5, 5);
    scene.add(pinkLight);

    // Render first frame and stop
    renderer.render(scene, camera);

    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (lastY.current !== null) {
        const delta = Math.abs(currentY - lastY.current);
        // Only count significant vertical movements
        if (delta > 5) {
          shakeIntensity.current += delta;
          
          // Apply shake effect to prism
          prism.position.y = (Math.random() - 0.5) * (delta / 50);
          prism.scale.setScalar(1 + (shakeIntensity.current / 2000));
          
          mat.emissiveIntensity = 0.5 + (delta / 20);
          
          renderer.render(scene, camera);
        }
      }
      
      lastY.current = currentY;

      if (shakeIntensity.current >= 2000) {
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#FFFFFF', '#B388FF', '#4D94FF', '#FF4DCC']
        });
        onShatter();
        shakeIntensity.current = 0;
        lastY.current = null;
      }
    };

    const handleReset = () => {
      lastY.current = null;
    };

    const canvas = renderer.domElement;
    canvas.style.cursor = 'ns-resize'; // North-South resize cursor to hint vertical motion
    canvas.addEventListener('mousemove', handleInteraction);
    canvas.addEventListener('touchmove', handleInteraction);
    canvas.addEventListener('mouseleave', handleReset);
    canvas.addEventListener('touchend', handleReset);

    const handleResize = () => {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleInteraction);
      canvas.removeEventListener('touchmove', handleInteraction);
      containerRef.current?.removeChild(canvas);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, [onShatter]);

  return <div ref={containerRef} className="w-full h-[400px] flex items-center justify-center" />;
}
