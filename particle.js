import {tiny} from './tiny-graphics.js';

// Pull these names into this module's scope for convenience:
const { vec3 } = tiny;

export
const Particle =
    class Particle {
      constructor(m = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0) {
        this.mass = m;
        this.pos = vec3(x, y, z);
        this.vel = vec3(vx, vy, vz);
        this.acc = vec3(0, 0, 0);
        this.ext_force = vec3(0, 0, 0);
        this.prev_pos = this.pos.minus(this.vel.times(0.001));
        this.isFixed = false;
      }

      // Update using simplified+damped verlet integration method
      update(dt) {
        const damping = 0.01;

        if (!this.isFixed) {
          this.acc = this.ext_force; //.times(1 / this.mass);

          let curr_pos = this.pos.copy();
          this.pos = this.pos
              .plus((this.pos.minus(this.prev_pos)).times(1 - damping))
              .plus(this.acc.times(dt**2));
          this.prev_pos = curr_pos;
          this.acc = vec3(0, 0, 0); // reset acceleration
        }
      }


      // Update using symplectic integration method
      update2(dt) {
        if (!this.isFixed) {
          this.acc = this.ext_force.times(1 / this.mass);
          this.vel = this.vel.plus(this.acc.times(dt));
          this.pos = this.pos.plus(this.vel.times(dt));
        }
      }
    };