/*----------*\
  HELPER LIB
\*----------*/

function perspective(fieldOfViewInRadians, aspect, near, far, dst) {
    /*
   * Computes a 4-by-4 perspective transformation matrix given the angular height
   * of the frustum, the aspect ratio, and the near and far clipping planes.  The
   * arguments define a frustum extending in the negative z direction.  The given
   * angle is the vertical angle of the frustum, and the horizontal angle is
   * determined to produce the given aspect ratio.  The arguments near and far are
   * the distances to the near and far clipping planes.  Note that near and far
   * are not z coordinates, but rather they are distances along the negative
   * z-axis.  The matrix generated sends the viewing frustum to the unit box.
   * We assume a unit box extending from -1 to 1 in the x and y dimensions and
   * from -1 to 1 in the z dimension.
   * @param {number} fieldOfViewInRadians field of view in y axis.
   * @param {number} aspect aspect of viewport (width / height)
   * @param {number} near near Z clipping plane
   * @param {number} far far Z clipping plane
   * @param {Matrix4} [dst] optional matrix to store result
   * @return {Matrix4} dst or a new matrix if none provided
   */
    dst = dst || new Float32Array(16);
    var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
    var rangeInv = 1.0 / (near - far);

    dst[ 0] = f / aspect;
    dst[ 1] = 0;
    dst[ 2] = 0;
    dst[ 3] = 0;
    dst[ 4] = 0;
    dst[ 5] = f;
    dst[ 6] = 0;
    dst[ 7] = 0;
    dst[ 8] = 0;
    dst[ 9] = 0;
    dst[10] = (near + far) * rangeInv;
    dst[11] = -1;
    dst[12] = 0;
    dst[13] = 0;
    dst[14] = near * far * rangeInv * 2;
    dst[15] = 0;

    return dst;
}
function multiply(a, b, dst) {
    /*
   * Multiply by translation matrix.
   * @param {Matrix4} m matrix to multiply
   * @param {number} tx x translation.
   * @param {number} ty y translation.
   * @param {number} tz z translation.
   * @param {Matrix4} [dst] optional matrix to store result
   * @return {Matrix4} dst or a new matrix if none provided
   * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(16);
    var b00 = b[0 * 4 + 0];
    var b01 = b[0 * 4 + 1];
    var b02 = b[0 * 4 + 2];
    var b03 = b[0 * 4 + 3];
    var b10 = b[1 * 4 + 0];
    var b11 = b[1 * 4 + 1];
    var b12 = b[1 * 4 + 2];
    var b13 = b[1 * 4 + 3];
    var b20 = b[2 * 4 + 0];
    var b21 = b[2 * 4 + 1];
    var b22 = b[2 * 4 + 2];
    var b23 = b[2 * 4 + 3];
    var b30 = b[3 * 4 + 0];
    var b31 = b[3 * 4 + 1];
    var b32 = b[3 * 4 + 2];
    var b33 = b[3 * 4 + 3];
    var a00 = a[0 * 4 + 0];
    var a01 = a[0 * 4 + 1];
    var a02 = a[0 * 4 + 2];
    var a03 = a[0 * 4 + 3];
    var a10 = a[1 * 4 + 0];
    var a11 = a[1 * 4 + 1];
    var a12 = a[1 * 4 + 2];
    var a13 = a[1 * 4 + 3];
    var a20 = a[2 * 4 + 0];
    var a21 = a[2 * 4 + 1];
    var a22 = a[2 * 4 + 2];
    var a23 = a[2 * 4 + 3];
    var a30 = a[3 * 4 + 0];
    var a31 = a[3 * 4 + 1];
    var a32 = a[3 * 4 + 2];
    var a33 = a[3 * 4 + 3];
    dst[ 0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    dst[ 1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    dst[ 2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    dst[ 3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
    dst[ 4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    dst[ 5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    dst[ 6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    dst[ 7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
    dst[ 8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    dst[ 9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    dst[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    dst[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
    dst[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    dst[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    dst[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    dst[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
    return dst;
}
function subtractVectors(a, b, dst) {
    /*
   * subtracts 2 vectors3s
   * @param {Vector3} a a
   * @param {Vector3} b b
   * @param {Vector3} dst optional vector3 to store result
   * @return {Vector3} dst or new Vector3 if not provided
   * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(3);
    dst[0] = a[0] - b[0];
    dst[1] = a[1] - b[1];
    dst[2] = a[2] - b[2];
    return dst;
}
function cross(a, b, dst) {
    /*
   * Computes the cross product of 2 vectors3s
   * @param {Vector3} a a
   * @param {Vector3} b b
   * @param {Vector3} dst optional vector3 to store result
   * @return {Vector3} dst or new Vector3 if not provided
   * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(3);
    dst[0] = a[1] * b[2] - a[2] * b[1];
    dst[1] = a[2] * b[0] - a[0] * b[2];
    dst[2] = a[0] * b[1] - a[1] * b[0];
    return dst;
}
function normalize(v, dst) {
    /*
   * normalizes a vector.
   * @param {Vector3} v vector to normalize
   * @param {Vector3} dst optional vector3 to store result
   * @return {Vector3} dst or new Vector3 if not provided
   * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(3);
    var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    // make sure we don't divide by 0.
    if (length > 0.00001) {
      dst[0] = v[0] / length;
      dst[1] = v[1] / length;
      dst[2] = v[2] / length;
    }
    return dst;
}
function lookAt(cameraPosition, target, up, dst) {
    // Creates a lookAt matrix.
    // * This is a world matrix for a camera. In other words it will transform
    // * from the origin to a place and orientation in the world. For a view
    // * matrix take the inverse of this.
    // * @param {Vector3} cameraPosition position of the camera
    // * @param {Vector3} target position of the target
    // * @param {Vector3} up direction
    // * @param {Matrix4} [dst] optional matrix to store result
    // * @return {Matrix4} dst or a new matrix if none provided
    dst = dst || new Float32Array(16);
    var zAxis = normalize(
        subtractVectors(cameraPosition, target));
    var xAxis = normalize(cross(up, zAxis));
    var yAxis = normalize(cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];
    dst[ 1] = xAxis[1];
    dst[ 2] = xAxis[2];
    dst[ 3] = 0;
    dst[ 4] = yAxis[0];
    dst[ 5] = yAxis[1];
    dst[ 6] = yAxis[2];
    dst[ 7] = 0;
    dst[ 8] = zAxis[0];
    dst[ 9] = zAxis[1];
    dst[10] = zAxis[2];
    dst[11] = 0;
    dst[12] = cameraPosition[0];
    dst[13] = cameraPosition[1];
    dst[14] = cameraPosition[2];
    dst[15] = 1;

    return dst;
}
function inverse(m, dst) {
    /*
   * Computes the inverse of a matrix.
   * @param {Matrix4} m matrix to compute inverse of
   * @param {Matrix4} [dst] optional matrix to store result
   * @return {Matrix4} dst or a new matrix if none provided
   * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(16);
    var m00 = m[0 * 4 + 0];
    var m01 = m[0 * 4 + 1];
    var m02 = m[0 * 4 + 2];
    var m03 = m[0 * 4 + 3];
    var m10 = m[1 * 4 + 0];
    var m11 = m[1 * 4 + 1];
    var m12 = m[1 * 4 + 2];
    var m13 = m[1 * 4 + 3];
    var m20 = m[2 * 4 + 0];
    var m21 = m[2 * 4 + 1];
    var m22 = m[2 * 4 + 2];
    var m23 = m[2 * 4 + 3];
    var m30 = m[3 * 4 + 0];
    var m31 = m[3 * 4 + 1];
    var m32 = m[3 * 4 + 2];
    var m33 = m[3 * 4 + 3];
    var tmp_0  = m22 * m33;
    var tmp_1  = m32 * m23;
    var tmp_2  = m12 * m33;
    var tmp_3  = m32 * m13;
    var tmp_4  = m12 * m23;
    var tmp_5  = m22 * m13;
    var tmp_6  = m02 * m33;
    var tmp_7  = m32 * m03;
    var tmp_8  = m02 * m23;
    var tmp_9  = m22 * m03;
    var tmp_10 = m02 * m13;
    var tmp_11 = m12 * m03;
    var tmp_12 = m20 * m31;
    var tmp_13 = m30 * m21;
    var tmp_14 = m10 * m31;
    var tmp_15 = m30 * m11;
    var tmp_16 = m10 * m21;
    var tmp_17 = m20 * m11;
    var tmp_18 = m00 * m31;
    var tmp_19 = m30 * m01;
    var tmp_20 = m00 * m21;
    var tmp_21 = m20 * m01;
    var tmp_22 = m00 * m11;
    var tmp_23 = m10 * m01;

    var t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
        (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
    var t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
        (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
    var t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
        (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
    var t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
        (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

    var d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

    dst[0] = d * t0;
    dst[1] = d * t1;
    dst[2] = d * t2;
    dst[3] = d * t3;
    dst[4] = d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
          (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
    dst[5] = d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
          (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
    dst[6] = d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
          (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
    dst[7] = d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
          (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
    dst[8] = d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
          (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
    dst[9] = d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
          (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
    dst[10] = d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
          (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
    dst[11] = d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
          (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
    dst[12] = d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
          (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
    dst[13] = d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
          (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
    dst[14] = d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
          (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
    dst[15] = d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
          (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));

    return dst;
}
function xRotate(m, angleInRadians, dst) {
    /*
    * Multiply by an x rotation matrix. This is the optimized version of
    * multiply(m, xRotation(angleInRadians), dst);
    * @param {Matrix4} m matrix to multiply
    * @param {number} angleInRadians amount to rotate
    * @param {Matrix4} [dst] optional matrix to store result
    * @return {Matrix4} dst or a new matrix if none provided
    * @memberOf module:webgl-3d-math
   */
    dst = dst || new Float32Array(16);

    var m10 = m[4];
    var m11 = m[5];
    var m12 = m[6];
    var m13 = m[7];
    var m20 = m[8];
    var m21 = m[9];
    var m22 = m[10];
    var m23 = m[11];
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    dst[4]  = c * m10 + s * m20;
    dst[5]  = c * m11 + s * m21;
    dst[6]  = c * m12 + s * m22;
    dst[7]  = c * m13 + s * m23;
    dst[8]  = c * m20 - s * m10;
    dst[9]  = c * m21 - s * m11;
    dst[10] = c * m22 - s * m12;
    dst[11] = c * m23 - s * m13;

    if (m !== dst) {
      dst[ 0] = m[ 0];
      dst[ 1] = m[ 1];
      dst[ 2] = m[ 2];
      dst[ 3] = m[ 3];
      dst[12] = m[12];
      dst[13] = m[13];
      dst[14] = m[14];
      dst[15] = m[15];
    }

    return dst;
}
function yRotate(m, angleInRadians, dst) {
    /*
    * Multiply by an y rotation matrix
    * @param {Matrix4} m matrix to multiply
    * @param {number} angleInRadians amount to rotate
    * @param {Matrix4} [dst] optional matrix to store result
    * @return {Matrix4} dst or a new matrix if none provided
    * @memberOf module:webgl-3d-math
   */
    // this is the optimized version of
    // return multiply(m, yRotation(angleInRadians), dst);
    dst = dst || new Float32Array(16);

    var m00 = m[0 * 4 + 0];
    var m01 = m[0 * 4 + 1];
    var m02 = m[0 * 4 + 2];
    var m03 = m[0 * 4 + 3];
    var m20 = m[2 * 4 + 0];
    var m21 = m[2 * 4 + 1];
    var m22 = m[2 * 4 + 2];
    var m23 = m[2 * 4 + 3];
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    dst[ 0] = c * m00 - s * m20;
    dst[ 1] = c * m01 - s * m21;
    dst[ 2] = c * m02 - s * m22;
    dst[ 3] = c * m03 - s * m23;
    dst[ 8] = c * m20 + s * m00;
    dst[ 9] = c * m21 + s * m01;
    dst[10] = c * m22 + s * m02;
    dst[11] = c * m23 + s * m03;

    if (m !== dst) {
      dst[ 4] = m[ 4];
      dst[ 5] = m[ 5];
      dst[ 6] = m[ 6];
      dst[ 7] = m[ 7];
      dst[12] = m[12];
      dst[13] = m[13];
      dst[14] = m[14];
      dst[15] = m[15];
    }

    return dst;
}
function zRotate(m, angleInRadians, dst) {
    /*
    * Multiply by an z rotation matrix
    * @param {Matrix4} m matrix to multiply
    * @param {number} angleInRadians amount to rotate
    * @param {Matrix4} [dst] optional matrix to store result
    * @return {Matrix4} dst or a new matrix if none provided
    * @memberOf module:webgl-3d-math
    */
    // This is the optimized version of
    // return multiply(m, zRotation(angleInRadians), dst);
    dst = dst || new Float32Array(16);

    var m00 = m[0 * 4 + 0];
    var m01 = m[0 * 4 + 1];
    var m02 = m[0 * 4 + 2];
    var m03 = m[0 * 4 + 3];
    var m10 = m[1 * 4 + 0];
    var m11 = m[1 * 4 + 1];
    var m12 = m[1 * 4 + 2];
    var m13 = m[1 * 4 + 3];
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    dst[ 0] = c * m00 + s * m10;
    dst[ 1] = c * m01 + s * m11;
    dst[ 2] = c * m02 + s * m12;
    dst[ 3] = c * m03 + s * m13;
    dst[ 4] = c * m10 - s * m00;
    dst[ 5] = c * m11 - s * m01;
    dst[ 6] = c * m12 - s * m02;
    dst[ 7] = c * m13 - s * m03;

    if (m !== dst) {
        dst[ 8] = m[ 8];
        dst[ 9] = m[ 9];
        dst[10] = m[10];
        dst[11] = m[11];
        dst[12] = m[12];
        dst[13] = m[13];
        dst[14] = m[14];
        dst[15] = m[15];
    }

    return dst;
}
function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}
function radToDeg(r) {
    return r * 180 / Math.PI;
}
function degToRad(d) {
    return d * Math.PI / 180;
}




/*-----------*\
  SHADER GLSL
\*-----------*/

VERTEX_SHADER_SOURCE = `
attribute vec4 a_position;
varying vec4 v_position;
void main() {
    v_position = a_position;
    gl_Position = a_position;
    gl_Position.z = 1.0;
}`;
FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;

varying vec4 v_position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_position;
    gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}`;




/*-------*\
  DISPLAY
\*-------*/

class panoViewer {
    __constructor__(faces={}) {
        // Get A WebGL context
        this.canvas = document.querySelector("#pano");
        this.gl = this.canvas.getContext("webgl");
        if (!this.gl) {
            return;
        }
        
        this.faceInfos = [
            {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                url: faces.pano_r || "images/pano_r.jpg"
            }, {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                url: faces.pano_l || "images/pano_l.jpg"
            }, {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                url: faces.pano_u || "images/pano_u.jpg"
            }, {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                url: faces.pano_d || "images/pano_d.jpg"
            }, {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
                url: faces.pano_b || "images/pano_b.jpg"
            }, {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                url: faces.pano_f || "images/pano_f.jpg"
            },
        ];
        this.init()
    }
    init() {
        let gl = this.gl;
        // setup GLSL program
        var vertex_shader   = gl.createShader(gl.VERTEX_SHADER);
        var fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vertex_shader, VERTEX_SHADER_SOURCE);
        gl.shaderSource(fragment_shader, FRAGMENT_SHADER_SOURCE);
        gl.compileShader(vertex_shader);
        gl.compileShader(fragment_shader);
        console.log(`vertex_shader compile status: ${gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)}`)
        console.log(`fragment_shader compile status: ${gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)}`)
        var program = gl.createProgram()
        gl.attachShader(program, vertex_shader)
        gl.attachShader(program, fragment_shader)
        
        gl.linkProgram(program)
        console.log(`program link status: ${gl.getProgramParameter(program, gl.LINK_STATUS)}`)
        
        // look up where the vertex data needs to go.
        var positionLocation = gl.getAttribLocation(program, "a_position");
        
        // lookup uniforms
        var skyboxLocation = gl.getUniformLocation(program, "u_skybox");
        var viewDirectionProjectionInverseLocation = gl.getUniformLocation(program, "u_viewDirectionProjectionInverse");
        
        // Create a buffer for positions
        var positionBuffer = gl.createBuffer();
        // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // Put the positions in the buffer
        this.setGeometry(gl);
        
        // create a cubemap texture
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
        
        // add events
        document.querySelector("#pitch").addEventListener("change", ()=>requestAnimationFrame(this.drawScene))
        document.querySelector("#yaw"  ).addEventListener("change", ()=>requestAnimationFrame(this.drawScene))
        document.querySelector("#zoom" ).addEventListener("change", ()=>requestAnimationFrame(this.drawScene))
        canvas.addEventListener("mousemove", this.mouse.move)
        requestAnimationFrame(this.drawScene)
        
        this.load_textures()
    }
    load_textures() {let gl=this.gl;this.faceInfos.forEach(faceInfo =>{
        const {target, url} = faceInfo;
        
        // build fake texture for immediate results
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1712;
        const height = 1712;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null)
        
        // Asynchronously load the image
        var image = new Image();
        image.addEventListener('load', async function() {
            // Now that the image has loaded make copy it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            requestAnimationFrame(drawScene)
        })
        image.src = url;
        
        // assign textures
        // TODO: can this go outside the loop?
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    })}
    drawScene() {
        let gl = this.gl;
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        
        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);
        
        // Turn on the position attribute
        gl.enableVertexAttribArray(positionLocation);
        
        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        
        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer( positionLocation, size, type, normalize, stride, offset);
        
        // Compute the projection matrix
        var fieldOfViewRadians = degToRad(60);
        zoom = document.querySelector("#zoom").value;
        zoomRadians = degToRad(zoom);
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix = perspective(fieldOfViewRadians-zoomRadians, aspect, 1, 2000);
        
        // find camera angle
        yaw   = document.querySelector("#yaw")  .value % 360;
        pitch = document.querySelector("#pitch").value % 360;
        yawRadians   = degToRad(yaw);
        pitchRadians = degToRad(pitch);
        
        // point the camera
        let cameraMatrix = new Float32Array([
            -1,  0,  0,  0,
            0,  1,  0,  0,
            0,  0, -1,  0,
            0,  0,  0,  1,
        ]);
        yRotate(cameraMatrix, yawRadians, cameraMatrix)
        xRotate(cameraMatrix, pitchRadians, cameraMatrix)
        // Make a view matrix from the camera matrix.
        var viewMatrix = inverse(cameraMatrix);
        // We only care about direction so remove the translation
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;
        
        // Set the uniforms
        var viewDirectionProjectionMatrix        = multiply(projectionMatrix, viewMatrix);
        var viewDirectionProjectionInverseMatrix = inverse(viewDirectionProjectionMatrix);
        gl.uniformMatrix4fv(
            viewDirectionProjectionInverseLocation, false,
            viewDirectionProjectionInverseMatrix);
        
        // Tell the shader to use texture unit 0 for u_skybox
        gl.uniform1i(skyboxLocation, 0);
        
        // let our quad pass the depth test at 1.0
        gl.depthFunc(gl.LEQUAL)
        
        // Draw the geometry.
        gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);
    }
    mouse = {
        x:0, y:0,
        move: (e)=>{
            if (e.buttons && e.ctrlKey) {
                let dz = e.y - mouse.y;
                dz *= 0.1;
                let zoom = document.querySelector("#zoom");
                zoom.value = parseFloat(zoom.value) + dz;
                draw()
            } else if (e.buttons) {
                let dx = e.x - mouse.x;
                let dy = e.y - mouse.y;
                dx *= 0.1; dy *= 0.1;
                let pitch = document.querySelector("#pitch");
                let yaw = document.querySelector("#yaw");
                pitch.value = parseFloat(pitch.value) + dy % 360;
                yaw.value   = parseFloat(yaw.value)   + dx % 360;
                draw()
            }
            mouse.x = e.x;
            mouse.y = e.y;
        }
    }
    static setGeometry(gl) {
        // Fill the buffer with the values that define a quad.
        var positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }
}


window.addEventListener('load', main)

