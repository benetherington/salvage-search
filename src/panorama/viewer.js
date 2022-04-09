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

const VERTEX_SHADER_SOURCE = `
attribute vec4 a_position;
varying vec4 v_position;
void main() {
    v_position = a_position;
    gl_Position = a_position;
    gl_Position.z = 1.0;
}`;
const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;

varying vec4 v_position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_position;
    gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}`;

const PANO_CONTAINER_STYLE = `
/* ELEMENT DEFAULTS */
:host {
    /* Allow corner snipping */
    overflow: hidden;
    /* Style container */
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    /* Align contents */
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
}
canvas {
    box-sizing: border-box;
    width: 100%;
    aspect-ratio: 800/600;
}
input {
    box-sizing: border-box;
    width: 100%;
    font-size: 1.5em;
    padding: 0 20px;
    /* override FX defaults */
    outline: none;
    border: none;
    /* add invisible border for jump-free existance */
    border-bottom: 2px solid rgba(0,0,0,0);
}

/* STAGED */
:host(:not(.thumbnail)) canvas {
    cursor: all-scroll;
}

/* UNFOCUSED INPUT */
:host( :not(.focused) ) input:hover {
    background-color: #d3dce0;
}
:host( :not(.focused) ) input:focus {
    border-bottom: 2px solid #32728C;
    background-color: #d5f3ff;
}

/* THUMBNAILS */
:host( .thumbnail ) input {
    font-size: 1em;
}

/* THUMBNAIL HOVERS */
:host( .thumbnail:not(.focused):hover ) {
    /* Highlight on container hover */
    box-shadow: 0 1px 3px rgba(0,0,0,0.12),
    0 1px 2px rgba(0,0,0,0.24),
    0 0   4px #32728C;
}
:host( .thumbnail ) .icon-floater {
    /* Align floater above canvas */
    width: 100%;
    aspect-ratio: 800/600;
    top: 0;
    left: 0;
    z-index: 1;
    position: absolute;
}
:host( .thumbnail ) .icon-floater::before {
    /* Align floater ::before to fill canvas area */
    content: "";
    position: absolute;
    height: 100%;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 2;
}
:host( .thumbnail ) .icon-floater:hover::before {
    /* Add a "promote" arrow when hovering */
    background-image: url("/icons/arrow-up-square.svg");
    background-size: 50%;
    background-position: 50%;
    background-repeat: no-repeat;
}
:host( .thumbnail:not(.focused) ) .icon-floater:hover ~ canvas {
    /* blur canvas while hovering  */
    filter: blur(1.1px) opacity(75%);
}

/* FOCUSED STATE */
:host( .thumbnail.focused) .icon-floater::before {
    /* Add a "promoted" arrow */
    color: white;
    background-image: url("/icons/arrow-up-square-fill.svg");
    background-size: 50%;
    background-position: 50%;
    background-repeat: no-repeat;
}
:host( .thumbnail.focused ) canvas,
:host( .thumbnail.focused ) input {
    /* Blur while focused */
    filter: blur(2px) opacity(60%);
    pointer-events: none;
}`


/*-------*\
  DISPLAY
\*-------*/
class PanoContainer extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({mode:"open"});
        
        const style = document.createElement("style");
        style.textContent = PANO_CONTAINER_STYLE;
        this.shadowRoot.append(style);
        this.titleEl = new Object();
        // this.addEventListener("download", this.onDownload)
        // this.addEventListener("reset", this.onReset)
        // this.addEventListener("remove", this.onRemove)
    }
    // static get observedAttributes() {return ["name"]}
    // attributeChangedCallback(attrName, oldValue, newValue) {
    //     let titleEl = this.shadowRoot.querySelector("input");
    //     if (titleEl) {
    //         while (newValue.endsWith(".png")) {
    //             newValue = newValue.slice(0,-4);
    //         }
    //         titleEl.value = newValue + ".png";
    //         this.dispatchEvent(new Event("namechange", {bubbles:true}))
    //     }
    // }
    connectedCallback() {
        if (!this.isConnected) {
            // don't continue if disconnecting
            return
        }
        if (this.shadowRoot.childElementCount>1) {
            // don't continue if shadow contains more than style
            return
        }

        // style self, attach shadowDOM
        this.classList.add("pano-container");
        // add icon floater
        let floater = document.createElement("div");
        floater.classList.add("icon-floater")
        this.shadowRoot.append(floater)
        // add floater event
        floater.onclick = ()=>{this.dispatchEvent(
            new Event("swap", {bubbles:true})
        )}
        // add panoviewer
        this.shadowRoot.append(this.getPano())
        // add title input
        // let titleEl = document.createElement("input");
        // titleEl.value = (this.origName || this.getAttribute("name")) + ".png"
        // this.shadowRoot.appendChild(titleEl)
        // add input events
        // this.attributeChangedCallback = (attrName, oldValue, newValue)=>{
        //     if (attrName==="name") {
        //         this.titlEl.value = newValue + ".png";
        //     }
        // }
        // titleEl.addEventListener("click", e=>{
        //     if (e.target.getRootNode().host.classList.contains("focused")){
        //         e.preventDefault(); return;
        //     }
        //     let start = e.target.selectionStart;
        //     let end = e.target.selectionEnd;
        //     let name = e.target.getRootNode().host.getAttribute("name");
        //     e.target.value = name;
        //     e.target.setSelectionRange(start, end)
        // })
        // titleEl.addEventListener("blur", e=>{
        //     let name = e.target.value;
        //     while (name.endsWith(".png")) {
        //         name = name.slice(0,-4);
        //     }
        //     e.target.value = name + ".png";
        //     e.target.getRootNode().host.setAttribute("name", name)
        // })
    }
    async onDownload(e) {
        // let url = await this.getPano().getImage();
        // let filename = `interior/${this.getAttribute('name')}.png`;
        // let saveAs = false;
        // browser.downloads.download({url, filename, saveAs})
    }
    onReset(e) {
        // if (!this.origName) {return}
        // this.resetName();
        // this.resetView();
    }
    resetName() {
        // this.setAttribute("name", this.origName)
    }
    resetView() {
        // switch (this.origName) {
        //     case "driver":
        //         this.getPano().goToDriver()
        //         break;
        //     case "passenger":
        //         this.getPano().goToPassenger()
        //         break;
        //     case "ip":
        //         this.getPano().goToIp()
        //         break;
        //     case "rear":
        //         this.getPano().goToRear()
        // }
    }
    onRemove(e) {
        console.log("remove")
    }
    addPano(faces) {
        return this.getPano().updateFaces(faces)
    }
    getPano() {
        if (this.panoViewer) {
            return this.panoViewer
        } else if (this.querySelector("canvas")) {
            // find PanoViewer
            this.panoViewer = this.querySelector("canvas");
        } else {
            // build PanoViewer
            this.panoViewer = document.createElement("canvas", {is:"pano-viewer"})
        }
        return this.panoViewer
    }
    getClone() {
        let clone = this.cloneNode(true);
        clone.panoViewer = this.panoViewer.cloneNode(true);
        clone.origName = this.origName;
        return clone;
    }
    async getThumbnail() {
        // create a container
        let div = document.createElement("div");
        div.classList.add("thumb-container")
        // create hover toolbar
        let divHover = document.createElement("div");
        divHover.classList.add("hover-bar")
        div.append(divHover)
        // create toolbar buttons
        let spanEdit = document.createElement("span");
        spanEdit.classList.add("hover-icon")
        spanEdit.classList.add("edit-icon")
        spanEdit.addEventListener("click", this.restoreFrom.bind(this))
        divHover.append(spanEdit)
        let spanDelete = document.createElement("span");
        spanDelete.classList.add("hover-icon")
        spanDelete.classList.add("delete-icon")
        spanDelete.addEventListener("click", e=>div.remove())
        divHover.append(spanDelete)
        // add the current image
        let img = document.createElement("img");
        img.src = "/icons/hourglass-split.svg";
        new Promise(async ()=>{
            img.src = await this.getPano().getImage();
        })
        div.append(img)
        // save view data
        let view = {
            pitch: Number(this.getPano().getAttribute("pitch")),
            yaw:   Number(this.getPano().getAttribute("yaw")),
            zoom:  Number(this.getPano().getAttribute("zoom")),
            fov:   Number(this.getPano().getAttribute("fov")),
        }
        spanEdit.setAttribute("view", JSON.stringify(view))
        return div
    }
    restoreFrom(e) {
        // restore view
        let view = JSON.parse(e.target.getAttribute("view"))
        this.getPano().setAttribute("pitch", view.pitch)
        this.getPano().setAttribute("yaw", view.yaw)
        this.getPano().setAttribute("zoom", view.zoom)
        this.getPano().setAttribute("fov", view.fov)
        e.target.closest(".thumb-container").remove()
    }
}
customElements.define("pano-container", PanoContainer)


class PanoViewer extends HTMLCanvasElement {
    constructor() {
        let canvas = super();
        // Get A WebGL context
        let gl = canvas.getContext("webgl");
        if (!gl) {
            return;
        }
        this.initiated = false;
        this.cursorPrev = {x:0, y:0, scrollY:0};
        this.locations = {
            position:null,
            skybox:null,
            viewDirectionProjectionInverse:null,
        };
    }
    connectedCallback() {
        if (this.initiated) {
            // Only add event listeners, etc once
            return;
        }
        // patch in dataset values for cloning purposes
        if (!this.hasAttribute("pitch")){
            this.setAttribute("pitch", 0)
            this.setAttribute("yaw",   0)
            this.setAttribute("zoom",  -20)
            this.setAttribute("fov",   60)
        }
        // if we get resized, we'll still generate the same pixels, and they'll
        // be mushed onto the canvas in the wrong resultion at best, and skewed
        // at worst. A ResizeObserver can trigger updates for us.
        let resizeObserver = new ResizeObserver((entries, observer)=>{
            this.height = entries[0].contentBoxSize[0].blockSize;
            this.width  = entries[0].contentBoxSize[0].inlineSize;
            this.render()
        })
        resizeObserver.observe(this)
        // add pan/zoom events
        this.addEventListener("mousemove", this.onMouseMove.bind(this))
        this.addEventListener("wheel", this.onWheel.bind(this))
        document.addEventListener("keydown", this.onKeyDown.bind(this))
        // enable keyboard listening (for ctrl cursor change)
        this.addEventListener("mouseenter", this.onMouseEnter.bind(this))
        this.addEventListener("mouseleave", this.onMouseLeave.bind(this))
        this.initGl()
        this.initiated = true;
    }
    
    // INTERFACE
    static get observedAttributes() {return ["pitch", "yaw", "zoom", "fov", "name"]}
    attributeChangedCallback(attrName, oldValue, newValue) {
        // if (attrName==="name" && this.titleEl) {
        //     while (newValue.endsWith(".png")) {
        //         newValue = newValue.slice(0,-4);
        //     }
        //     this.titleEl.value = newValue + ".png";
        // }
        if (["pitch", "yaw", "zoom", "fov"].includes(attrName)) {
            this.render()
        }
    }
    updateFaces(faces) {let gl = this.getContext("webgl");
        let texPromises = [];
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                faces.pano_r || "images/pano_r.jpg"
            )
        )
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                faces.pano_l || "images/pano_l.jpg"
            )
        )
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                faces.pano_u || "images/pano_u.jpg"
            )
        )
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                faces.pano_d || "images/pano_d.jpg"
            )
        )
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
                faces.pano_b || "images/pano_b.jpg"
            )
        )
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                faces.pano_f || "images/pano_f.jpg"
            )
        )
        this.render()
        return Promise.all(texPromises)
    }
    goToDriver() {
        this.setAttribute("pitch",  4);
        this.setAttribute("yaw",    80);
        this.setAttribute("zoom",  -20);
        this.setAttribute("fov",    60);
        return new Promise(resolve=>this.render(resolve))
    }
    goToPassenger() {
        this.setAttribute("pitch",  4);
        this.setAttribute("yaw",   -80);
        this.setAttribute("zoom",  -20);
        this.setAttribute("fov",    60);
        return new Promise(resolve=>this.render(resolve))
    }
    goToIp() {
        this.setAttribute("pitch",  4);
        this.setAttribute("yaw",    0);
        this.setAttribute("zoom",  -20);
        this.setAttribute("fov",    60);
        return new Promise(resolve=>this.render(resolve))
    }
    goToRear() {
        this.setAttribute("pitch", -10);
        this.setAttribute("yaw",    180);
        this.setAttribute("zoom",  -20);
        this.setAttribute("fov",    60);
        return new Promise(resolve=>this.render(resolve))
    }
    
    // EVENT HANDLERS
    onMouseMove(e) {
        // freeze view if we're in thumbnails
        if (this.closest("#thumbs")) {return}
        
        if (e.ctrlKey && e.buttons) {
            // ctrl-drag => zoom
            let dz = e.y - this.cursorPrev.y;
            dz *= 0.1;
            let prevZoom = Number(this.getAttribute("zoom"));
            this.setAttribute("zoom", prevZoom+dz);
            this.render()
        } else if (e.buttons) {
            // drag => pan
            let dx = e.x - this.cursorPrev.x;
            let dy = e.y - this.cursorPrev.y;
            dx *= 0.1; dy *= 0.1;
            let prevPitch = Number(this.getAttribute("pitch"));
            let prevYaw   = Number(this.getAttribute("yaw"));
            this.setAttribute("pitch", (prevPitch + dy) % 360);
            this.setAttribute("yaw",   (prevYaw   + dx) % 360);
            this.render()
        }
        // save data for next time
        this.cursorPrev.x = e.x;
        this.cursorPrev.y = e.y;
    }
    onWheel(e) {
        // zoom in or out
        let multiplier = 0.01;
        // shift => fast zoom
        if (e.shiftKey) {multiplier = 0.1;}
        let dScrollY = this.cursorPrev.scrollY - e.wheelDeltaY;
        dScrollY *= multiplier;
        let prevZoom = Number(this.getAttribute("zoom"))
        this.setAttribute("zoom", prevZoom+dScrollY);
        this.render()
    }
    onMouseEnter(e) {
        // add keypress listeners to change the cursor style for zooming
        this.ctrlKeyListener = this.ctrlKeyController.bind(this);
        document.addEventListener("keydown", this.ctrlKeyListener)
        document.addEventListener("keyup", this.ctrlKeyListener)
    }
    onMouseLeave(e) {
        // remove keypress listeners
        document.removeEventListener("keydown", this.ctrlKeyListener)
        document.removeEventListener("keyup", this.ctrlKeyListener)
    }
    ctrlKeyController(e) {
        // ctrl => show zoom cursor
        if (e.ctrlKey) {this.style = "cursor: ns-resize;";}
        else {this.style = "";}
    }
    onKeyDown(e) {
        // Ignore all but the arrow keys
        if (!e.key.startsWith("Arrow")) return;
        const keyUp    = e.key==="ArrowUp";
        const keyDown  = e.key==="ArrowDown";
        const keyLeft  = e.key==="ArrowLeft";
        const keyRight = e.key==="ArrowRight";
        
        // Set movement multiplier
        let moveAmount = e.shiftKey ? 1 : 5;
        
        // Decide whether we're zooming or panning
        if (e.ctrlKey) {
            // Which way are we zooming?
            let direction = 0;
            if (keyUp)   direction = +1;
            if (keyDown) direction = -1;
            
            // Get, change, and update the zoom attribute
            let zoom = Number(this.getAttribute("zoom"));
            zoom += moveAmount * direction;
            this.setAttribute("zoom", zoom)
        } else if (keyUp||keyDown) {
            // Which way are we pitching?
            let direction = 0;
            if (keyUp)   direction = +1;
            if (keyDown) direction = -1;
            
            // Get, change, and update the pitch attribute
            let pitch = Number(this.getAttribute("pitch"));
            pitch += moveAmount * direction;
            this.setAttribute("pitch", pitch)
        } else if (keyLeft||keyRight) {
            // Which way are we yawing?
            let direction = 0;
            if (keyLeft)  direction = +1;
            if (keyRight) direction = -1;
            
            // Get, change, and update the yaw attribute
            let yaw = Number(this.getAttribute("yaw"));
            yaw += moveAmount * direction;
            this.setAttribute("yaw", yaw)
        }
        this.render()
    }
    
    // WEB GRAPHICS LIBRARY
    async getImage(height=1944, width=2592) {let gl = this.getContext("webgl");
        // scale canvas to full resolution
        let origHeight = gl.canvas.height;
        let origWidth = gl.canvas.width;
        gl.canvas.height = height;
        gl.canvas.width = width;
        this.render()
        // create image
        let blobPromise = new Promise( (resolve, reject)=>{
            gl.canvas.toBlob((blob)=>{
                if (blob) {resolve(blob)} else {reject()}
            })
        });
        let blob = await blobPromise;
        // reset canvas
        gl.canvas.height = origHeight;
        gl.canvas.width = origWidth;
        this.render()
        // return image
        let url = URL.createObjectURL(blob);
        return url
    }
    
    initGl() {let gl = this.getContext("webgl");
        // compile shaders
        let vertex_shader   = gl.createShader(gl.VERTEX_SHADER);
        let fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vertex_shader, VERTEX_SHADER_SOURCE);
        gl.shaderSource(fragment_shader, FRAGMENT_SHADER_SOURCE);
        gl.compileShader(vertex_shader);
        gl.compileShader(fragment_shader);
        console.debug(`vertex_shader compile status: ${gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)}`)
        console.debug(`fragment_shader compile status: ${gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)}`)
        // attach shaders
        this.program = gl.createProgram()
        gl.attachShader(this.program, vertex_shader)
        gl.attachShader(this.program, fragment_shader)
        gl.linkProgram(this.program)
        console.debug(`program link status: ${gl.getProgramParameter(this.program, gl.LINK_STATUS)}`)
        
        // look up memory locations
        this.locations.position = gl.getAttribLocation(this.program, "a_position");
        this.locations.skybox = gl.getUniformLocation(this.program, "u_skybox");
        this.locations.viewDirectionProjectionInverse = gl.getUniformLocation(this.program, "u_viewDirectionProjectionInverse");

        // create and bind a buffer for positions
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // load the buffer
        PanoViewer.setGeometry(gl);
        
        // create cubemap
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture)
        // add images to cubemap
        this.loadTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_X, this.pano_r || "images/pano_r.jpg")
        this.loadTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, this.pano_l || "images/pano_l.jpg")
        this.loadTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, this.pano_u || "images/pano_u.jpg")
        this.loadTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, this.pano_d || "images/pano_d.jpg")
        this.loadTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, this.pano_b || "images/pano_b.jpg")
        this.loadTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, this.pano_f || "images/pano_f.jpg")
        // finish cubemap setup
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    loadTexture(target, url) {let gl = this.getContext("webgl");
        // build fake texture for immediate results
        let level = 0;
        let internalFormat = gl.RGBA;
        let width = 1712;
        let height = 1712;
        let format = gl.RGBA;
        let type = gl.UNSIGNED_BYTE;
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null)
        
        // Asynchronously load the image
        let image = new Image();
        let imageLoadedPromise = new Promise((resolve)=>{
            image.addEventListener('load', ()=>{
                // Now that the image has loaded make copy it to the texture.
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
                gl.texImage2D(target, level, internalFormat, format, type, image);
                    requestAnimationFrame(this.render.bind(this, resolve))
                })
        })
        image.src = url;
        return imageLoadedPromise;
    }
    render(callback) {let gl = this.getContext("webgl");
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        // Clear canvas and depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Tell it to use our program (pair of shaders)
        gl.useProgram(this.program);
        
        // Turn on the position attribute
        gl.enableVertexAttribArray(this.locations.position);
        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        let size = 2;          // 2 components per iteration
        let type = gl.FLOAT;   // the data is 32bit floats
        let normalize = false; // don't normalize the data
        let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        let offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(this.locations.position, size, type, normalize, stride, offset);
        
        // lookup view attributes
        let pitch = Number(this.getAttribute("pitch"));
        let yaw   = Number(this.getAttribute("yaw"));
        let zoom  = Number(this.getAttribute("zoom"));
        let fov   = Number(this.getAttribute("fov"));
        
        // Compute the projection matrix
        let fieldOfViewRadians = degToRad(fov);
        let zoomRadians = degToRad(zoom);
        let aspect = -gl.canvas.clientWidth / gl.canvas.clientHeight;
        let projectionMatrix = perspective(fieldOfViewRadians-zoomRadians, aspect, 1, 2000);
        // find camera angle
        let yawRadians   = degToRad(-yaw);
        let pitchRadians = degToRad(pitch);
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
        let viewMatrix = inverse(cameraMatrix);
        // We only care about direction so remove the translation
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;
        
        // Set the uniforms
        let viewDirectionProjectionMatrix        = multiply(projectionMatrix, viewMatrix);
        let viewDirectionProjectionInverseMatrix = inverse(viewDirectionProjectionMatrix);
        gl.uniformMatrix4fv(
            this.locations.viewDirectionProjectionInverse, false,
            viewDirectionProjectionInverseMatrix);
        // Tell the shader to use texture unit 0 for u_skybox
        gl.uniform1i(this.locations.skybox, 0);
        // let our quad pass the depth test at 1.0
        gl.depthFunc(gl.LEQUAL)
        // Draw the geometry.
        gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

        // hacky way to allow some level of asynchronicity without making the
        // entire thing an async function
        if (callback) {
            gl.finish()
            callback();
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

window.customElements.define("pano-viewer", PanoViewer, {extends:"canvas"})

// use document.createElement("canvas", {is:"pano-viewer"}) to create new instances
