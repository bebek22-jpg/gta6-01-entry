// Solmar Heat — the HUD: money, wanted stars, health, mission objective,
// speedometer, clock, dialogs and banners, all as DOM over the 3D view.

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['money', 'stars', 'health-fill', 'objective', 'speed', 'clock', 'location', 'dialog', 'dialog-speaker', 'dialog-text', 'banner', 'banner-title', 'banner-sub', 'help', 'crosshair', 'wasted-note']) {
      this.el[id] = document.getElementById(id);
    }
    this.bannerTimer = 0;
    this.lastMoney = -1;
    this.lastStars = -1;
    this.lastObjective = '';
  }

  setMoney(amount) {
    const v = Math.floor(amount);
    if (v === this.lastMoney) return;
    this.lastMoney = v;
    this.el.money.textContent = `$${v.toLocaleString('en-US')}`;
  }

  setStars(stars) {
    if (stars === this.lastStars) return;
    this.lastStars = stars;
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="star${i < stars ? ' lit' : ''}">★</span>`;
    }
    this.el.stars.innerHTML = html;
    this.el.stars.classList.toggle('hot', stars > 0);
  }

  setHealth(health, max) {
    const pct = Math.max(0, Math.min(100, (health / max) * 100));
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-fill'].classList.toggle('low', pct < 30);
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.el.objective.textContent = text;
    this.el.objective.style.display = text ? 'block' : 'none';
  }

  setSpeed(kmh, driving) {
    this.el.speed.style.display = driving ? 'block' : 'none';
    if (driving) this.el.speed.textContent = `${Math.round(kmh)} km/h`;
  }

  setClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  setLocation(name) {
    this.el.location.textContent = name;
  }

  setDialog(dialog) {
    if (!dialog) {
      this.el.dialog.style.display = 'none';
      return;
    }
    this.el['dialog-speaker'].textContent = dialog[0];
    this.el['dialog-text'].textContent = dialog[1];
    this.el.dialog.style.display = 'block';
  }

  showBanner(title, sub, seconds = 3.5) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.style.display = 'block';
    this.bannerTimer = seconds;
  }

  hideBanner() {
    this.el.banner.style.display = 'none';
    this.bannerTimer = 0;
  }

  setCrosshair(show) {
    this.el.crosshair.style.display = show ? 'block' : 'none';
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }
  }
}
