/**
 * Procedural Video Canvas Generators for reliable, offline, zero-CORS video clips.
 * Provides high-aesthetic animated footage: Cyber City, Ocean Sunset, Cosmic Aurora, Neon Grid.
 */

export function renderProceduralFrame(
  ctx: CanvasRenderingContext2D,
  type: string,
  time: number,
  width: number,
  height: number
) {
  ctx.save();

  switch (type) {
    case 'cyber-city': {
      // Dark dusk gradient sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#090a15');
      skyGrad.addColorStop(0.6, '#2a1147');
      skyGrad.addColorStop(1, '#ff5e62');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Glowing Sun/Moon setting
      const sunY = height * 0.55 + Math.sin(time * 0.2) * 10;
      const sunGrad = ctx.createRadialGradient(width * 0.5, sunY, 10, width * 0.5, sunY, width * 0.25);
      sunGrad.addColorStop(0, '#ff9966');
      sunGrad.addColorStop(0.4, '#ff5e62');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.5, sunY, width * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Cyber grid lines moving towards horizon
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 1.5;
      const horizonY = height * 0.65;
      
      // Horizontal perspective grid
      const gridOffset = (time * 40) % 25;
      for (let y = horizonY; y < height; y += 12) {
        const perspectiveY = horizonY + Math.pow((y - horizonY) / (height - horizonY), 2.2) * (height - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, perspectiveY + gridOffset * 0.3);
        ctx.lineTo(width, perspectiveY + gridOffset * 0.3);
        ctx.stroke();
      }

      // Skyline buildings
      const numBuildings = 14;
      const bWidth = width / numBuildings;
      for (let i = 0; i < numBuildings; i++) {
        const bHeight = 80 + Math.sin(i * 133.7) * 60 + Math.cos(i * 45) * 40;
        const bx = i * bWidth;
        const by = horizonY - bHeight;
        
        ctx.fillStyle = '#0d0b18';
        ctx.fillRect(bx, by, bWidth - 2, bHeight + 40);

        // Building windows flickering
        ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
        for (let wy = by + 10; wy < horizonY; wy += 14) {
          if ((Math.sin(i * 10 + wy + time * 2) > 0.1)) {
            ctx.fillRect(bx + 4, wy, 4, 6);
          }
          if ((Math.cos(i * 7 + wy) > 0.2)) {
            ctx.fillRect(bx + bWidth - 10, wy, 4, 6);
          }
        }
      }
      break;
    }

    case 'ocean-waves': {
      // Golden Hour Sunset & Rolling Ocean Waves
      const sky = ctx.createLinearGradient(0, 0, 0, height * 0.55);
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(0.5, '#ea580c');
      sky.addColorStop(1, '#fde047');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height * 0.55);

      // Sun reflection
      const sunGrad = ctx.createRadialGradient(width * 0.65, height * 0.4, 15, width * 0.65, height * 0.4, 90);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.3, '#fef08a');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.65, height * 0.4, 90, 0, Math.PI * 2);
      ctx.fill();

      // Deep sea
      const seaGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
      seaGrad.addColorStop(0, '#0f766e');
      seaGrad.addColorStop(1, '#022c22');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      // Wave layers
      for (let w = 0; w < 4; w++) {
        ctx.fillStyle = `rgba(13, 148, 136, ${0.4 - w * 0.08})`;
        ctx.beginPath();
        const baseWaveY = height * 0.58 + w * 25;
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseWaveY);
        for (let x = 0; x <= width; x += 20) {
          const waveY = baseWaveY + Math.sin(x * 0.015 + time * 2 + w * 1.5) * (8 + w * 4);
          ctx.lineTo(x, waveY);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'cosmic-aurora': {
      // Deep Space nebula with stars and glowing aurora ribbons
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      // Starfield
      for (let s = 0; s < 60; s++) {
        const sx = ((s * 197.3) % width);
        const sy = ((s * 311.7) % height);
        const brightness = 0.3 + 0.7 * Math.sin(time * 3 + s);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, brightness)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, (s % 3 === 0) ? 1.8 : 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Aurora flowing wave 1
      const grad1 = ctx.createLinearGradient(0, 0, width, height);
      grad1.addColorStop(0, 'rgba(16, 185, 129, 0)');
      grad1.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
      grad1.addColorStop(1, 'rgba(139, 92, 246, 0.3)');

      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.2);
      for (let x = 0; x <= width; x += 30) {
        const y = height * 0.35 + Math.sin(x * 0.008 + time * 1.5) * 60 + Math.cos(x * 0.02 - time) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height * 0.8);
      ctx.lineTo(0, height * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'neon-abstract': {
      // Minimal geometric neon rings rotating in 3D
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.32;

      ctx.save();
      ctx.translate(cx, cy);

      for (let r = 0; r < 5; r++) {
        ctx.save();
        ctx.rotate(time * (0.4 + r * 0.2) * (r % 2 === 0 ? 1 : -1));
        ctx.strokeStyle = r % 2 === 0 ? '#38bdf8' : '#f43f5e';
        ctx.lineWidth = 3 - r * 0.4;
        ctx.shadowColor = r % 2 === 0 ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        const rSize = radius * (1 - r * 0.16);
        ctx.ellipse(0, 0, rSize, rSize * 0.6, (r * Math.PI) / 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      break;
    }

    case 'stickman-combat': {
      // High-Octane Stickman Fight inspired by Alan Becker & Hyun's Dojo
      ctx.fillStyle = '#080a10';
      ctx.fillRect(0, 0, width, height);

      // Arena floor and distant dojo / tech arena lighting
      const groundY = height * 0.75;
      const arenaGrad = ctx.createLinearGradient(0, groundY, 0, height);
      arenaGrad.addColorStop(0, '#111827');
      arenaGrad.addColorStop(1, '#030712');
      ctx.fillStyle = arenaGrad;
      ctx.fillRect(0, groundY, width, height - groundY);

      // Ground highlight line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Speedlines for high velocity impact
      const actionCycle = (time * 2) % 6; // 6 second loop
      if (actionCycle > 2 && actionCycle < 3.5) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const sy = height * 0.2 + (i * 45 + time * 120) % (height * 0.5);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(width, sy);
          ctx.stroke();
        }
      }

      // Fighter 1 (Hero - Blue Cyan)
      const f1BaseX = width * 0.38 + Math.sin(time * 3) * 40;
      const f2BaseX = width * 0.62 - Math.sin(time * 3) * 40;

      // Helper to draw a stickman fighter
      const drawStickman = (
        bx: number,
        by: number,
        color: string,
        facingRight: boolean,
        poseType: 'attack' | 'kick' | 'block'
      ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        const dir = facingRight ? 1 : -1;
        const headRadius = 14;
        const torsoLen = 45;

        // Head
        const headY = by - torsoLen - headRadius * 2;
        ctx.beginPath();
        ctx.arc(bx, headY, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        const pelvisY = by - 35;
        const chestY = by - torsoLen;
        ctx.beginPath();
        ctx.moveTo(bx, headY + headRadius);
        ctx.lineTo(bx + dir * 6, pelvisY);
        ctx.stroke();

        if (poseType === 'attack') {
          // Punch / Sword Slash
          ctx.beginPath();
          ctx.moveTo(bx, chestY);
          ctx.lineTo(bx + dir * 30, chestY - 10);
          ctx.lineTo(bx + dir * 65, chestY + 5);
          ctx.stroke();

          // Sword blade with energy glow
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx + dir * 65, chestY + 5);
          ctx.lineTo(bx + dir * 110, chestY - 25);
          ctx.stroke();

          // Glowing slash trail arc
          ctx.strokeStyle = color;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(bx + dir * 50, chestY, 60, -0.6 * Math.PI, 0.2 * Math.PI, !facingRight);
          ctx.stroke();

          // Legs
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx - dir * 25, groundY);
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx + dir * 35, groundY);
          ctx.stroke();
        } else if (poseType === 'kick') {
          // Flying High Kick
          ctx.beginPath();
          // One leg kicked high
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx + dir * 45, pelvisY - 20);
          ctx.lineTo(bx + dir * 85, pelvisY - 30);
          // Base support leg
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx - dir * 20, groundY);
          ctx.stroke();

          // Guard arms
          ctx.beginPath();
          ctx.moveTo(bx, chestY);
          ctx.lineTo(bx - dir * 15, chestY - 15);
          ctx.lineTo(bx + dir * 10, chestY - 25);
          ctx.stroke();
        } else {
          // Block / Defense pose
          ctx.beginPath();
          ctx.moveTo(bx, chestY);
          ctx.lineTo(bx + dir * 20, chestY - 15);
          ctx.lineTo(bx + dir * 25, chestY + 15);
          ctx.stroke();

          // Legs crouched
          ctx.beginPath();
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx - dir * 25, by - 15);
          ctx.lineTo(bx - dir * 35, groundY);
          ctx.moveTo(bx + dir * 6, pelvisY);
          ctx.lineTo(bx + dir * 15, by - 15);
          ctx.lineTo(bx + dir * 20, groundY);
          ctx.stroke();
        }

        ctx.restore();
      };

      // Alternate action poses based on time
      const f1Pose = actionCycle < 2 ? 'attack' : actionCycle < 4 ? 'kick' : 'block';
      const f2Pose = f1Pose === 'attack' ? 'block' : f1Pose === 'kick' ? 'block' : 'attack';

      // Draw Hero (Cyan)
      drawStickman(f1BaseX, groundY, '#38bdf8', true, f1Pose);

      // Draw Rival (Crimson)
      drawStickman(f2BaseX, groundY, '#f43f5e', false, f2Pose);

      // Clash Impact Sparks at the center
      const clashDist = Math.abs(f1BaseX - f2BaseX);
      if (clashDist < 120) {
        const clashX = (f1BaseX + f2BaseX) / 2;
        const clashY = groundY - 45;

        // Expanding shockwave circle
        const waveR = ((time * 80) % 50);
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - waveR / 50})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(clashX, clashY, waveR, 0, Math.PI * 2);
        ctx.stroke();

        // Star sparks
        ctx.fillStyle = '#fef08a';
        for (let sp = 0; sp < 6; sp++) {
          const ang = sp * (Math.PI / 3) + time * 5;
          const sx = clashX + Math.cos(ang) * (waveR * 0.8);
          const sy = clashY + Math.sin(ang) * (waveR * 0.8);
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      break;
    }

    case 'studio-minimal': {
      // High-End Modern Studio Presentation Backdrop
      const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 50, width * 0.5, height * 0.5, width * 0.7);
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(0.6, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Elegant ambient spotlight cone
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.beginPath();
      ctx.moveTo(width * 0.5, 0);
      ctx.lineTo(width * 0.15, height);
      ctx.lineTo(width * 0.85, height);
      ctx.closePath();
      ctx.fill();

      // Subtle metallic floor reflection line
      const flY = height * 0.78;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, flY);
      ctx.lineTo(width * 0.9, flY);
      ctx.stroke();
      break;
    }

    default: {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.restore();
}
