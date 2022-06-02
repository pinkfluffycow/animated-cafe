import {tiny, defs} from './examples/common.js';
import {Matrix, pseudoInverse} from 'https://cdn.skypack.dev/ml-matrix';

// Pull these names into this module's scope for convenience:
const {vec, vec3, Mat4} = tiny;

const shapes = {
  'sphere': new defs.Subdivision_Sphere( 5 ),
  'box'  : new defs.Cube(),
  'long_box' : new defs.Cube(),
  'short_box' : new defs.Cube()
};

export
const Articulated_Body =
    class Articulated_Body {
      constructor() {
        // base node
        const torso_transform = Mat4.translation(0, -1, 0).times(Mat4.scale(1, 1, 1));
            //Mat4.scale(1, 0.1, 1);
        this.base_node = new Link("torso", shapes.box, torso_transform);
        // root->base
        const root_location = Mat4.translation(8, 2, -1.5);
            //Mat4.translation(2, 0.05, 2);
        this.root = new Joint("root", null, this.base_node, root_location);

        // base rotator link
        let base_rotator_transform = Mat4.scale(0.5, 0.1, 0.5);
        this.base_rotator_link = new Link("rotator_link", shapes.box, base_rotator_transform);
        // base->base_rotator_joint->base_rotator_link
        const base_rotator_joint_location = Mat4.translation(0, 0.05, 0);
        this.base_rotator_joint = new Joint("rotator_joint", this.upper_link, this.base_rotator_link, base_rotator_joint_location);
        this.base_rotator_joint.setDOFs("", "y"); // revolute joint
        //this.base_rotator_joint.articulation_matrix = Mat4.rotation(-1 * Math.PI / 2, 0, 1, 0);
        this.base_node.children_arcs.push(this.base_rotator_joint);


        // set texture coords for long box shape
        shapes.long_box.arrays.texture_coord.forEach(
            (v, i, l) =>
                l[i] = vec(v[0], v[1] * 8)
        );

        // lower link
        let lower_link_transform = Mat4.scale(0.1, 1.1, 0.1);
        lower_link_transform.pre_multiply(Mat4.translation(0, 1.1, 0));
        this.lower_link = new Link("lower_link", shapes.long_box, lower_link_transform);
        // base_rotator_link->lower_joint->lower_link
        const lower_joint_location = Mat4.identity();
        this.lower_joint = new Joint("lower_joint", this.base_node, this.lower_link, lower_joint_location);
        this.lower_joint.setDOFs("", "x"); // revolute joint
        this.lower_joint.articulation_matrix = Mat4.rotation(-1 * Math.PI / 3, 1, 0, 0);
        this.base_rotator_link.children_arcs.push(this.lower_joint);


        // middle link
        let middle_link_transform = Mat4.scale(0.1, 1.1, 0.1);
        middle_link_transform.pre_multiply(Mat4.translation(0, 1.1, 0));
        this.middle_link = new Link("middle_link", shapes.long_box, middle_link_transform);
        // lower_link->middle_joint->middle_link
        const middle_joint_location = Mat4.translation(0, 2.2, 0);
        this.middle_joint = new Joint("middle_joint", this.lower_link, this.middle_link, middle_joint_location);
        this.middle_joint.setDOFs("", "x"); // revolute joint
        this.middle_joint.articulation_matrix = Mat4.rotation(Math.PI / 1.5, 1, 0, 0);
        this.lower_link.children_arcs.push(this.middle_joint);


        // set texture coords for short box shape
        shapes.short_box.arrays.texture_coord.forEach(
            (v, i, l) =>
                l[i] = vec(v[0], v[1] * 3)
        );


        // end rotator link
        let end_rotator_transform = Mat4.scale(0.1, 0.5, 0.1);
        end_rotator_transform.pre_multiply(Mat4.translation(0, 0.5, 0));
        this.end_rotator_link = new Link("rotator_link", shapes.short_box, end_rotator_transform);
        // middle_link->end_rotator_joint->end_rotator_link
        const end_rotator_joint_location = Mat4.translation(0, 2.2, 0);
        this.end_rotator_joint = new Joint("rotator_joint", this.middle_link, this.end_rotator_link, end_rotator_joint_location);
        this.end_rotator_joint.setDOFs("", "x"); // revolute joint
        // add z axis later
        this.end_rotator_joint.articulation_matrix = Mat4.rotation(Math.PI / 6, 1, 0, 0);
        this.middle_link.children_arcs.push(this.end_rotator_joint);


        this.articulation_path = [
          this.root,
          this.base_rotator_joint,
          this.lower_joint,
          this.middle_joint,
          this.end_rotator_joint
        ];
      }

      draw(webgl_manager, uniforms, material) {
        this.matrix_stack = [];
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
          node.shape.draw(webgl_manager, uniforms, matrix, material);

          matrix = this.matrix_stack.pop();
          for (const next_arc of node.children_arcs) {
            this.matrix_stack.push(matrix.copy());
            this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
            matrix = this.matrix_stack.pop();
          }
        }
      }


      // TODO: Refactor to eliminate redundant calculations?
      getLinkTransforms() {
        let linkTransforms = [];
        let transform = Mat4.identity();

        for (const arc of this.articulation_path) {
          const L = arc.location_matrix;
          const A = arc.articulation_matrix;
          transform = transform.times(L.times(A));

          const node = arc.child_node;
          const T = node.transform_matrix;

          linkTransforms.push(transform.times(T));
        }

        return linkTransforms;
      }


      getEndEffectorPos() {
        let joint_positions = this.getJointPositions();
        return joint_positions[joint_positions.length - 1];
      }

      // returns an array of vec3 joint positions
      getJointPositions() {
        let joint_positions = [];
        let transform = Mat4.identity();

        for (const arc of this.articulation_path) {
          const L = arc.location_matrix;
          const A = arc.articulation_matrix;
          transform = transform.times(L.times(A));

          // push joint position
          joint_positions.push(vec3(
              transform[0][3],
              transform[1][3],
              transform[2][3]
          ));
        }

        // push end effector position
        transform = transform.times(Mat4.translation(0, 1, 0));
        joint_positions.push(vec3(
            transform[0][3],
            transform[1][3],
            transform[2][3]
        ));

        return joint_positions;
      }

      // returns an array of per-joint vec3 translational and rotational axes
      getJointAxes() {
        let joint_axes = [];

        let transform = Mat4.identity();
        for (const arc of this.articulation_path) {
          const L = arc.location_matrix;
          const A = arc.articulation_matrix;
          transform = transform.times(L.times(A));

          joint_axes.push([
            arc.trans_axes,
            arc.rot_axes.map(axis => transform.times(axis).normalized())
          ]);
        }

        return joint_axes;
      }

      getJacobian(joint_positions, joint_axes) {
        let ee_pos = joint_positions[joint_positions.length - 1];

        // Compute partial derivatives for joint DoFs
        let J_T = [];
        for (let i = 0; i < joint_positions.length - 1; ++i) {
          for (const trans_axis of joint_axes[i][0]) {
            J_T.push([...trans_axis]);
          }

          let joint_pos = joint_positions[i];
          for (const rot_axis of joint_axes[i][1]) {
            let omega = rot_axis.to3().cross(ee_pos.minus(joint_pos));
            J_T.push([...omega]);
          }
        }

        return (new Matrix(J_T)).transpose();
      }

      getJointAngleUpdates(goal_pos) {
        let joint_positions = this.getJointPositions();
        let joint_axes = this.getJointAxes();

        // Compute error vector / column matrix
        let ee_pos = joint_positions[joint_positions.length - 1];
        let V = new Matrix(Array.from(goal_pos.minus(ee_pos), e => [e]));

        // Compute the Jacobian
        let J = this.getJacobian(joint_positions, joint_axes);

        // Get the local joint angle updates
        let theta_dot = pseudoInverse(J).mmul(V);
        return theta_dot.data.map(e => e[0]); // get rid of nested brackets
      }

      updateJoints(goal_pos) {
        let theta_dot = this.getJointAngleUpdates(goal_pos);

        let theta_i = 0;
        for (const joint of this.articulation_path) {
          let A = Mat4.identity();

          for (const trans_axis of joint.trans_axes) {
            A = A.times(Mat4.translation(...trans_axis.times(theta_dot[theta_i])));
            theta_i++;
          }
          for (const rot_axis of joint.rot_axes) {
            A = A.times(Mat4.rotation(theta_dot[theta_i], ...rot_axis));
            theta_i++;
          }

          joint.articulation_matrix = joint.articulation_matrix.times(A);
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