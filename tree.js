import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const shapes = {
    'sphere': new defs.Subdivision_Sphere(2),
    'cylinder'  : new defs.Capped_Cylinder(15, 15),
};

export
const Tree = 
class Tree {
    constructor() {
        const height = 7.0;
        const trunk_transform = Mat4.rotation(-.5 * Math.PI, 1, 0, 0);
        trunk_transform.pre_multiply(Mat4.scale(0.7, height, 0.7));
        trunk_transform.pre_multiply(Mat4.translation(0, height * .5, 0));
        this.base_node = new Link("trunk", shapes.cylinder, trunk_transform);
        // root->base
        const root_location = Mat4.translation(0, 0, 5);
        this.root = new Joint("root", null, this.base_node, root_location);

        const leaf_transform = Mat4.scale(2.5, 2.5, 2.5);
        this.leaf_node = new Link("leaf", shapes.sphere, leaf_transform);
        const leaf_location = Mat4.translation(0, height, 0);
        this.leaf = new Joint("leaf", this.base_node, this.leaf_node, leaf_location);
        this.base_node.children_arcs.push(this.leaf);

        this.trunk_mat = { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color(.7, .35, 0, 1) };
        this.leaf_mat = { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color(0, 1, 0, 1) };
    }

    draw(webgl_manager, uniforms, location) {
        this.matrix_stack = [];
        this.root.location_matrix = location;
        this._rec_draw(this.root, Mat4.identity(), webgl_manager, uniforms);
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
            if(node == this.base_node) {
              node.shape.draw(webgl_manager, uniforms, matrix, this.trunk_mat);
            }
            else {
              node.shape.draw(webgl_manager, uniforms, matrix, this.leaf_mat);
            }
            
            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms);
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