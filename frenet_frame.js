import { tiny, defs } from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;


function h00(t) {
    return (2 * t ** 3 - 3 * t ** 2 + 1);
}
function h10(t) {
    return (t ** 3 - 2 * t ** 2 + t);
}
function h01(t) {
    return (-2 * t ** 3 + 3 * t ** 2);
}
function h11(t) {
    return (t ** 3 - t ** 2);
}

function firsth00(t) {
    return (6 * t ** 2 - 6 * t);
}
function firsth10(t) {
    return (3 * t ** 2 - 4 * t + 1);
}
function firsth01(t) {
    return (-6 * t ** 2 + 6 * t);
}
function firsth11(t) {
    return (3 * t ** 2 - 2 * t);
}

function secondh00(t) {
    return (12 * t - 6);
}
function secondh10(t) {
    return (6 * t - 4);
}
function secondh01(t) {
    return (-12 * t + 6);
}
function secondh11(t) {
    return (6 * t - 2);
}
export const Frenet_Spline = class Spline {
    constructor() {
        this.points = [];
        this.tangents = [];
        this.obj_t = 0;
    }

    add_point(x, y, z, tx, ty, tz) {
        this.points.push(vec3(x, y, z));
        this.tangents.push(vec3(tx, ty, tz));
    }

    // set_point(index, x, y, z) {
    //     this.points[index] = vec3(x, y, z);
    // }

    // set_tangent(index, tx, ty, tz) {
    //     this.tangents[index] = vec3(tx, ty, tz);
    // }

    P(t) {
        if (this.points.length < 2) {
            return vec3(0, 0, 0);
        }

        const size = this.points.length;
        t = t * (size - 1);
        let A = Math.floor(t);
        let B = Math.ceil(t);
        let a = this.points[A].copy();
        let b = this.points[B].copy();
        let ta = this.tangents[A].copy();
        let tb = this.tangents[B].copy();
        if (A == B) {
            return a;
        }
        else {
            t = (t - A) / (B - A);
        }
        A = A / (size - 1);
        B = B / (size - 1);
        return (a.times(h00(t))).plus(ta.times(h10(t) * (B - A))).plus(b.times(h01(t))).plus(tb.times(h11(t) * (B - A)));
    }

    firstP(t) {
        if (this.points.length < 2) {
            return vec3(0, 0, 0);
        }

        const size = this.points.length;
        t = t * (size - 1);
        if(Math.floor(t) == Math.ceil(t)){
            t += 0.001
        }
        let A = Math.floor(t);
        let B = Math.ceil(t);
        let a = this.points[A].copy();
        let b = this.points[B].copy();
        let ta = this.tangents[A].copy();
        let tb = this.tangents[B].copy();
        if (A == B) {
            return vec3(0,0,0);
        }
        else {
            t = (t - A) / (B - A);
        }
        A = A / (size - 1);
        B = B / (size - 1);
        return (a.times(firsth00(t))).plus(ta.times(firsth10(t) * (B - A))).plus(b.times(firsth01(t))).plus(tb.times(firsth11(t) * (B - A)));
    }

    secondP(t) {
        if (this.points.length < 2) {
            return vec3(0, 0, 0);
        }

        const size = this.points.length;
        t = t * (size - 1);
        if(Math.floor(t) == Math.ceil(t)){
            t += 0.001
        }
        let A = Math.floor(t);
        let B = Math.ceil(t);
        let a = this.points[A].copy();
        let b = this.points[B].copy();
        let ta = this.tangents[A].copy();
        let tb = this.tangents[B].copy();
        if (A == B) {
            return vec3(0,0,0);
        }
        else {
            t = (t - A) / (B - A);
        }
        A = A / (size - 1);
        B = B / (size - 1);
        return (a.times(secondh00(t))).plus(ta.times(secondh10(t) * (B - A))).plus(b.times(secondh01(t))).plus(tb.times(secondh11(t) * (B - A)));
    }

    getArticulationMatrix(sample_cnt){
        let newt = (this.obj_t/sample_cnt)%1.0;
        
        let pos = this.P(newt);
        let w = this.firstP(newt).normalized();
        //w = w.times(-1);
        let u = this.firstP(newt).cross(this.secondP(newt)).normalized();
        //u = u.times(-1);
        //let v = w.cross(u).normalized();
        let v = u.cross(w).normalized();
        //v = v.times(-1);
        let M = new Mat4([w[0],w[1],w[2],pos[0]],[u[0],u[1],u[2],pos[1]],[v[0],v[1],v[2],pos[2]],[0,0,0,1]);

        this.obj_t++;

        return M;
    }
}

export const Curve_Shape = class Curve_Shape extends Shape {
    // curve_function: (t) => vec3
    constructor(curve_function, sample_count, curve_color = color(1, 0, 0, 1)) {
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
};
