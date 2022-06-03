import {tiny, defs} from './examples/common.js';
import {Hermite_Spline, Curve_Shape} from "./spline.js";
import {Articulated_Body} from "./articulated_body.js";
import {Cloth_Simulation} from "./cloth_simulation.js";
import {Frenet_Spline} from './frenet_frame.js';
import {Bird} from "./bird.js";

// Pull these names into this module's scope for convenience:
const { vec, vec3, vec4, color, Mat4, Shader, Texture, Component } = tiny;

export
const Final_demo_base = defs.Final_demo_base =
    class Final_demo_base extends Component
    {
      init()
      {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = {
          'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere(4),
          'axis' : new defs.Axis_Arrows(),
          'tri' : new defs.Triangle(),
          'r_cyl': new defs.Rounded_Capped_Cylinder(25, 50),
        };

        this.sample_cnt = 0;
        this.curve = new Curve_Shape(null, 100);

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = {
          shader: phong,
          ambient: .2,
          diffusivity: 0.7,
          specularity:  1,
          color: color(0.54, 0.57, 0.59, 1)
        }
        this.materials.rgb = {shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" )}
        this.materials.steel = {
          shader: tex_phong,
          ambient: 0.8,
          specularity: 1,
          texture: new Texture("assets/steel.jpg")
        }
        this.materials.cloth = {
          shader: tex_phong,
          ambient: 0.8,
          diffusivity: 1,
          specularity: 0.01,
          texture: new Texture("assets/beige_fabric_80.png")
        }
        this.materials.blue_fabric = {
          shader: tex_phong,
          ambient: 0.8,
          diffusivity: 1,
          specularity: 0.01,
          texture: new Texture("assets/blue_fabric.jpg")
        }
        this.materials.wood = {
          shader: tex_phong,
          ambient: 1.0,
          texture: new Texture("assets/wood_2048.jpg")
        }


        // Initialize spline
        this.spline = new Hermite_Spline();
        const control_points = [
            [8, 4.25, -0.5,
                0, 0, 5],
            [5, 2.25, 2.25,
                -10, 0, 0]
        ];
        for (const p of control_points) {
          this.spline.add_point(...p);
        }
        this.spline_len = this.spline.get_arc_length();
        this.spline.constructArcLengthMap(1000);
        this.prev_u = 0;


        // Initialize curve
        this.sample_cnt = 100;
        const curve_fn = (t) => this.spline.get_position(t);
        this.curve = new Curve_Shape(curve_fn, this.sample_cnt);


        // Initialize articulated body
        this.robot = new Articulated_Body();
        this.isAnimating = false;
        this.rest_pos = this.robot.getEndEffectorPos();
        this.start_pos = vec3(control_points[0][0], control_points[0][1], control_points[0][2]);
        this.start_time = this.wait_time = 0.2;

        this.ball_radius = 0.2;


        // Set up shared cloth parameters
        const width = 2, height = 4;
        const density = 3;
        const n = density * height + 1, m = density * width + 1;
        let dx = width / (m - 1), dy = height / (n - 1);


        // Initialize left cloth
        this.left_cloth_offset = vec3(4.9, 1.95, 0);
        this.left_cloth_sim = new Cloth_Simulation(width, height, n, m, this.left_cloth_offset);
        this.left_cloth_sim.initialize(0.5, 50, 1);

        // Fix endpoints
        for (let i = 0; i < 3; ++i) {
          this.left_cloth_sim.particles[0][i].isFixed = true;
          this.left_cloth_sim.particles[0][m - i - 1].isFixed = true;
        }

        // Initialize sheet
        const left_cloth_corner = this.left_cloth_offset.plus(0, height, 0);
        const row_operation = (s,p) => p ? p.minus(vec3(0, dy, 0)) : left_cloth_corner;
        const column_operation = (t,p) => p.plus(vec3(dx, 0, 0));
        this.shapes.left_cloth_sheet = new defs.Grid_Patch(
            n - 1,
            m - 1,
            row_operation,
            column_operation,
            [[0, width/8], [0, height/8]]
        );


        // Initialize middle cloth
        this.middle_cloth_offset = vec3(7, 1.95, 0);
        this.middle_cloth_sim = new Cloth_Simulation(width, height, n, m, this.middle_cloth_offset);
        this.middle_cloth_sim.initialize(0.5, 50, 1);

        // Fix endpoints
        for (let i = 0; i < 3; ++i) {
          this.middle_cloth_sim.particles[0][i].isFixed = true;
          this.middle_cloth_sim.particles[0][m - i - 1].isFixed = true;
        }

        // Initialize sheet
        const middle_cloth_corner = this.middle_cloth_offset.plus(0, height, 0);
        const middle_row_operation = (s,p) => p ? p.minus(vec3(0, dy, 0)) : middle_cloth_corner;
        const middle_column_operation = (t,p) => p.plus(vec3(dx, 0, 0));
        this.shapes.middle_cloth_sheet = new defs.Grid_Patch(
            n - 1,
            m - 1,
            middle_row_operation,
            middle_column_operation,
            [[0, width/8], [0, height/8]]
        );


        // Initialize right cloth
        this.right_cloth_offset = vec3(9.1, 1.95, 0);
        this.right_cloth_sim = new Cloth_Simulation(width, height, n, m, this.right_cloth_offset);
        this.right_cloth_sim.initialize(0.5, 50, 1);

        // Fix endpoints
        for (let i = 0; i < 3; ++i) {
          this.right_cloth_sim.particles[0][i].isFixed = true;
          this.right_cloth_sim.particles[0][m - i - 1].isFixed = true;
        }

        // Initialize sheet
        const right_cloth_corner = this.right_cloth_offset.plus(0, height, 0);
        const right_row_operation = (s,p) => p ? p.minus(vec3(0, dy, 0)) : right_cloth_corner;
        const right_column_operation = (t,p) => p.plus(vec3(dx, 0, 0));
        this.shapes.right_cloth_sheet = new defs.Grid_Patch(
            n - 1,
            m - 1,
            right_row_operation,
            right_column_operation,
            [[0, width/8], [0, height/8]]
        );


        // Set up cloth drawing parameters
        this.isDrawingParticles = false;
        this.time_step = 0.01;

        // TODO: modify texture coordinates for furniture?
        this.shapes.box.arrays.texture_coord.forEach(
            (v, i, l) =>
                l[i] = vec(v[0] * 4, v[1] * 4)
        );

        /////////////////////////////////////////////////////////////////////////////////////////////////
        //Frenet Frame stuff
        this.frenet_sample_cnt = 1000;
        this.flyingObj = [];
        this.flyingCurves = [];

        this.flyingObj.push(new Frenet_Spline());
        this.flyingObj.push(new Frenet_Spline());
        this.flyingObj.push(new Frenet_Spline());
        this.flyingObj.push(new Frenet_Spline());
        this.flyingObj.push(new Frenet_Spline());

        this.flyingObj[0].add_point(-5.0, 8.0, -5.0, -20.0, 0.0, 20.0);
        this.flyingObj[0].add_point(21.0, 8.0, 15.0, 20.0, 0.0, -20.0);
        this.flyingObj[0].add_point(-5.0, 8.0, -5.0, -20.0, 0.0, 20.0);
        this.flyingCurves.push(new Curve_Shape((t) => this.flyingObj[0].P(t), this.frenet_sample_cnt));

        this.flyingObj[1].obj_t = 200;
        this.flyingObj[1].add_point(21.0, 15.0, -5.0, -20.0, 0.0, -20.0);
        this.flyingObj[1].add_point(-5.0, 8.0, 15.0, 20.0, 0.0, 20.0);
        this.flyingObj[1].add_point(21.0, 15.0, -5.0, -20.0, 0.0, -20.0);
        this.flyingCurves.push(new Curve_Shape((t) => this.flyingObj[1].P(t), this.frenet_sample_cnt));

        this.flyingObj[2].obj_t = 400;
        this.flyingObj[2].add_point(21.0, 11.0, -5.0, -20.0, 0.0, -20.0);
        this.flyingObj[2].add_point(-5.0, 11.0, 15.0, 20.0, 0.0, 20.0);
        this.flyingObj[2].add_point(21.0, 11.0, -5.0, -20.0, 0.0, -20.0);
        this.flyingCurves.push(new Curve_Shape((t) => this.flyingObj[2].P(t), this.frenet_sample_cnt));

        this.flyingObj[3].obj_t = 600;
        this.flyingObj[3].add_point(-5.0, 15.0, -5.0, -20.0, 0.0, 20.0);
        this.flyingObj[3].add_point(21.0, 8.0, 15.0, 20.0, 0.0, -20.0);
        this.flyingObj[3].add_point(-5.0, 15.0, -5.0, -20.0, 0.0, 20.0);
        this.flyingCurves.push(new Curve_Shape((t) => this.flyingObj[3].P(t), this.frenet_sample_cnt));

        this.flyingObj[4].add_point(0, 15.0, 0, -20.0, 0.0, 20.0);
        this.flyingObj[4].add_point(0, 15.0, 10.0, 20.0, 0.0, 20.0);
        this.flyingObj[4].add_point(16.0, 15.0, 10.0, 20.0, 0.0, -20.0);
        this.flyingObj[4].add_point(16.0, 15.0, 0, -20.0, 0.0, -20.0);
        this.flyingObj[4].add_point(0, 15.0, 0, -20.0, 0.0, 20.0);
        this.flyingCurves.push(new Curve_Shape((t) => this.flyingObj[4].P(t), this.frenet_sample_cnt));
      }

      render_animation( caller )
      {
        // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Final_Demo, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          Shader.assign_camera(Mat4.look_at(vec3 (15, 8, 20), vec3 (5, 5, 0), vec3 (0, 1, 0)), this.uniforms);
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        //const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        const light_position = vec4(10, 20, 20, 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        //this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }

// **Final_Demo** is a Scene object that can be added to any display canvas.
// This particular scene is broken up into two pieces for easier understanding.
// See the other piece, Final_demo_base, if you need to see the setup code.
// The piece here exposes only the display() method, which actually places and draws
// the shapes.  We isolate that code so it can be experimented with on its own.
// This gives you a very small code sandbox for editing a simple scene, and for
// experimenting with matrix transformations.
export class Final_Demo extends Final_demo_base
{
  render_animation( caller )
  {
    // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    const yellow = color(1,0.7,0,1), red = color(1, 0, 0, 1);

    const t = this.t = this.uniforms.animation_time/1000;

    /*************************
     * Draw ground and walls *
     *************************/

    // Draw ground
    let floor_transform = Mat4.translation(8, 0, 5).times(Mat4.scale(8, 0.01, 5));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, {...this.materials.plastic, color: color(0.5, 0.5, 0.5, 1)});

    // Draw walls
    let left_wall_transform = Mat4.translation(2.4, 3.5, -0.1).times(Mat4.scale(2.4, 3.5, 0.1));
    this.shapes.box.draw(caller, this.uniforms, left_wall_transform, {...this.materials.plastic, color: color(0.5, 0.5, 0.5, 1)});
    let right_wall_transform = Mat4.translation(13.6, 3.5, -0.1).times(Mat4.scale(2.4, 3.5, 0.1));
    this.shapes.box.draw(caller, this.uniforms, right_wall_transform, {...this.materials.plastic, color: color(0.5, 0.5, 0.5, 1)});
    let middle_wall_transform = Mat4.translation(8, 6.5, -0.1).times(Mat4.scale(3.2, 0.5, 0.1));
    this.shapes.box.draw(caller, this.uniforms, middle_wall_transform, {...this.materials.plastic, color: color(0.5, 0.5, 0.5, 1)});


    /******************
     * Draw scene *
     *******************/

    // Draw counter
    let counter_transform = Mat4.translation(8, 1, 2).times(Mat4.scale(6, 1, 0.5));
    this.shapes.box.draw(caller, this.uniforms, counter_transform, this.materials.wood);

    let end_counter_transform = Mat4.translation(2.5, 1, 0.75).times(Mat4.scale(0.5, 1, 0.75));
    this.shapes.box.draw(caller, this.uniforms, end_counter_transform, this.materials.wood);


    /******************
     * Draw the robot *
     ******************/

    // Update joints w/ inverse kinematics
    if (this.isAnimating) {
      if (t < this.start_time) {
        let goal_pos = this.rest_pos
            .plus((this.start_pos.minus(this.rest_pos)).times(1 - ((this.start_time - t) / this.wait_time)));
        this.robot.updateJoints(goal_pos);
      } else {
        let animation_t = 0.5 - 0.5 * Math.cos((t - this.start_time) / 2);
        let s = animation_t * this.spline_len;
            //2*(t - this.start_time) % this.spline_len;
        let u = this.spline.get_next_u(s, this.prev_u);
        let goal_pos = this.spline.get_position(u);
        this.robot.updateJoints(goal_pos);
        this.prev_u = u;
      }
    } else {
      this.start_time = t + this.wait_time;
      this.rest_pos = this.robot.getEndEffectorPos();
    }

    // Draw the articulated robot arm
    this.robot.draw(caller, this.uniforms, this.materials.steel);
    this.drawJoints(caller);

    // DEBUG: Draw spline curve
    //this.curve.draw(caller, this.uniforms);


    /*************************
     * Draw the robot cloths *
     *************************/

    // Update the cloth simulation
    let windDir = (Math.floor(t / 4) % 2 === 0) ? vec3(0, 0, -0.5) : vec3(0, 0, 0);
    this.left_cloth_sim.update(this.time_step, windDir);
    this.middle_cloth_sim.update(this.time_step, windDir);
    this.right_cloth_sim.update(this.time_step, windDir);

    // Handle collisions w/ robot arm joints
    const jointPositions = this.robot.getJointPositions()
    for (const jointPos of jointPositions) {
      this.left_cloth_sim._handleBallCollision(jointPos, 0.325);
      this.middle_cloth_sim._handleBallCollision(jointPos, 0.325);
      this.right_cloth_sim._handleBallCollision(jointPos, 0.325);
    }

    // Handle collisions w/ robot arm links
    let linkTransforms = this.robot.getLinkTransforms();
    const linkDimensions = [
      [2, 2, 2],
      [1, 0.2, 1],
      [0.2, 2.2, 0.2],
      [0.2, 2.2, 0.2],
      [0.2, 1, 0.2]
    ];
    for (let i = 2; i < linkTransforms.length; ++i) {
      let T = linkTransforms[i];
      let c = vec3(T[0][3], T[1][3], T[2][3]);

      const buffer = 0.3;
      this.left_cloth_sim._handleBoxCollision(
          c,
          linkDimensions[i][0] + buffer,
          linkDimensions[i][1] + buffer,
          linkDimensions[i][2] + buffer,
          T
      );
      this.middle_cloth_sim._handleBoxCollision(
          c,
          linkDimensions[i][0] + buffer,
          linkDimensions[i][1] + buffer,
          linkDimensions[i][2] + buffer,
          T
      );
      this.right_cloth_sim._handleBoxCollision(
          c,
          linkDimensions[i][0] + buffer,
          linkDimensions[i][1] + buffer,
          linkDimensions[i][2] + buffer,
          T
      );
    }

    // Update sheet positions
    this.shapes.left_cloth_sheet.arrays.position.forEach( (p, i, a) => {
      let r = Math.floor(i / this.left_cloth_sim.m);
      let c = i % this.left_cloth_sim.m;
      return a[i] = this.left_cloth_sim.particles[r][c].pos;
    });
    this.shapes.middle_cloth_sheet.arrays.position.forEach( (p, i, a) => {
      let r = Math.floor(i / this.middle_cloth_sim.m);
      let c = i % this.middle_cloth_sim.m;
      return a[i] = this.middle_cloth_sim.particles[r][c].pos;
    });
    this.shapes.right_cloth_sheet.arrays.position.forEach( (p, i, a) => {
      let r = Math.floor(i / this.right_cloth_sim.m);
      let c = i % this.right_cloth_sim.m;
      return a[i] = this.right_cloth_sim.particles[r][c].pos;
    });

    // Optionally draw cloth simulation particles
    if(this.isDrawingParticles) {
      this.middle_cloth_sim.draw(caller, this.uniforms, this.shapes, this.materials);
    }

    // Draw left cloth
    this.shapes.left_cloth_sheet.flat_shade();
    this.shapes.left_cloth_sheet.draw(caller, this.uniforms, Mat4.identity(), this.materials.blue_fabric);
    this.shapes.left_cloth_sheet.copy_onto_graphics_card(caller.context, ["position", "normal"], false);

    // Draw middle cloth
    this.shapes.middle_cloth_sheet.flat_shade();
    this.shapes.middle_cloth_sheet.draw(caller, this.uniforms, Mat4.identity(), this.materials.blue_fabric);
    this.shapes.middle_cloth_sheet.copy_onto_graphics_card(caller.context, ["position", "normal"], false);

    // Draw right cloth
    this.shapes.right_cloth_sheet.flat_shade();
    this.shapes.right_cloth_sheet.draw(caller, this.uniforms, Mat4.identity(), this.materials.blue_fabric);
    this.shapes.right_cloth_sheet.copy_onto_graphics_card(caller.context, ["position", "normal"], false);

    /**********************************
      Draw Splines and Flying objects
    **********************************/
    // let p = this.flyingObj[0].P(0);
    // let pM = Mat4.translation(p[0],p[1],p[2]);
    // this.shapes.axis.draw(caller, this.uniforms, pM, this.materials.metal);
    
    this.shapes.axis.draw(caller, this.uniforms, this.flyingObj[0].getArticulationMatrix(this.frenet_sample_cnt), this.materials.metal);
    //this.flyingCurves[0].draw(caller, this.uniforms);
    
    // this.shapes.axis.draw(caller, this.uniforms, this.flyingObj[1].getArticulationMatrix(this.frenet_sample_cnt), this.materials.metal);
    // this.flyingCurves[1].draw(caller, this.uniforms);
   
    this.shapes.axis.draw(caller, this.uniforms, this.flyingObj[2].getArticulationMatrix(this.frenet_sample_cnt), this.materials.metal);
    //this.flyingCurves[2].draw(caller, this.uniforms);
    
    // this.shapes.axis.draw(caller, this.uniforms, this.flyingObj[3].getArticulationMatrix(this.frenet_sample_cnt), this.materials.metal);
    // this.flyingCurves[3].draw(caller, this.uniforms);
    
    this.shapes.axis.draw(caller, this.uniforms, this.flyingObj[4].getArticulationMatrix(this.frenet_sample_cnt), this.materials.metal);
    //this.flyingCurves[4].draw(caller, this.uniforms);

    /**********
      Stools
    **********/
    this.drawStools(caller);
  }

  drawJoints(caller) {
    const blue = color(0, 0, 1, 1), yellow = color(1, 0.7, 0, 1), green = color(0, 0.6, 0, 1);

    // Draw joints and end effector
    const joint_transforms = this.robot.getJointPositions()
        .map(joint_pos => Mat4.translation(...joint_pos));

    for (const joint_transform of joint_transforms) {
      let ball_transform = joint_transform
          .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
      this.shapes.ball.draw(caller, this.uniforms, ball_transform, {...this.materials.plastic, color: blue})
    }
  }

  drawStools(caller){
    let seat = Mat4.translation(4,1.5,4).times(Mat4.scale(.8,.2,.8)).times(Mat4.rotation(Math.PI/2,1,0,0)).times(Mat4.rotation(Math.sin(this.t),0,0,1));
    let cushion = Mat4.translation(4,1.6,4).times(Mat4.scale(.7,.1,.7)).times(Mat4.rotation(Math.PI/2,1,0,0)).times(Mat4.rotation(Math.sin(this.t),0,0,1));
    let leg = Mat4.translation(4,.7,4).times(Mat4.scale(.1,1.5,.1)).times(Mat4.rotation(Math.PI/2,1,0,0));
    let base = Mat4.translation(4,.04,4).times(Mat4.scale(.7,.05,.7)).times(Mat4.rotation(Math.PI/2,1,0,0));
    this.shapes.r_cyl.draw(caller, this.uniforms, seat, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, cushion, this.materials.blue_fabric);
    this.shapes.r_cyl.draw(caller, this.uniforms, leg, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, base, this.materials.metal);

    seat = Mat4.translation(4,0,0).times(seat);
    cushion = Mat4.translation(4,0,0).times(cushion);
    leg = Mat4.translation(4,0,0).times(leg);
    base = Mat4.translation(4,0,0).times(base);
    this.shapes.r_cyl.draw(caller, this.uniforms, seat, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, cushion, this.materials.blue_fabric);
    this.shapes.r_cyl.draw(caller, this.uniforms, leg, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, base, this.materials.metal);

    seat = Mat4.translation(4,0,0).times(seat);
    cushion = Mat4.translation(4,0,0).times(cushion);
    leg = Mat4.translation(4,0,0).times(leg);
    base = Mat4.translation(4,0,0).times(base);
    this.shapes.r_cyl.draw(caller, this.uniforms, seat, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, cushion, this.materials.blue_fabric);
    this.shapes.r_cyl.draw(caller, this.uniforms, leg, this.materials.metal);
    this.shapes.r_cyl.draw(caller, this.uniforms, base, this.materials.metal);
  }

  // Sets up a panel of interactive HTML elements, including
  // buttons with key bindings for affecting this scene, and live info readouts.
  render_controls()
  {
    this.control_panel.innerHTML += "Part One:";
    this.new_line();

    this.key_triggered_button( "Get end effector position", [ "Shift", "E" ],
        () => console.log(this.robot.getEndEffectorPos())
    );
    this.new_line();

    this.key_triggered_button( "Toggle animation", [ "Shift", "A" ],
        () => this.isAnimating = !this.isAnimating
    );
    this.new_line();

    this.key_triggered_button( "Cinematic camera", [ "c" ],
        () => Shader.assign_camera(Mat4.look_at(vec3 (0, 3.3, 4), vec3 (5, 3.3, 3), vec3 (0, 1, 0)), this.uniforms)
    );
    this.new_line();

    this.key_triggered_button( "Debug camera", [ "x" ],
        () => Shader.assign_camera(Mat4.look_at(vec3 (15, 8, 20), vec3 (5, 5, 0), vec3 (0, 1, 0)), this.uniforms)
    );
    this.new_line();
  }
}