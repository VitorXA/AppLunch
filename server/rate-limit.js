// Limitador de tentativas em memória (suficiente para uma instância única).
// Se rodar mais de uma instância, troque por Redis ou similar.
export class RateLimiter {
  #hits = new Map();

  /** Registra uma tentativa. Retorna false quando o limite foi excedido. */
  hit(key, max, windowMs, now = Date.now()) {
    this.#sweep(now);
    const entry = this.#hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.#hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  }

  reset(key) {
    this.#hits.delete(key);
  }

  #sweep(now) {
    if (this.#hits.size < 5000) return;
    for (const [key, entry] of this.#hits) if (entry.resetAt <= now) this.#hits.delete(key);
  }
}
