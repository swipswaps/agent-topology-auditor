import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Render an animated 3D trust-boundary topology.
 *
 * WebGL is an enhancement, not a prerequisite for the rest of the
 * React application. If renderer initialization fails, this component
 * displays an explanatory fallback instead of throwing out of its effect.
 */
export default function TopologyThreeScene({ architectureId }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;

    if (!container) {
      return undefined;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 390;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a10);

    const camera = new THREE.PerspectiveCamera(
      46,
      width / height,
      0.1,
      1000
    );

    camera.position.set(0, 4.4, 9.2);
    camera.lookAt(0, 0, 0);

    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'default',
      });
    } catch (error) {
      console.error(
        '[TopologyThreeScene] WebGL renderer initialization failed:',
        error
      );

      container.replaceChildren();

      const fallback = document.createElement('div');

      Object.assign(fallback.style, {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: '220px',
        padding: '24px',
        color: '#e6edf7',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      });

      const heading = document.createElement('strong');
      heading.textContent = '3D visualization unavailable';
      heading.style.color = '#f59e0b';

      const detail = document.createElement('p');
      detail.textContent =
        'This browser or graphics configuration could not initialize WebGL. ' +
        'The remaining audit interface and 2D provenance graph are still available.';

      const diagnostic = document.createElement('small');
      diagnostic.textContent = error?.message || String(error);
      diagnostic.style.color = '#9fb0cc';

      fallback.append(heading, detail, diagnostic);
      container.appendChild(fallback);

      return () => {
        container.replaceChildren();
      };
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    container.replaceChildren(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      0x38bdf8,
      1.4
    );
    directionalLight.position.set(5, 8, 6);
    scene.add(directionalLight);

    const gridHelper = new THREE.GridHelper(
      12,
      16,
      0x1e293b,
      0x111827
    );
    gridHelper.position.y = -1.6;
    scene.add(gridHelper);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const packetMeshes = [];

    /**
     * Build the shared geometry and material objects.
     * Three.js resource ownership remains local to this effect so cleanup
     * can dispose every geometry and material when the component unmounts.
     */
    function addBoxEdges(widthValue, heightValue, depthValue, color) {
      const geometry = new THREE.BoxGeometry(
        widthValue,
        heightValue,
        depthValue
      );

      const edges = new THREE.EdgesGeometry(geometry);
      geometry.dispose();

      const material = new THREE.LineBasicMaterial({ color });
      const mesh = new THREE.LineSegments(edges, material);

      rootGroup.add(mesh);
      return mesh;
    }

    function addPacket(color, phase, radius) {
      const geometry = new THREE.SphereGeometry(0.11, 12, 12);
      const material = new THREE.MeshBasicMaterial({ color });
      const packet = new THREE.Mesh(geometry, material);

      packet.userData = { phase, radius };
      rootGroup.add(packet);
      packetMeshes.push(packet);
      return packet;
    }

    if (architectureId === 'superbot_vps') {
      addBoxEdges(6.2, 2.6, 3.6, 0xf43f5e);

      const supervisor = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65, 0),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b })
      );

      supervisor.position.set(-1.9, 0.2, 0);
      rootGroup.add(supervisor);

      const containerPositions = [
        [0, 0.4, -0.8],
        [0, 0.4, 0.8],
        [1.8, 0.4, 0],
      ];

      containerPositions.forEach(([x, y, z]) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.72,
          })
        );

        mesh.position.set(x, y, z);
        rootGroup.add(mesh);
      });

      for (let index = 0; index < 6; index += 1) {
        addPacket(
          0xf43f5e,
          (index / 6) * Math.PI * 2,
          2.6
        );
      }
    } else {
      const monitor = addBoxEdges(2.2, 2.4, 2.8, 0x10b981);
      monitor.position.set(-2.3, 0, 0);

      const vaultCore = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 1),
        new THREE.MeshStandardMaterial({ color: 0x10b981 })
      );

      vaultCore.position.set(-2.3, 0.2, 0);
      rootGroup.add(vaultCore);

      const llmBox = addBoxEdges(2.2, 2.4, 2.8, 0x38bdf8);
      llmBox.position.set(2.3, 0, 0);

      const llmSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 20, 20),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          wireframe: true,
        })
      );

      llmSphere.position.set(2.3, 0.2, 0);
      rootGroup.add(llmSphere);

      const gatePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 2.5),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        })
      );

      gatePlane.position.set(0, 0, 0);
      rootGroup.add(gatePlane);

      for (let index = 0; index < 4; index += 1) {
        addPacket(
          0x10b981,
          (index / 4) * Math.PI * 2,
          1.5
        );
      }
    }

    let animationId = 0;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = (now - startTime) * 0.001;

      rootGroup.rotation.y = Math.sin(elapsed * 0.35) * 0.38;

      packetMeshes.forEach((packet, index) => {
        const angle =
          elapsed * 1.4 + packet.userData.phase;

        if (architectureId === 'superbot_vps') {
          packet.position.set(
            Math.cos(angle) * packet.userData.radius,
            Math.sin(angle * 2 + index) * 0.65,
            Math.sin(angle) * 1.35
          );
        } else {
          packet.position.set(
            Math.cos(angle) * 2.1,
            Math.sin(angle * 1.5) * 0.5,
            Math.sin(angle) * 0.9
          );
        }
      });

      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    }

    animationId = window.requestAnimationFrame(animate);

    function handleResize() {
      const newWidth = container.clientWidth || 600;
      const newHeight = container.clientHeight || 390;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);

      // Dispose GPU resources rather than leaving geometry and material
      // allocations alive after architecture changes or component unmounts.
      rootGroup.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      if (typeof renderer.forceContextLoss === 'function') {
        renderer.forceContextLoss();
      }

      container.replaceChildren();
    };
  }, [architectureId]);

  return (
    <div
      ref={mountRef}
      className="canvas-container"
      aria-label="Three-dimensional agent topology visualization"
    />
  );
}
