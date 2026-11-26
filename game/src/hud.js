// The cockpit: DOM readouts for altitude, speed, heading, fuel, damage and score, plus
// two drawn instruments — an artificial horizon and a compass tape — painted each frame.
import { headingDegrees } from './physics.js';
import { currentLeg, nextRing, ringsRemaining } from './missions.js';
import { groundHeight } from './terrain.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;
const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function pad3(n) {
  return String(Math.round(n)).padStart(3, '0');
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    alt: $('alt'), agl: $('agl'), spd: $('spd'), vspeed: $('vspeed'),
    hdg: $('hdg'), hdgName: $('hdg-name'), score: $('score'), clock: $('clock'),
    fuelFill: $('fuel-fill'), dmgFill: $('dmg-fill'), thrFill: $('thr-fill'), thrPct: $('thr-pct'),
    legLabel: $('leg-label'), objective: $('objective-text'), objectiveSub: $('objective-sub'),
    flaps: $('flaps'), gear: $('gear'), message: $('message'),
    horizon: $('horizon'), compass: $('compass'), status: $('status'),
  };
  const hctx = els.horizon.getContext('2d');
  const cctx = els.compass.getContext('2d');

  function drawHorizon(pitch, roll) {
    const W = 296;
    const H = 296;
    const cx = W / 2;
    const cy = H / 2;
    const R = 140;
    hctx.clearRect(0, 0, W, H);
    hctx.save();
    hctx.beginPath();
    hctx.arc(cx, cy, R, 0, Math.PI * 2);
    hctx.clip();
    // Sky and ground, rotated by bank and shifted by pitch.
    // Coordinates here are relative to the instrument centre, horizon at y = -pitchPx.
    hctx.translate(cx, cy);
    hctx.rotate(-roll);
    const pitchPx = pitch * 260;
    hctx.fillStyle = '#3f7ec2';
    hctx.fillRect(-R - 10, -R - 10, R * 2 + 20, R + 10 - pitchPx);
    hctx.fillStyle = '#6b4a2a';
    hctx.fillRect(-R - 10, -pitchPx, R * 2 + 20, R + 10 + pitchPx);
    // Pitch ladder.
    hctx.strokeStyle = 'rgba(255,255,255,0.85)';
    hctx.lineWidth = 2;
    for (const deg of [-20, -10, 10, 20]) {
      const y = -pitchPx - (deg * Math.PI / 180) * 260;
      const half = 42;
      hctx.beginPath();
      hctx.moveTo(-half, y);
      hctx.lineTo(half, y);
      hctx.stroke();
    }
    // Horizon line.
    hctx.strokeStyle = '#ffffff';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(-R - 10, -pitchPx);
    hctx.lineTo(R + 10, -pitchPx);
    hctx.stroke();
    hctx.restore();
    // Fixed aircraft symbol: wings and nose dot.
    hctx.strokeStyle = '#ffd23e';
    hctx.lineWidth = 5;
    hctx.beginPath();
    hctx.moveTo(cx - 52, cy);
    hctx.lineTo(cx - 12, cy);
    hctx.moveTo(cx + 12, cy);
    hctx.lineTo(cx + 52, cy);
    hctx.stroke();
    hctx.fillStyle = '#ffd23e';
    hctx.beginPath();
    hctx.arc(cx, cy, 5, 0, Math.PI * 2);
    hctx.fill();
    // Roll pointer at the top.
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(-roll);
    hctx.fillStyle = '#ffffff';
    hctx.beginPath();
    hctx.moveTo(0, -R + 4);
    hctx.lineTo(-7, -R + 16);
    hctx.lineTo(7, -R + 16);
    hctx.closePath();
    hctx.fill();
    hctx.restore();
  }

  function drawCompass(heading) {
    const W = 520;
    const H = 104;
    cctx.clearRect(0, 0, W, H);
    cctx.fillStyle = 'rgba(8,20,32,0.55)';
    cctx.fillRect(0, 0, W, H);
    const pxPerDeg = 4;
    const centre = W / 2;
    cctx.font = 'bold 26px system-ui, sans-serif';
    cctx.textAlign = 'center';
    for (let d = -70; d <= 70; d += 5) {
      const h = Math.round((heading + d + 360) % 360);
      const x = centre + d * pxPerDeg;
      const major = h % 30 === 0;
      cctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.45)';
      cctx.lineWidth = major ? 3 : 1.5;
      cctx.beginPath();
      cctx.moveTo(x, 14);
      cctx.lineTo(x, major ? 40 : 30);
      cctx.stroke();
      if (major) {
        cctx.fillStyle = '#ffffff';
        const label = h % 90 === 0 ? COMPASS_POINTS[h / 22.5] : String(h).padStart(3, '0');
        cctx.fillText(label, x, 74);
      }
    }
    // Centre marker.
    cctx.fillStyle = '#ffb02e';
    cctx.beginPath();
    cctx.moveTo(centre - 8, 0);
    cctx.lineTo(centre + 8, 0);
    cctx.lineTo(centre, 14);
    cctx.closePath();
    cctx.fill();
    cctx.fillStyle = '#ffb02e';
    cctx.font = 'bold 24px system-ui, sans-serif';
    cctx.fillText(`${pad3(heading)}°`, centre, 100);
  }

  let messageTimer = 0;

  return {
    draw(state, mission) {
      const hdg = headingDegrees(state);
      const aglFt = Math.max(0, (state.pos.y - groundHeight(state.pos.x, state.pos.z)) * M_TO_FT);
      els.alt.textContent = Math.round(state.pos.y * M_TO_FT).toLocaleString('en-US');
      els.agl.textContent = `AGL ${Math.round(aglFt).toLocaleString('en-US')} ft`;
      els.spd.textContent = Math.round(state.speed * MS_TO_KT);
      const vsFpm = Math.round(state.verticalSpeed * M_TO_FT * 60);
      els.vspeed.textContent = `V/S ${vsFpm >= 0 ? '+' : ''}${vsFpm.toLocaleString('en-US')} fpm`;
      els.hdg.textContent = pad3(hdg);
      els.hdgName.textContent = COMPASS_POINTS[Math.round(hdg / 22.5) % 16];
      els.score.textContent = mission.score.toLocaleString('en-US');
      els.clock.textContent = fmtTime(mission.elapsed);
      els.fuelFill.style.width = `${state.fuel}%`;
      els.fuelFill.style.background = state.fuel < 20 ? '#e5484d' : '#37c978';
      els.dmgFill.style.width = `${state.damage}%`;
      els.dmgFill.style.background = state.damage > 60 ? '#e5484d' : '#ffb02e';
      els.thrFill.style.width = `${Math.round(state.throttle * 100)}%`;
      els.thrPct.textContent = `${Math.round(state.throttle * 100)}%`;
      els.flaps.textContent = state.flaps ? 'DOWN' : 'UP';
      els.gear.textContent = state.gearDown ? 'DOWN' : 'UP';
      const leg = currentLeg(mission);
      els.legLabel.textContent = mission.complete ? 'Route complete' : leg.name;
      if (mission.complete) {
        els.objective.textContent = 'All three legs flown — well done, courier.';
        els.objectiveSub.textContent = 'Press R to fly the route again';
      } else {
        const ring = nextRing(mission);
        els.objective.textContent = ring
          ? `Fly the rings, then land at ${leg.to.name}`
          : `Land at ${leg.to.name} — all rings flown`;
        els.objectiveSub.textContent = ring
          ? `Ring ${mission.ringIndex + 1} of ${mission.rings.length} · ${Math.round(Math.hypot(ring.x - state.pos.x, ring.y - state.pos.y, ring.z - state.pos.z))} m ahead · Deliver to ${leg.to.name}`
          : `Rings done · ${leg.to.name} ahead — put her down gently`;
      }
      drawHorizon(state.pitch, state.roll);
      drawCompass(hdg);
      if (messageTimer > 0) {
        messageTimer -= 1;
        if (messageTimer === 0) els.message.style.display = 'none';
      }
    },
    flash(html, seconds = 2.5) {
      els.message.innerHTML = html;
      els.message.style.display = 'block';
      messageTimer = Math.round(seconds * 60);
    },
    announce(text) {
      els.status.textContent = text;
    },
  };
}
