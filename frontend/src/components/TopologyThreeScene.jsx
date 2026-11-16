import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function TopologyThreeScene({ architectureId }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 390;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a10);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 4.4, 9.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(12, 16, 0x1e293b, 0x111827);
    gridHelper.position.y = -1.6;
    scene.add(gridHelper);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const packetMeshes = [];

    if (architectureId === 'superbot_vps') {
      const vpsGeo = new THREE.BoxGeometry(6.2, 2.6, 3.6);
      const vpsEdges = new THREE.EdgesGeometry(vpsGeo);
      const vpsBox = new THREE.LineSegments(
        vpsEdges,
        new THREE.LineBasicMaterial({ color: 0xf43f5e })
      );
      rootGroup.add(vpsBox);

      const supMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65, 0),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, wireframe: false })
      );
      supMesh.position.set(-1.9, 0.2, 0);
      rootGroup.add(supMesh);

      const containerPositions = [
        [0, 0.4, -0.8],
        [0, 0.4, 0.8],
        [1.8, 0.4, 0],
      ];
      containerPositions.forEach(([x, y, z]) => {
        const cMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.72,
          })
        );
        cMesh.position.set(x, y, z);
        rootGroup.add(cMesh);
      });

      for (let i = 0; i < 6; i += 1) {
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xf43f5e })
        );
        p.userData = { phase: (i / 6) * Math.PI * 2, radius: 2.6 };
        rootGroup.add(p);
        packetMeshes.push(p);
      }
    } else {
      const monitorGeo = new THREE.BoxGeometry(2.2, 2.4, 2.8);
      const monitorBox = new THREE.LineSegments(
        new THREE.EdgesGeometry(monitorGeo),
        new THREE.LineBasicMaterial({ color: 0x10b981 })
      );
      monitorBox.position.set(-2.3, 0, 0);
      rootGroup.add(monitorBox);

      const vaultCore = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 1),
        new THREE.MeshStandardMaterial({ color: 0x10b981 })
      );
      vaultCore.position.set(-2.3, 0.2, 0);
      rootGroup.add(vaultCore);

      const llmGeo = new THREE.BoxGeometry(2.2, 2.4, 2.8);
      const llmBox = new THREE.LineSegments(
        new THREE.EdgesGeometry(llmGeo),
        new THREE.LineBasicMaterial({ color: 0x38bdf8 })
      );
      llmBox.position.set(2.3, 0, 0);
      rootGroup.add(llmBox);

      const llmSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, wireframe: true })
      );
      llmSphere.position.set(2.3, 0.2, 0);
      rootGroup.add(llmSphere);

      const gatePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 2.5),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
      );
      gatePlane.position.set(0, 0, 0);
      rootGroup.add(gatePlane);

      for (let i = 0; i < 4; i += 1) {
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0x10b981 })
        );
        p.userData = { phase: (i / 4) * Math.PI * 2, radius: 1.5 };
        rootGroup.add(p);
        packetMeshes.push(p);
      }
    }

    let animId = 0;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = (now - startTime) * 0.001;
      rootGroup.rotation.y = Math.sin(elapsed * 0.35) * 0.38;

      packetMeshes.forEach((p, idx) => {
        const angle = elapsed * 1.4 + p.userData.phase;
        if (architectureId === 'superbot_vps') {
          p.position.set(
            Math.cos(angle) * p.userData.radius,
            Math.sin(angle * 2 + idx) * 0.65,
            Math.sin(angle) * 1.35
          );
        } else {
          p.position.set(
            Math.cos(angle) * 2.1,
            Math.sin(angle * 1.5) * 0.5,
            Math.sin(angle) * 0.9
          );
        }
      });

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 390;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [architectureId]);

  return <div ref={mountRef} className="canvas-container" />;
}
