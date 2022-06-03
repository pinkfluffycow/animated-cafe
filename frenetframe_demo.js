import { tiny, defs } from './examples/common.js';
import {Frenet_Spline, Curve_Shape} from './frenet_frame.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export
    const Frenet_Frame_Base = defs.Frenet_Frame_Base =
        class Frenet_Frame_Base extends Component {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
            // This particular scene is broken up into two pieces for easier understanding.
            // The piece here is the base class, which sets up the machinery to draw a simple
            // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
            // exposes only the display() method, which actually places and draws the shapes,
            // isolating that code so it can be experimented with on its own.
            init() {
                console.log("init")

                // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
                this.hover = this.swarm = false;
                // At the beginning of our program, load one of each of these shape
                // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
                // would be redundant to tell it again.  You should just re-use the
                // one called "box" more than once in display() to draw multiple cubes.
                // Don't define more than one blueprint for the same thing here.
                this.shapes = {
                    'box': new defs.Cube(),
                    'ball': new defs.Subdivision_Sphere(4),
                    'axis': new defs.Axis_Arrows()
                };

                // *** Materials: ***  A "material" used on individual shapes specifies all fields
                // that a Shader queries to light/color it properly.  Here we use a Phong shader.
                // We can now tweak the scalar coefficients from the Phong lighting formulas.
                // Expected values can be found listed in Phong_Shader::update_GPU().
                const phong = new defs.Phong_Shader();
                const tex_phong = new defs.Textured_Phong();
                this.materials = {};
                this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color(.9, .5, .9, 1) }
                this.materials.metal = { shader: phong, ambient: .2, diffusivity: 1, specularity: 1, color: color(.9, .5, .9, 1) }
                this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture("assets/rgb.jpg") }
                this.materials.pure_color = { shader: phong, ambient: 1.8, diffusivity: 0, specularity: 0, color: color(.9,.5,.9,1) }

                // add point  0.0 5.0 0.0   -20.0, 0.0,  20.0
                // add point  0.0 5.0 5.0    20.0, 0.0,  20.0
                // add point  5.0 5.0 5.0    20.0, 0.0, -20.0
                // add point  5.0 5.0 0.0   -20.0, 0.0, -20.0
                // add point  0.0 5.0 0.0   -20.0, 0.0,  20.0

                this.spline = new Frenet_Spline();
                this.sample_cnt = 1000;
                this.spline.add_point(0.0, 5.0, 0.0, -20.0, 0.0, 20.0);
                this.spline.add_point(0.0, 5.0, 5.0, 20.0, 0.0, 20.0);
                this.spline.add_point(5.0, 5.0, 5.0, 20.0, 0.0, -20.0);
                this.spline.add_point(5.0, 5.0, 0.0, -20.0, 0.0, -20.0);
                this.spline.add_point(0.0, 5.0, 0.0, -20.0, 0.0, 20.0);
                //const curve_fn = (t) => this.spline.P(t);
                this.curve = new Curve_Shape((t) => this.spline.P(t), this.sample_cnt);
                this.obj_t = 0;
            }

            render_animation(caller) {                                                // display():  Called once per frame of animation.  We'll isolate out
                // the code that actually draws things into Part_one_hermite, a
                // subclass of this Scene.  Here, the base class's display only does
                // some initial setup.

                // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
                if (!caller.controls) {
                    this.animated_children.push(caller.controls = new defs.Movement_Controls({ uniforms: this.uniforms }));
                    caller.controls.add_mouse_controls(caller.canvas);

                    // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
                    // matrix follows the usual format for transforms, but with opposite values (cameras exist as
                    // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
                    // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
                    // orthographic() automatically generate valid matrices for one.  The input arguments of
                    // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

                    // !!! Camera changed here
                    Shader.assign_camera(Mat4.look_at(vec3(10, 10, 10), vec3(0, 0, 0), vec3(0, 1, 0)), this.uniforms);
                }
                this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 100);

                // *** Lights: *** Values of vector or point lights.  They'll be consulted by
                // the shader when coloring shapes.  See Light's class definition for inputs.
                const t = this.t = this.uniforms.animation_time / 1000;
                const angle = Math.sin(t);

                // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
                // !!! Light changed here
                const light_position = vec4(20 * Math.cos(angle), 20, 20 * Math.sin(angle), 1.0);
                this.uniforms.lights = [defs.Phong_Shader.light_source(light_position, color(1, 1, 1, 1), 1000000)];

                // let p = this.spline.P(0);
                // this.shapes.axis.draw(caller, this.uniforms, Mat4.translation(p[0],p[1],p[2]), this.materials.rgb);
            }
        }


export class Frenet_Frame extends Frenet_Frame_Base {                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
    // This particular scene is broken up into two pieces for easier understanding.
    // See the other piece, My_Demo_Base, if you need to see the setup code.
    // The piece here exposes only the display() method, which actually places and draws
    // the shapes.  We isolate that code so it can be experimented with on its own.
    // This gives you a very small code sandbox for editing a simple scene, and for
    // experimenting with matrix transformations.
    render_animation(caller) {                                                // display():  Called once per frame of animation.  For each shape that you want to
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
        super.render_animation(caller);

        /**********************************
         Start coding down here!!!!
         **********************************/
        // From here on down it's just some example shapes drawn for you -- freely
        // replace them with your own!  Notice the usage of the Mat4 functions
        // translation(), scale(), and rotation() to generate matrices, and the
        // function times(), which generates products of matrices.

        const blue = color(0, 0, 1, 1), yellow = color(1, 0.7, 0, 1);

        const t = this.t = this.uniforms.animation_time / 1000;

        // !!! Draw ground
        let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
        this.shapes.box.draw(caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow });

        this.curve.draw(caller, this.uniforms);
        
        //let newt = (this.obj_t/this.sample_cnt)%1.0;
        let M = this.spline.getArticulationMatrix(this.sample_cnt);
        // let pos = this.spline.P(newt);
        // let w = this.spline.firstP(newt).normalized();
        // //w = w.times(-1);
        // let u = this.spline.firstP(newt).cross(this.spline.secondP(newt)).normalized();
        // //u = u.times(-1);
        // //let v = w.cross(u).normalized();
        // let v = u.cross(w).normalized();
        // //v = v.times(-1);
        
        // //let obj_transform = Mat4.translation(pos[0], pos[1], pos[2]);
        // let M = new Mat4([w[0],w[1],w[2],pos[0]],[u[0],u[1],u[2],pos[1]],[v[0],v[1],v[2],pos[2]],[0,0,0,1]);
        
        this.shapes.axis.draw(caller, this.uniforms, M, this.materials.rgb);
        this.obj_t+=1;
    }
}