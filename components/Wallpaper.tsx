'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface WallpaperProps {
  wallpaper?: string;
  customImageUrl?: string;
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

  // Smooth Gerstner-harmonic silk wave displacement
  float getElevation(vec2 pos, float time, vec2 mouse) {
    float elevation = 0.0;
    
    // Wave 1: Gentle primary silk swell
    float w1 = sin(pos.x * 0.045 + pos.y * 0.035 + time * 0.32);
    elevation += w1 * 3.4;

    // Wave 2: Diagonal rolling silk fold
    float w2 = cos(pos.x * 0.065 - pos.y * 0.055 + time * 0.42);
    elevation += w2 * 2.1;

    // Wave 3: Delicate micro-ripple harmonic
    float w3 = sin((pos.x * 0.08 + pos.y * 0.09) * 1.1 + time * 0.6);
    elevation += w3 * 0.85;

    // Smooth pointer parallax deflection (soft Gaussian without jarring ripple oscillation)
    vec2 mPos = mouse * 30.0;
    float dist = length(pos - mPos);
    float mouseSwell = exp(-dist * 0.045) * 1.8;
    elevation += mouseSwell;

    return elevation;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Calculate displacement at current vertex
    float elev = getElevation(pos.xy, u_time, u_mouse);
    pos.z += elev;
    vElevation = elev;

    // Analytical finite-difference normal calculation
    float eps = 0.08;
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
    vec3 lightDir = normalize(vec3(-0.45, 0.65, 0.6));
    float diff = max(dot(normal, lightDir), 0.0);

    // Secondary soft ambient fill light
    vec3 fillLightDir = normalize(vec3(0.5, -0.2, 0.4));
    float fillDiff = max(dot(normal, fillLightDir), 0.0) * 0.28;

    // Anisotropic silk specular sheen
    vec3 halfVector = normalize(lightDir + viewDir);
    float specAngle = max(dot(normal, halfVector), 0.0);
    float specular = pow(specAngle, 36.0) * 0.55;

    // Velvet/Silk Fresnel rim sheen along silhouette grazing angles
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8) * 0.45;

    // Elevation gradient mapping (-5.5 to 5.5 range)
    float t = clamp((vElevation + 4.0) / 8.0, 0.0, 1.0);
    vec3 baseColor = mix(u_color_deep, u_color_mid, smoothstep(0.08, 0.55, t));
    baseColor = mix(baseColor, u_color_crest, smoothstep(0.5, 0.95, t));

    // Combine diffuse, specular sheen, and rim lighting
    vec3 finalColor = baseColor * (0.4 + diff * 0.55 + fillDiff);
    finalColor += u_color_specular * (specular * 0.4);
    finalColor += u_color_crest * (fresnel * 0.35);

    // Vignette towards edges
    vec2 centerDist = vUv - vec2(0.5);
    float vignette = clamp(1.0 - dot(centerDist, centerDist) * 0.75, 0.35, 1.0);
    finalColor *= vignette;

    // Filmic tone compression (eliminates bright cyan spikes & clipped highlights)
    finalColor = finalColor / (vec3(1.0) + finalColor * 0.65);

    // Rec. 709 safe contrast shaping with luminance clamping (8% - 22%)
    float lum = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
    float targetLum = clamp(lum, 0.08, 0.22);
    finalColor = finalColor * (targetLum / max(lum, 0.001));
    finalColor = mix(finalColor, vec3(targetLum), 0.05);

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

export default function Wallpaper({ wallpaper = 'wave-shader', customImageUrl, hasMaximizedWindow = false }: WallpaperProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const isPausedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = !!hasMaximizedWindow;
  }, [hasMaximizedWindow]);

  // Tab visibility detection to pause shader loop when hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        isPausedRef.current = true;
      } else {
        isPausedRef.current = !!hasMaximizedWindow;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [hasMaximizedWindow]);

  useEffect(() => {
    if (customImageUrl) {
      // Custom image selected: bypass Three.js shader
      return;
    }

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
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let material: THREE.ShaderMaterial;
    let mesh: THREE.Mesh;

    const palette = getWallpaperPalette(wallpaper);

    try {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 48);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.domElement.className = 'wallpaper-canvas';
      renderer.domElement.id = 'wallpaper-canvas';
      container.appendChild(renderer.domElement);

      // Plane geometry for silk wave
      const geometry = new THREE.PlaneGeometry(90, 60, 96, 64);

      material = new THREE.ShaderMaterial({
        vertexShader: silkVertexShader,
        fragmentShader: silkFragmentShader,
        uniforms: {
          u_time: { value: 0 },
          u_mouse: { value: new THREE.Vector2(0, 0) },
          u_resolution: { value: new THREE.Vector2(width, height) },
          u_color_deep: { value: palette.deep },
          u_color_mid: { value: palette.mid },
          u_color_crest: { value: palette.crest },
          u_color_specular: { value: palette.specular },
          u_opacity: { value: 1.0 },
        },
        wireframe: false,
      });

      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      if (typeof window !== 'undefined') {
        (window as any).__portos_wallpaper = {
          isShaderMaterial: true,
          isWireframe: false,
          isPaused: false,
          renderer,
          material,
        };
      }

      // Mouse parallax with smooth damping
      const targetMouse = new THREE.Vector2(0, 0);
      const currentMouse = new THREE.Vector2(0, 0);

      const handlePointerMove = (e: PointerEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -(e.clientY / window.innerHeight) * 2 + 1;
        targetMouse.set(nx, ny);
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });

      // Resize handler
      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        material.uniforms.u_resolution.value.set(w, h);
      };

      window.addEventListener('resize', handleResize);

      // Animation loop
      let lastTime = performance.now();
      let accumulatedTime = 0;

      const animate = (now: number) => {
        animationFrameId = requestAnimationFrame(animate);

        if (isPausedRef.current) return;

        const delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        accumulatedTime += delta;

        // Smooth damping towards mouse position
        currentMouse.lerp(targetMouse, 0.05);

        material.uniforms.u_time.value = accumulatedTime;
        material.uniforms.u_mouse.value.copy(currentMouse);

        renderer.render(scene, camera);
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__portos_wallpaper;
        }
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('resize', handleResize);
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
        geometry.dispose();
        material.dispose();
      };
    } catch {
      setHasWebGL(false);
    }
  }, [wallpaper, customImageUrl]);

  const palette = getWallpaperPalette(wallpaper);

  if (customImageUrl) {
    return (
      <div
        className="wallpaper-canvas-container"
        id="desktop-wallpaper-container"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${customImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <div
      ref={mountRef}
      className="wallpaper-canvas-container"
      id="desktop-wallpaper-container"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: palette.gradient,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {!hasWebGL && (
        <div
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
