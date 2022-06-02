import {Particle} from "./particle.js";
import {Spring} from "./spring.js";
import {tiny} from "./tiny-graphics.js";

const { vec3, vec4, color, Mat4 } = tiny;

export
const Cloth_Simulation =
    // Cloth implementation largely based on Jesper Mosegaards's tutorial at
    // https://viscomp.alexandra.dk/index2fa7.html?p=147
    class Cloth_Simulation {
      constructor(width, height, n, m, offset) {
        this.width = width;
        this.height = height;
        this.n = n;
        this.m = m;
        this.offset = offset;

        this.particles = [...Array(n)].map(() => Array(m)); // initialize n x m array
        this.springs = [];
        this.g_acc = vec3(0, -9.8, 0);
        this.ground_ks = 500;
        this.ground_kd = 10;
      }

      initialize(mass, ks, kd, orientation="xy") {
        let dx = 0, dy = 0, dz = 0;
        switch (orientation) {
          case "xy":
            dx = this.width / (this.m - 1);
            dy = this.height / (this.n - 1);
            break;
          case "yz":
            dy = this.height / (this.n - 1);
            dz = this.width / (this.m - 1);
            break;
        }

        // Given 0 offset, initialize particles in n x m grid from (0, height, 0) to...
        //     (width, 0, 0) if parallel to xy plane
        //     (0, 0, width) if parallel to yz plane
        for (let i = 0; i < this.n; ++i) {
          for (let j = 0; j < this.m; ++j) {
            this.particles[i][j] = new Particle(
                mass,
                j*dx + this.offset[0], this.height - i*dy + this.offset[1], j*dz + this.offset[2],
                0, 0, 0
            );
          }
        }

        // Add springs between immediate neighbor particles.
        let horiz_len = (orientation === "xy") ? dx : dz;
        let diag_len = Math.sqrt(dx**2 + dy**2 + dz**2);
        let diag2_len = 2*Math.sqrt(dx**2 + dy**2 + dz**2);
        for (let i = 0; i < this.n; ++i) {
          for (let j = 0; j < this.m; ++j) {
            // Add structural constraints
            if (i < this.n - 1) this._add_spring(i, j, i + 1, j, ks, kd, horiz_len);
            if (j < this.m - 1) this._add_spring(i, j, i, j + 1, ks, kd, horiz_len);

            // Add shear constraints
            if (i < this.n - 1 && j < this.m - 1) {
              this._add_spring(i, j, i + 1, j + 1, ks, kd, diag_len);
              this._add_spring(i + 1, j, i, j + 1, ks, kd, diag_len);
            }

            // Add bending constraints
            if (i < this.n - 2) this._add_spring(i, j, i + 2, j, ks, kd, 2*horiz_len);
            if (j < this.m - 2) this._add_spring(i, j, i, j + 2, ks, kd, 2*horiz_len);
            if (i < this.n - 2 && j < this.m - 2) {
              this._add_spring(i, j, i + 2, j + 2, ks, kd, diag2_len);
              this._add_spring(i + 2, j, i, j + 2, ks, kd, diag2_len);
            }
          }
        }
      }

      _add_spring(i1, j1, i2, j2, ks, kd, len) {
        let s = new Spring(this.particles[i1][j1], this.particles[i2][j2], ks, kd, len);
        this.springs.push(s);
      }

      // Update using fast method described in Mosegaards tutorial
      update(dt, windDir) {
        // Satisfy constraints for several iterations
        const CONSTRAINT_ITERATIONS = 15;
        for (let i = 0; i < CONSTRAINT_ITERATIONS; ++i) {
          for (const s of this.springs) {
            s.update();
          }
        }

        // Apply external forces
        this._applyExternalForces(dt, windDir);

        // Update particles
        for (const row of this.particles) {
          for (const p of row) {
            p.update(dt);
          }
        }
      }

      // Update using viscoelastic forces
      update2(dt, windDir) {
        // Update external forces on particles
        this._applyExternalForces(dt, windDir);

        // Update internal (viscoelastic) forces on particles
        for (const s of this.springs) {
          s.update2();
        }

        // Update particles
        for (const row of this.particles) {
          for (const p of row) {
            p.update2(dt);
          }
        }
      }

      _applyExternalForces(dt, windDir) {
        // Update external forces on particles
        for (const row of this.particles) {
          for (const p of row) {
            // force from gravity
            let f_g = this.g_acc.times(p.mass);

            // collision penalty force
            let f_n = this._calculate_ground_force(p);

            // friction force
            let f_f = this._calculate_friction_force(p);

            p.ext_force = f_g.plus(f_n).plus(f_f);
          }
        }

        // Apply wind forces per triangle
        this._applyWindForce(dt, windDir);
      }

      _calculate_ground_force(p) {
        if (p.pos[1] >= 0.25) {
          return vec3(0, 0, 0);
        }

        let ks_component = this.ground_ks * (0.25 - p.pos[1]);
        let kd_component = -1 * this.ground_kd * p.vel[1];
        return vec3(0, ks_component + kd_component, 0);
      }

      _calculate_friction_force(p) {
        const mu_f = 0.4;
        let v_t = vec3(p.vel[0], 0, p.vel[2]);
        return (p.pos[1] >= 0.25) ? vec3(0, 0, 0) : v_t.times(-1 * mu_f * p.mass * this.g_acc.norm());
      }

      _applyWindForce(dt, windDir) {
        // Apply wind forces per triangle
        for (let i = 0; i < this.n - 1; ++i) {
          for (let j = 0; j < this.m - 1; ++j) {
            let f_w1 = this._calculateWindForceForTriangle(
                this.particles[i][j], this.particles[i + 1][j], this.particles[i][j + 1], windDir
            );
            let f_w2 = this._calculateWindForceForTriangle(
                this.particles[i + 1][j + 1], this.particles[i][j + 1], this.particles[i + 1][j], windDir
            );

            this.particles[i][j].ext_force.add_by(f_w1);
            this.particles[i + 1][j].ext_force.add_by(f_w1.plus(f_w2));
            this.particles[i][j + 1].ext_force.add_by(f_w1.plus(f_w2));
            this.particles[i + 1][j + 1].ext_force.add_by(f_w2);
          }
        }
      }

      _calculateTriangleNormal(p1, p2, p3) {
        let u = p2.pos.minus(p1.pos);
        let v = p3.pos.minus(p1.pos);

        return u.cross(v);
      }

      _calculateWindForceForTriangle(p1, p2, p3, windDir) {
        let normal = this._calculateTriangleNormal(p1, p2, p3);
        let d = normal.normalized();
        return normal.times(d.dot(windDir));
      }

      _handleBallCollision(c, radius) {
        for (const row of this.particles) {
          for (const p of row) {
            let d = p.pos.minus(c);
            if (d.norm() < radius) {
              p.pos.add_by(d.normalized().times(radius - d.norm()));
            }
          }
        }
      }

      _handleBoxCollision(c, length, height, width, transform) {
        // length ~ x, height ~ y, width ~ z
        let i = vec3(transform[0][0], transform[1][0], transform[2][0]).normalized();
        let j = vec3(transform[0][1], transform[1][1], transform[2][1]).normalized();
        let k = vec3(transform[0][2], transform[1][2], transform[2][2]).normalized();
        let inv_rot = new Mat4(
            [...i, 0],
            [...j, 0],
            [...k, 0],
            [0, 0, 0, 1]
        );

        c = inv_rot.times(c.to4(0)).to3();
        let x_lower = c[0] - length/2, x_upper = c[0] + length/2;
        let y_lower = c[1] - height/2, y_upper = c[1] + height/2;
        let z_lower = c[2] - width/2, z_upper = c[2] + width/2;

        for (let i = 0; i < this.particles.length; ++i) {
          for (let j = 0; j < this.particles[0].length; ++j) {
            let pos = inv_rot.times(this.particles[i][j].pos.to4(0)).to3();

            if ((x_lower < pos[0] && pos[0] < x_upper)
                && (y_lower < pos[1] && pos[1] < y_upper)
                && (z_lower < pos[2] && pos[2] < z_upper)) {
              let dx = (pos[0] < c[0]) ? x_lower - pos[0] : x_upper - pos[0];
              let dy = (pos[1] < c[1]) ? y_lower - pos[1] : y_upper - pos[1];
              let dz = (pos[2] < c[2]) ? z_lower - pos[2] : z_upper - pos[2];

              let abs_dx = Math.abs(dx), abs_dy = Math.abs(dy), abs_dz = Math.abs(dz);
              let update = vec3(0, 0, 0);
              if (abs_dx <= abs_dy && abs_dx <= abs_dz) {
                update = vec3(dx, 0, 0);
              }
              if (abs_dy <= abs_dx && abs_dy <= abs_dz) {
                update = vec3(0, dy, 0);
              }
              if (abs_dz <= abs_dx && abs_dz <= abs_dy) {
                update = vec3(0, 0, dz);
              }

              this.particles[i][j].pos.add_by(inv_rot.transposed().times(update.to4(0)).to3());
            }
          }
        }
      }

      draw(webgl_manager, uniforms, shapes, materials) {
        const red = color(1,0,0,1), blue = color(0,0,1,1);

        // draw particles
        for (const row of this.particles) {
          for (const p of row) {
            const pos = p.pos;
            let model_transform = Mat4.scale(0.25, 0.25, 0.25);
            model_transform.pre_multiply(Mat4.translation(pos[0], pos[1], pos[2]));
            shapes.ball.draw(webgl_manager, uniforms, model_transform, {...materials.plastic, color: blue});
          }
        }

        // draw springs
        for (const s of this.springs) {
          const p1 = s.particle_1.pos;
          const p2 = s.particle_2.pos;
          const len = (p2.minus(p1)).norm();
          const center = (p1.plus(p2)).times(0.5);

          let model_transform = Mat4.scale(0.05, len / 2, 0.05);

          // credit: https://computergraphics.stackexchange.com/questions/4008/rotate-a-cylinder-from-xy-plane-to-given-points
          const p = p1.minus(p2).normalized();
          let v = vec3(0, 1, 0);
          if (Math.abs(v.cross(p).norm()) < 0.1) {
            v = vec3(0, 0, 1);
            model_transform = Mat4.scale(0.05, 0.05, len / 2);
          }
          const w = v.cross(p).normalized();

          const theta = Math.acos(v.dot(p));
          model_transform.pre_multiply(Mat4.rotation(theta, w[0], w[1], w[2]));
          model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));
          shapes.box.draw(webgl_manager, uniforms, model_transform, { ...materials.plastic, color: red });
        }
      }

      getParticleNormals() {
        let normals = [...Array(this.n)].map(() => Array(this.m).fill(vec3(0,0,0))); // initialize n x m array

        for (let i = 0; i < this.n - 1; ++i) {
          for (let j = 0; j < this.m - 1; ++j) {
            let n1 = this._calculateTriangleNormal(
                this.particles[i][j + 1], this.particles[i][j], this.particles[i + 1][j]
            );
            let n2 = this._calculateTriangleNormal(
                this.particles[i + 1][j + 1], this.particles[i][j + 1], this.particles[i + 1][j]
            );

            normals[i][j].add_by(n1);
            normals[i + 1][j].add_by(n1.plus(n2));
            normals[i][j + 1].add_by(n1.plus(n2));
            normals[i + 1][j + 1].add_by(n2);
          }
        }

        return normals;
      }
    };