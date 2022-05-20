export
const Spring =
    class Spring {
      constructor(p1 = null, p2 = null, ks = 0, kd = 0, len = 0) {
        this.particle_1 = p1;
        this.particle_2 = p2;
        this.ks = ks;
        this.kd = kd;
        this.rest_length = len;
      }

      // Update by satisfying constraints
      update() {
        let d_ij = this.particle_2.pos.minus(this.particle_1.pos);

        let correction = d_ij.times(1 - this.rest_length/d_ij.norm()).times(0.5);

        if (!this.particle_1.isFixed) this.particle_1.pos.add_by(correction);
        if (!this.particle_2.isFixed) this.particle_2.pos.subtract_by(correction);
      }


      // Update using viscoelastic forces
      update2() {
        const fe_ij = this._calculate_viscoelastic_forces();
        this.particle_1.ext_force.add_by(fe_ij);
        this.particle_2.ext_force.subtract_by(fe_ij);
      }

      _calculate_viscoelastic_forces() {
        let d_ij = this.particle_2.pos.minus(this.particle_1.pos);
        let v_ij = this.particle_1.vel.minus(this.particle_2.vel);

        let fs_ij = d_ij.times(this.ks * (d_ij.norm() - this.rest_length));
        let fd_ij = d_ij.times(-1 * this.kd * v_ij.dot(d_ij));

        return fs_ij.plus(fd_ij);
      }
    };