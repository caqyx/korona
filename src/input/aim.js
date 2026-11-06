/** Auto-aim: najbliższy sensowny cel dla gracza. Zwraca punkt w świecie. */
export function autoAim(state, me) {
  if (!me) return [0, 0];
  if (me.boss) {
    let best = null;
    let bd = Infinity;
    for (const h of state.players) {
      if (h.boss || !h.alive || h.ai) continue;
      if (h.hidden && Math.hypot(h.x - me.x, h.y - me.y) > 2.5) continue;
      const d = Math.hypot(h.x - me.x, h.y - me.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best ? [best.x, best.y] : [me.x + me.fx, me.y + me.fy];
  }
  const boss = state.players.find((p) => p.boss && !p.boss.dying);
  let tx = boss ? boss.x : state.crown.x;
  let ty = boss ? boss.y : state.crown.y;
  let bd = boss ? Math.hypot(tx - me.x, ty - me.y) : Infinity;
  // bez bossa (fale) — najbliższy wróg; z bossem — wróg tylko, gdy jest bardzo blisko
  const near = boss ? 2.5 : Infinity;
  for (const m of state.minions || []) {
    const d = Math.hypot(m.x - me.x, m.y - me.y);
    if (d < near && d < bd) {
      bd = d;
      tx = m.x;
      ty = m.y;
    }
  }
  return [tx, ty];
}
