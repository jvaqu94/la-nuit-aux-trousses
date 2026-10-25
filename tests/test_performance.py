"""Test de charge de rendu : scène dense avec projectiles, particules et boss actif."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:3000"


def measure(page):
    return page.evaluate("""
    async () => {
      const frames = [];
      let last = performance.now();
      const end = last + 3000;
      return await new Promise(resolve => {
        function sample(now) {
          frames.push(now - last); last = now;
          if (now < end) return requestAnimationFrame(sample);
          const usable = frames.slice(2), avg = usable.reduce((a,b) => a+b, 0) / usable.length;
          const sorted = [...usable].sort((a,b) => a-b);
          resolve({
            fps: 1000 / avg,
            p95: sorted[Math.floor(sorted.length * .95)],
            max: Math.max(...usable),
            counts: {enemies: enemies.length, hostile: hostile.length, particles: particles.length,
              shots: shots.length, obstacles: obstacles.length}
          });
        }
        requestAnimationFrame(sample);
      });
    }
    """)


with sync_playwright() as playwright:
    executable = "/usr/bin/chromium"
    browser = playwright.chromium.launch(headless=True, executable_path=executable, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector("#playAdventure")
    page.click("#sound")
    page.click("#playAdventure")
    page.wait_for_function("state === 'play'")
    page.evaluate("""
      () => {
        stage = 4; world = worlds[4]; enemies = []; hostile = []; particles = [];
        spawnBoss(); const boss = enemies[0]; boss.y = 300; boss.phaseShield = 0;
        for (let i=0; i<260; i++) hostile.push({x:20+(i%26)*30,y:280+Math.floor(i/26)*22,
          vx:0,vy:80,type:i%2?'hex':'bone',r:7,damage:1,life:8,grazed:false,homing:false,age:0});
        for (let i=0; i<350; i++) particle(400+(i%25)*7,420+Math.floor(i/25)*7,'#c291e7',1);
        for (let i=0; i<8; i++) spawnObstacle(70+i*95,420);
      }
    """)
    result = measure(page)
    assert result["fps"] >= 40, result
    assert not errors, errors
    print("OK :", {k: round(v, 2) if isinstance(v, float) else v for k, v in result.items()})
    browser.close()
