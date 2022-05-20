import {tiny, defs} from './examples/common.js';
import {Cloth_Simulation} from "./cloth_simulation.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shader, Texture, Component } = tiny;

export
const Cloth_Demo_Base = defs.Cloth_Demo_Base =
    class Cloth_Demo_Base extends Component
    {
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;

        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows()
        };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }
        this.materials.cloth = {
          shader: tex_phong,
          ambient: 0.8,
          diffusivity: 1,
          specularity: 0.01,
          texture: new Texture( "assets/blue_fabric.jpg" )
        }


        // Initialize cloth simulation
        const width = 8, height = 6;
        const density = 3;
        const n = density * height + 1, m = density * width + 1;
        const offset = vec3(1, 3, 0)
        let dx = width / (m - 1), dy = height / (n - 1);

        this.cloth_sim = new Cloth_Simulation(width, height, n, m, offset);
            // tutorial: 14, 10, 55, 45
        this.cloth_sim.initialize(0.5, 50, 1);

        // Fix endpoints
        for (let i = 0; i < 3; ++i) {
          this.cloth_sim.particles[0][i].isFixed = true;
          this.cloth_sim.particles[0][i].pos[0] += dx * 0.1;
          this.cloth_sim.particles[0][m - i - 1].isFixed = true;
          this.cloth_sim.particles[0][m - i - 1].pos[0] -= dx * 0.1;
        }

        this.isDrawingParticles = false;
        this.time_step = 0.01;


        // Initialize sheet
        const initial_corner_point = offset.plus(0, height, 0);
        const row_operation = (s,p) => p ? p.minus(vec3(0, dy, 0)) : initial_corner_point;
        const column_operation = (t,p) => p.plus(vec3(dx, 0, 0));
        this.shapes.sheet = new defs.Grid_Patch(
            n - 1,
            m - 1,
            row_operation,
            column_operation,
            [[0, width/8], [0, height/8]]
        );
      }

      render_animation( caller )
      {
        // Called once per frame of animation.
        // Only does some initial setup. Actual drawing is done in Cloth_Demo class.

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
          Shader.assign_camera( Mat4.look_at (vec3 (10, 10, 10), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin(t);

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        //const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        const light_position = vec4(8, 20, 20, 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


export class Cloth_Demo extends Cloth_Demo_Base
{
  render_animation( caller )
  {
    // Called once per frame of animation.  For each shape that you want to
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

    const t = this.t = this.uniforms.animation_time / 1000;

    // !!! Draw ground
    const yellow = color( 0.7,1,0,1 );
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );


    // Update the cloth simulation
    let windDir = (Math.floor(t / 4) % 2 === 0) ? vec3(0, 0, 5) : vec3(0, 0, 0);
        // vec3(0, 0, 10).times(0.5 + 0.5*Math.sin(t/5)); //vec3(0.5, 0, -0.2);
    this.cloth_sim.update(this.time_step, windDir);

    // Update sheet positions
    this.shapes.sheet.arrays.position.forEach( (p, i, a) => {
      let r = Math.floor(i / this.cloth_sim.m);
      let c = i % this.cloth_sim.m;
      return a[i] = this.cloth_sim.particles[r][c].pos;
    });
    /*
    // Update sheet normals
    let normals = this.cloth.getParticleNormals();
    this.shapes.sheet.arrays.normal.forEach( (p, i, a) => {
      let r = Math.floor(i / this.cloth.m);
      let c = i % this.cloth.m;
      return a[i] = normals[r][c];
    });
     */


    // Optionally draw cloth simulation particles
    if(this.isDrawingParticles) {
      this.cloth_sim.draw(caller, this.uniforms, this.shapes, this.materials);
    }

    // Draw sheet
    this.shapes.sheet.flat_shade();
    this.shapes.sheet.draw(caller, this.uniforms, Mat4.identity(), this.materials.cloth);
    this.shapes.sheet.copy_onto_graphics_card(caller.context, ["position", "normal"], false);
  }

  // Sets up a panel of interactive HTML elements, including
  // buttons with key bindings for affecting this scene, and live info readouts.
  render_controls()
  {
    this.control_panel.innerHTML += "Scratch";
    this.new_line();
    this.key_triggered_button( "Draw particles", ['x'],
        () => this.isDrawingParticles = !this.isDrawingParticles
    );
    this.new_line();
  }
}
