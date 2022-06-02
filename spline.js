import {defs, tiny} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, color, Mat4, Shape } = tiny;

export
const Spline =
    class Spline {
      constructor(points = [], tangents = [], size = 0) {
        this.points = points;
        this.tangents = tangents;
        this.size = size;

        this.num_samples = 0;
        this.arc_length_map = null;
      }

      add_point(x, y, z, tx, ty, tz) {
        this.points.push(vec3(x, y, z));
        this.tangents.push(vec3(tx, ty, tz));
        this.size++;
      }

      // assume t between 0.0 and 1.0
      get_position(t) {
        if (this.size < 2) {
          return vec3(0, 0, 0);
        }

        const A = Math.floor(t * (this.size - 1));
        const B = Math.ceil(t * (this.size - 1));
        const s = (t * (this.size - 1)) % 1.0;

        return this.points[A].times(1 - s).plus(this.points[B].times(s));
      }

      export() {
        let output = this.size + "\n";
        for (let i = 0; i < this.size; ++i) {
          let c = this.points[i];
          let t = this.tangents[i];
          output += `${c[0]} ${c[1]} ${c[2]} ${t[0]} ${t[1]} ${t[2]}\n`;
        }
        return output;
      }

      constructArcLengthMap(num_samples) {
        this.num_samples = num_samples;

        this.arc_length_map = new Array(num_samples + 1);
        this.arc_length_map[0] = 0;

        let length = 0;
        let prev = this.get_position(0);
        for (let i = 1; i <= this.num_samples; i++) {
          const t = i / this.num_samples;
          const curr = this.get_position(t);
          length += curr.minus(prev).norm();
          this.arc_length_map[i] = length;
          prev = curr;
        }
      }

      get_arc_length() {
        let max_len = 0;

        let length = 0;
        let prev = this.get_position(0);
        for (let i = 1; i <= 1000; i++) {
          const t = i / 1000;
          const curr = this.get_position(t);

          let temp = curr.minus(prev).norm();
          if (temp > max_len) max_len = temp;

          length += curr.minus(prev).norm();
          prev = curr;
        }
        return length;
      }

      get_next_u(s, prev) {
        let prev_u = Math.round(prev * this.num_samples);
        let u = (this.arc_length_map[prev_u] <= s) ? prev_u + 1 : 0;

        while(u <= this.num_samples && this.arc_length_map[u] < s) {
          u++;
        }

        return u / this.num_samples;
      }
    };

// Hermite basis functions
function h00(t) {
  return 2 * (t**3) - 3 * (t**2) + 1;
}
function h10(t) {
  return (t**3) - 2 * (t**2) + t;
}
function h01(t) {
  return -2 * (t**3) + 3 * (t**2);
}
function h11(t) {
  return (t**3) - (t**2);
}

export
const Hermite_Spline =
    class Hermite_Spline extends Spline {
      // assume t between 0.0 and 1.0
      get_position(t) {
        if (this.size < 2) {
          return vec3(0, 0, 0);
        }

        t = t * (this.size - 1);
        const t_left = Math.floor(t);
        const t_right = Math.ceil(t);

        let y_left = this.points[t_left];
        let y_right = this.points[t_right];
        let m_left = this.tangents[t_left];
        let m_right = this.tangents[t_right];

        if (t_left === t_right) {
          return y_left;
        }

        const s = (t - t_left); // / (t_right - t_left);
        const m_scale = 1.0 / (this.size - 1); //t_right - t_left;

        return y_left.times(h00(s))
            .plus(y_right.times(h01(s)))
            .plus(m_left.times(m_scale * h10(s)))
            .plus(m_right.times(m_scale * h11(s)));
      }
    };

export
const Curve_Shape =
    class Curve_Shape extends Shape {
      // curve_function: (t) => vec3
      constructor(curve_function, sample_count, curve_color=color( 1, 0, 0, 1 )) {
        super("position", "normal");

        this.material = { shader: new defs.Phong_Shader(), ambient: 1.0, color: curve_color }
        this.sample_count = sample_count;

        if (curve_function && this.sample_count) {
          for (let i = 0; i < this.sample_count + 1; i++) {
            let t = i / this.sample_count;
            this.arrays.position.push(curve_function(t));
            this.arrays.normal.push(vec3(0, 0, 0)); // have to add normal to make Phong shader work.
          }
        }
      }

      draw(webgl_manager, uniforms) {
        // call super with "LINE_STRIP" mode
        super.draw(webgl_manager, uniforms, Mat4.identity(), this.material, "LINE_STRIP");
      }

      update(webgl_manager, uniforms, curve_function) {
        if (curve_function && this.sample_count) {
          for (let i = 0; i < this.sample_count + 1; i++) {
            let t = i / this.sample_count;
            this.arrays.position[i] = curve_function(t);
          }
        }
        // this.arrays.position.forEach((v, i) => v = curve_function(i / this.sample_count));
        this.copy_onto_graphics_card(webgl_manager.context);
        // Note: vertex count is not changed.
        // not tested if possible to change the vertex count.
      }
    };