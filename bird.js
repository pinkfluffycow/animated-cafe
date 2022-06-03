import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const shapes = {
    'sphere': new defs.Subdivision_Sphere( 5 ),
    'box'  : new defs.Cube(),
    'cone' : new defs.Cone_Tip(15, 15),
};

export
const Bird = 
class Bird {
    constructor() {
        const torso_transform = Mat4.scale(.2, .15, .35);
        this.base_node = new Link("torso", shapes.sphere, torso_transform);
        // root->base
        const root_location = Mat4.translation(8, 4, 5);
        this.root = new Joint("root", null, this.base_node, root_location);

        // head node
        let head_transform = Mat4.scale(.15, .15, .15);
        this.head_node = new Link("head", shapes.sphere, head_transform);
        // torso->neck->head
        const neck_location = Mat4.translation(0, .1, .3);
        this.neck = new Joint("neck", this.base_node, this.head_node, neck_location);
        this.base_node.children_arcs.push(this.neck);

        // left eye node
        let l_eye_transform = Mat4.scale(.05, .05, .05);
        this.l_eye_node = new Link("l_eye", shapes.sphere, l_eye_transform);
        // torso->l_socket->l_eye
        const l_socket_location = Mat4.translation(-.05, .06, .08);
        this.l_socket = new Joint("l_socket", this.head_node, this.l_eye_node, l_socket_location);
        this.head_node.children_arcs.push(this.l_socket);

        // right eye node
        let r_eye_transform = Mat4.scale(.05, .05, .05);
        this.r_eye_node = new Link("r_eye", shapes.sphere, l_eye_transform);
        // torso->r_socket->r_eye
        const r_socket_location = Mat4.translation(.05, .06, .08);
        this.r_socket = new Joint("r_socket", this.head_node, this.r_eye_node, r_socket_location);
        this.head_node.children_arcs.push(this.r_socket);

        // beak node
        let beak_transform = Mat4.scale(.06, .06, .1);
        this.beak_node = new Link("beak", shapes.cone, beak_transform);
        // torso->mouth->beak
        const mouth_location = Mat4.translation(0, 0, .2);
        this.mouth = new Joint("mouth", this.head_node, this.beak_node, mouth_location);
        this.head_node.children_arcs.push(this.mouth);

        // left wing node
        let l_wing_transform = Mat4.rotation(-.5 * Math.PI, 0, 1, 0)
        l_wing_transform.pre_multiply(Mat4.scale(.3, .03, .15));
        l_wing_transform.pre_multiply(Mat4.translation(-.2, 0, 0));
        this.l_wing_node = new Link("l_wing", shapes.cone, l_wing_transform);
        // torso->l_shoulder->l_wing
        const l_shoulder_location = Mat4.translation(-.2, .1, 0);
        this.l_shoulder = new Joint("l_shoulder", this.base_node, this.l_wing_node, l_shoulder_location);
        this.base_node.children_arcs.push(this.l_shoulder);

        // right wing node
        let r_wing_transform = Mat4.rotation(.5 * Math.PI, 0, 1, 0);
        r_wing_transform.pre_multiply(Mat4.scale(.3, .03, .15));
        r_wing_transform.pre_multiply(Mat4.translation(.2, 0, 0));
        this.r_wing_node = new Link("r_wing", shapes.cone, r_wing_transform);
        // torso->r_shoulder->r_wing
        const r_shoulder_location = Mat4.translation(.2, .1, 0);
        this.r_shoulder = new Joint("r_shoulder", this.base_node, this.r_wing_node, r_shoulder_location);
        this.base_node.children_arcs.push(this.r_shoulder);

        this.eye_mat = { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color(0, 0, 0, 1) };
    }

    draw(webgl_manager, uniforms, location, material) {
        this.matrix_stack = [];
        let rot_mat = Mat4.rotation(.5 * Math.PI, 0, 1, 0);
        rot_mat.pre_multiply(Mat4.scale(2, 2, 2));
        rot_mat.pre_multiply(location);
        this.root.location_matrix = rot_mat;
        this._rec_draw(this.root, Mat4.identity(), webgl_manager, uniforms, material);
    }
    
    _rec_draw(arc, matrix, webgl_manager, uniforms, material) {
        if (arc !== null) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());
            
            const node = arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);
            if(node === this.l_eye_node || node === this.r_eye_node) {
              node.shape.draw(webgl_manager, uniforms, matrix, this.eye_mat);
            }
            else {
              node.shape.draw(webgl_manager, uniforms, matrix, material);
            }
            
            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
                matrix = this.matrix_stack.pop();
            }
        }
    }
}

class Link {
  constructor(name, shape, transform) {
    this.name = name;
    this.shape = shape;
    this.transform_matrix = transform;
    this.children_arcs = [];
  }
}

class Joint {
  constructor(name, parent, child, location) {
    this.name = name;
    this.child_node = child;
    this.location_matrix = location;
    this.articulation_matrix = Mat4.identity();
    this.trans_axes = [];
    this.rot_axes = [];
  }

  setDOFs(trans_axes, rot_axes) {
    for (const axis of trans_axes) {
      switch(axis) {
        case 'x':
          this.trans_axes.push(vec3(1, 0, 0));
          break;
        case 'y':
          this.trans_axes.push(vec3(0, 1, 0));
          break;
        case 'z':
          this.trans_axes.push(vec3(0, 0, 1));
          break;
      }
    }
    for (const axis of rot_axes) {
      switch(axis) {
        case 'x':
          this.rot_axes.push(vec3(1, 0, 0));
          break;
        case 'y':
          this.rot_axes.push(vec3(0, 1, 0));
          break;
        case 'z':
          this.rot_axes.push(vec3(0, 0, 1));
          break;
      }
    }
  }
}