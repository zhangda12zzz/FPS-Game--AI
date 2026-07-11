import { PLAYER } from '../core/Constants.js';
import { eventBus } from '../core/EventBus.js';

export class Health {
  constructor() {
    this.maxHealth = PLAYER.MAX_HEALTH;
    this.health = this.maxHealth;
    this.isDead = false;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    eventBus.emit('player:healthChange', { health: this.health, maxHealth: this.maxHealth });
    eventBus.emit('player:damage', { amount });
    eventBus.emit('player:damaged', { amount });
    if (this.health <= 0) {
      this.isDead = true;
      eventBus.emit('player:death');
      eventBus.emit('player:died');
    }
  }

  heal(amount) {
    if (this.isDead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    eventBus.emit('player:healthChange', { health: this.health, maxHealth: this.maxHealth });
  }

  reset() {
    this.health = this.maxHealth;
    this.isDead = false;
    eventBus.emit('player:healthChange', { health: this.health, maxHealth: this.maxHealth });
  }
}
