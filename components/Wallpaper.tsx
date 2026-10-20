'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface WallpaperProps {
  wallpaper?: string;
  hasMaximizedWindow?: boolean;
}

// GLSL Vertex Shader for Silk Wave
const silkVertexShader = `
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec2 u_resolution;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vElevation;

  // Fluid harmonic wave displacement function
  float getElevation(vec2 pos, float time, vec2 mouse) {
    float elevation = 0.0;
    
    // Wave 1: Broad slow ocean swell
    elevation += sin(pos.x * 0.065 + time * 0.38) * 3.8;
    elevation += cos(pos.y * 0.082 + time * 0.32) * 3.2;

    // Wave 2: Medium diagonal rolling silk fold
    elevation += sin((pos.x * 0.085 + pos.y * 0.075) * 0.9 + time * 0.55) * 2.2;
    elevation += cos((pos.x * 0.055 - pos.y * 0.09) * 0.85 + time * 0.42) * 1.8;

    // Wave 3: Delicate high-frequency silk ripples
    elevation += sin(pos.x * 0.18 + pos.y * 0.14 + time * 0.85) * 0.9;
    elevation += cos(pos.x * 0.12 - pos.y * 0.16 + time * 0.7) * 0.7;

    // Interactive mouse parallax gentle swell
    vec2 mouseOffset = pos - mouse * 35.0;
    float dist = length(mouseOffset);
    elevation += exp(-dist * 0.06) * sin(dist * 0.2 - time * 1.2) * 1.5;

    return elevation;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Calculate displacement at current vertex
    float elev = getElevation(pos.xy, u_time, u_mouse);
    pos.z += elev;
    vElevation = elev;

    // Analytical normal approximation via finite differences
    float eps = 0.12;
    float elevX = getElevation(pos.xy + vec2(eps, 0.0), u_time, u_mouse);
    float elevY = getElevation(pos.xy + vec2(0.0, eps), u_time, u_mouse);
    vec3 tangentX = normalize(vec3(eps, 0.0, elevX - elev));
    vec3 tangentY = normalize(vec3(0.0, eps, elevY - elev));
    vec3 calculatedNormal = normalize(cross(tangentX, tangentY));

    vNormal = normalMatrix * calculatedNormal;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// GLSL Fragment Shader for Silk Wave
const silkFragmentShader = `
  uniform vec3 u_color_deep;
  uniform vec3 u_color_mid;
  uniform vec3 u_color_crest;
  uniform vec3 u_color_specular;
  uniform float u_time;
  uniform float u_opacity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vElevation;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Primary directional light from upper-left
    vec3 lightDir = normalize(vec3(-0.4, 0.6, 0.7));
    float diff = max(dot(normal, lightDir), 0.0);

    // Secondary subtle fill light from right
    vec3 fillLightDir = normalize(vec3(0.6, -0.2, 0.5));
    float fillDiff = max(dot(normal, fillLightDir), 0.0) * 0.35;

    // Specular highlight: satin / silk sheen with broad anisotropic exponent
    vec3 halfVector = normalize(lightDir + viewDir);
    float specAngle = max(dot(normal, halfVector), 0.0);
    float specular = pow(specAngle, 24.0) * 0.85;

    // Velvet / Silk Fresnel rim effect
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.65;

    // Elevation gradient mapping (-6.0 to 6.0 range)
    float t = clamp((vElevation + 4.5) / 9.0, 0.0, 1.0);
    vec3 baseColor = mix(u_color_deep, u_color_mid, smoothstep(0.1, 0.6, t));
    baseColor = mix(baseColor, u_color_crest, smoothstep(0.55, 0.95, t));

    // Combine diffuse, specular sheen, and rim lighting
    vec3 finalColor = baseColor * (0.45 + diff * 0.55 + fillDiff);
    finalColor += u_color_specular * (specular * 0.4);
    finalColor += u_color_crest * (fresnel * 0.4);

    // Vignette towards edges
    vec2 centerDist = vUv - vec2(0.5);
    float vignette = clamp(1.0 - dot(centerDist, centerDist) * 0.85, 0.25, 1.0);
    finalColor *= vignette;

    // D9: Clamp perceived luminance strictly between 8% and 22% (Rec. 709 standard)
    float lum = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
    float targetLum = clamp(lum, 0.08, 0.22);
    if (lum > 0.001) {
      finalColor = finalColor * (targetLum / lum);
    }

    gl_FragColor = vec4(finalColor, u_opacity);
  }
`;

// Color palette definitions for wallpapers
function getWallpaperPalette(theme?: string) {
  switch (theme) {
    case 'silk-midnight':
      return {
        deep: new THREE.Color(0x040814),
        mid: new THREE.Color(0x0e2a56),
        crest: new THREE.Color(0x1d4ed8),
        specular: new THREE.Color(0x60a5fa),
        gradient: 'radial-gradient(ellipse at 50% 30%, #0c1c38 0%, #050b18 55%, #020409 100%)',
      };
    case 'deep-space':
      return {
        deep: new THREE.Color(0x060514),
        mid: new THREE.Color(0x1d1145),
        crest: new THREE.Color(0x5b21b6),
        specular: new THREE.Color(0xa78bfa),
        gradient: 'radial-gradient(ellipse at 50% 30%, #1c0e3d 0%, #090517 55%, #020108 100%)',
      };
    case 'obsidian':
      return {
        deep: new THREE.Color(0x07080a),
        mid: new THREE.Color(0x161a22),
        crest: new THREE.Color(0x2f3644),
        specular: new THREE.Color(0xd1d5db),
        gradient: 'radial-gradient(ellipse at 50% 30%, #181d26 0%, #090b10 55%, #030406 100%)',
      };
    case 'aurora':
      return {
        deep: new THREE.Color(0x021312),
        mid: new THREE.Color(0x064e43),
        crest: new THREE.Color(0x0d9488),
        specular: new THREE.Color(0x5eead4),
        gradient: 'radial-gradient(ellipse at 50% 30%, #053b34 0%, #031b17 55%, #010807 100%)',
      };
    case 'wave-shader':
    default:
      return {
        deep: new THREE.Color(0x060913),
        mid: new THREE.Color(0x13274f),
        crest: new THREE.Color(0x2563eb),
        specular: new THREE.Color(0x38bdf8),
        gradient: 'radial-gradient(ellipse at 50% 35%, #0e1e3e 0%, #060a14 60%, #020307 100%)',
      };
  }
}

export default function Wallpaper({ wallpaper = 'wave-shader', hasMaximizedWindow = false }: WallpaperProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const isPausedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = !!hasMaximizedWindow;
  }, [hasMaximizedWindow]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Test WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let geometry: THREE.PlaneGeometry | null = null;

    try {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
      camera.position.set(0, -22, 16);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      
      // P9: DPR capped at 1.5 for performance budget (>= 55 fps)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      renderer.domElement.className = 'wallpaper-canvas';
      container.appendChild(renderer.domElement);

      // Create high-resolution wavy mesh
      const planeWidth = 72;
      const planeHeight = 48;
      geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 110, 80);

      const palette = getWallpaperPalette(wallpaper);

      // Uniforms for the Silk Wave shader
      const uniforms = {
        u_time: { value: 0.0 },
        u_mouse: { value: new THREE.Vector2(0.0, 0.0) },
        u_resolution: { value: new THREE.Vector2(width, height) },
        u_color_deep: { value: palette.deep },
        u_color_mid: { value: palette.mid },
        u_color_crest: { value: palette.crest },
        u_color_specular: { value: palette.specular },
        u_opacity: { value: 0.95 },
      };

      material = new THREE.ShaderMaterial({
        vertexShader: silkVertexShader,
        fragmentShader: silkFragmentShader,
        uniforms,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const plane = new THREE.Mesh(geometry, material);
      plane.rotation.x = 0.22;
      scene.add(plane);

      // Register inspection object on window for acceptance tests & diagnostics
      if (typeof window !== 'undefined') {
        (window as any).__portos_wallpaper = {
          isShaderMaterial: true,
          isWireframe: false,
          isPaused: false,
          setPaused: (p: boolean) => {
            isPausedRef.current = p;
            (window as any).__portos_wallpaper.isPaused = p;
          },
        };
      }

      // Smooth mouse coordinates tracking with spring easing
      let targetMouseX = 0;
      let targetMouseY = 0;
      let currentMouseX = 0;
      let currentMouseY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        const normX = (e.clientX / window.innerWidth) * 2 - 1;
        const normY = -(e.clientY / window.innerHeight) * 2 + 1;
        targetMouseX = normX;
        targetMouseY = normY;
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });

      // P9: Pause canvas when tab is hidden or window is maximized
      const handleVisibilityChange = () => {
        const isHidden = document.hidden;
        isPausedRef.current = isHidden || hasMaximizedWindow;
        if (typeof window !== 'undefined' && (window as any).__portos_wallpaper) {
          (window as any).__portos_wallpaper.isPaused = isPausedRef.current;
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Check if currently paused
        if (isPausedRef.current) {
          return;
        }

        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        // Smooth mouse spring interpolation
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        if (material) {
          material.uniforms.u_time.value = elapsedTime;
          material.uniforms.u_mouse.value.set(currentMouseX, currentMouseY);
        }

        renderer?.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (!container || !renderer || !material) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        material.uniforms.u_resolution.value.set(w, h);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
        geometry?.dispose();
        material?.dispose();

        if (typeof window !== 'undefined') {
          delete (window as any).__portos_wallpaper;
        }
      };
    } catch (err) {
      console.warn('Three.js Silk Wave Shader failed to initialize, using fallback:', err);
      setHasWebGL(false);
    }
  }, [wallpaper, hasMaximizedWindow]);

  const palette = getWallpaperPalette(wallpaper);

  return (
    <div
      ref={mountRef}
      className="wallpaper-container"
      id="portos-wallpaper"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        background: palette.gradient,
        transition: 'background 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {!hasWebGL && (
        <div
          className="wallpaper-fallback"
          style={{
            position: 'absolute',
            inset: 0,
            background: palette.gradient,
          }}
        />
      )}
    </div>
  );
}
