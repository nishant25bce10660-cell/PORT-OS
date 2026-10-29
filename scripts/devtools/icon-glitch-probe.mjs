// Injected probe for measuring desktop icon glitch, style mutations, and pointer events
export const PROBE_INJECTION_SCRIPT = `
(function() {
  if (window.__iconGlitchProbeInstalled) return;
  window.__iconGlitchProbeInstalled = true;

  window.__probeData = {
    events: [],
    frameSamples: [],
    writerTraces: [],
    currentPointer: { x: 0, y: 0 },
    isRecording: false,
    actionName: '',
  };

  // 1. Pointer tracker
  window.addEventListener('pointermove', (e) => {
    window.__probeData.currentPointer.x = e.clientX;
    window.__probeData.currentPointer.y = e.clientY;
  }, { capture: true, passive: true });

  // 2. Event logger
  const TRACKED_EVENTS = [
    'pointerenter', 'pointerleave', 'pointerdown', 'pointerup',
    'pointercancel', 'lostpointercapture', 'click', 'dblclick', 'contextmenu'
  ];

  TRACKED_EVENTS.forEach((evtName) => {
    window.addEventListener(evtName, (e) => {
      const targetDesc = e.target ? (e.target.id || e.target.className || e.target.tagName) : 'null';
      const relatedDesc = e.relatedTarget ? (e.relatedTarget.id || e.relatedTarget.className || e.relatedTarget.tagName) : 'null';
      const logEntry = {
        type: evtName,
        target: targetDesc,
        relatedTarget: relatedDesc,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        pointerId: e.pointerId,
        time: performance.now(),
      };
      if (window.__probeData.isRecording) {
        window.__probeData.events.push(logEntry);
      }
    }, { capture: true, passive: true });
  });

  // 3. Style mutation / Writer trace interceptor
  const origSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function(prop, val, prio) {
    if (prop === 'transform' || prop === 'left' || prop === 'top' || prop.startsWith('--')) {
      const stack = new Error().stack || '';
      if (window.__probeData.isRecording) {
        window.__probeData.writerTraces.push({
          method: 'setProperty',
          property: prop,
          value: val,
          stack: stack.split('\\n').slice(2, 6).join(' | '),
          time: performance.now(),
        });
      }
    }
    return origSetProperty.call(this, prop, val, prio);
  };

  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, val) {
    if (name === 'style' && (val.includes('transform') || val.includes('left') || val.includes('top'))) {
      const stack = new Error().stack || '';
      if (window.__probeData.isRecording) {
        window.__probeData.writerTraces.push({
          method: 'setAttribute:style',
          property: 'style',
          value: val,
          stack: stack.split('\\n').slice(2, 6).join(' | '),
          time: performance.now(),
        });
      }
    }
    return origSetAttribute.call(this, name, val);
  };

  // 4. Frame probe loop
  function sampleFrame(now) {
    if (window.__probeData.isRecording) {
      const px = window.__probeData.currentPointer.x;
      const py = window.__probeData.currentPointer.y;
      const underEl = document.elementFromPoint(px, py);
      const underDesc = underEl ? (underEl.id || underEl.className || underEl.tagName) : 'none';

      // Query all desktop icons, pills, hitboxes
      const items = Array.from(document.querySelectorAll('.desktop-icon-item, .movable-icon, .folder-float__item, .folder-float-bridge-hitbox'));
      const itemSnapshots = items.map((el) => {
        const rect = el.getBoundingClientRect();
        const comp = window.getComputedStyle(el);
        return {
          id: el.id || el.className,
          offsetLeft: el.offsetLeft,
          offsetTop: el.offsetTop,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          transform: comp.transform,
        };
      });

      window.__probeData.frameSamples.push({
        time: now,
        underElement: underDesc,
        pointer: { x: px, y: py },
        items: itemSnapshots,
      });
    }
    requestAnimationFrame(sampleFrame);
  }
  requestAnimationFrame(sampleFrame);

  window.__startProbeRecording = function(actionName) {
    window.__probeData.isRecording = true;
    window.__probeData.actionName = actionName;
    window.__probeData.events = [];
    window.__probeData.frameSamples = [];
    window.__probeData.writerTraces = [];
  };

  window.__stopProbeRecording = function() {
    window.__probeData.isRecording = false;
    const samples = window.__probeData.frameSamples;
    const events = window.__probeData.events;
    const traces = window.__probeData.writerTraces;

    if (!samples.length) {
      return {
        basePositionDrift: 0,
        maxTransformAmplitude: 0,
        velocitySignChanges: 0,
        hoverTransitionsPerSec: 0,
        sideFlips: 0,
        elementUnderPointer: [],
        writersCount: 0,
        rawEventsCount: events.length,
      };
    }

    const first = samples[0];
    const last = samples[samples.length - 1];

    // Compute base position drift on items
    let maxDrift = 0;
    if (first && last && first.items && last.items) {
      for (const item0 of first.items) {
        const itemEnd = last.items.find((i) => i.id === item0.id);
        if (itemEnd) {
          const drift = Math.hypot(itemEnd.offsetLeft - item0.offsetLeft, itemEnd.offsetTop - item0.offsetTop);
          if (drift > maxDrift) maxDrift = drift;
        }
      }
    }

    // Compute maximum transform amplitude & velocity sign changes
    let maxAmplitude = 0;
    let signChanges = 0;
    const trackedId = first.items[0]?.id;

    if (trackedId) {
      const positions = [];
      for (const s of samples) {
        const it = s.items.find((i) => i.id === trackedId);
        if (it) positions.push({ t: s.time, x: it.rect.x, y: it.rect.y });
      }

      if (positions.length > 2) {
        const initX = positions[0].x;
        const initY = positions[0].y;
        let lastVx = 0;
        let lastVy = 0;

        for (let i = 1; i < positions.length; i++) {
          const dx = positions[i].x - initX;
          const dy = positions[i].y - initY;
          const amp = Math.hypot(dx, dy);
          if (amp > maxAmplitude) maxAmplitude = amp;

          const dt = positions[i].t - positions[i - 1].t || 16;
          const vx = (positions[i].x - positions[i - 1].x) / dt;
          const vy = (positions[i].y - positions[i - 1].y) / dt;

          if (Math.abs(vx) > 0.05 && Math.abs(lastVx) > 0.05 && Math.sign(vx) !== Math.sign(lastVx)) {
            signChanges++;
          }
          if (Math.abs(vy) > 0.05 && Math.abs(lastVy) > 0.05 && Math.sign(vy) !== Math.sign(lastVy)) {
            signChanges++;
          }
          if (Math.abs(vx) > 0.05) lastVx = vx;
          if (Math.abs(vy) > 0.05) lastVy = vy;
        }
      }
    }

    // Hover state transitions per second
    const totalSec = Math.max(0.1, (last.time - first.time) / 1000);
    const hoverEvents = events.filter((e) => e.type === 'pointerenter' || e.type === 'pointerleave');
    const hoverRate = Number((hoverEvents.length / totalSec).toFixed(2));

    // Element under pointer over time
    const underElements = Array.from(new Set(samples.map((s) => s.underElement)));

    // Side flips: check if any item crossed window.innerWidth / 2
    let sideFlips = 0;
    const midX = window.innerWidth / 2;
    if (trackedId) {
      let lastSide = null;
      for (const s of samples) {
        const it = s.items.find((i) => i.id === trackedId);
        if (it) {
          const side = it.rect.x > midX ? 'right' : 'left';
          if (lastSide && side !== lastSide) {
            sideFlips++;
          }
          lastSide = side;
        }
      }
    }

    // Distinct writers per element per second
    const distinctStacks = new Set(traces.map((t) => t.stack));
    const writersPerSec = Number((distinctStacks.size / totalSec).toFixed(2));

    return {
      basePositionDrift: Number(maxDrift.toFixed(2)),
      maxTransformAmplitude: Number(maxAmplitude.toFixed(2)),
      velocitySignChanges: signChanges,
      hoverTransitionsPerSec: hoverRate,
      sideFlips: sideFlips,
      elementUnderPointer: underElements,
      writersCount: distinctStacks.size,
      writersPerSec: writersPerSec,
      sampleFramesCount: samples.length,
      tracesCount: traces.length,
      traces: traces.slice(0, 10),
    };
  };
})();
`;
