import * as CANNON from 'cannon-es';
import { PHYSICS } from './Constants.js';

export class Physics {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, PHYSICS.GRAVITY, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    // 默认材质
    this.groundMaterial = new CANNON.Material('ground');
    this.playerMaterial = new CANNON.Material('player');
    const contactMaterial = new CANNON.ContactMaterial(
      this.groundMaterial, this.playerMaterial,
      { friction: 0.1, restitution: 0 }
    );
    this.world.addContactMaterial(contactMaterial);

    this.bodies = [];
  }

  addBody(body) {
    this.world.addBody(body);
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
    this.bodies = this.bodies.filter(b => b !== body);
  }

  createBox(size, position, material, mass = 0) {
    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({ mass, material: material || this.groundMaterial });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    this.world.addBody(body);
    this.bodies.push(body);
    return body;
  }

  update(dt) {
    this.world.step(PHYSICS.FIXED_TIMESTEP, dt, 3);
  }
}
