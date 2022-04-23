// Helper functions are in viewer-helpers.js

/*-----*\
  STAGE
\*-----*/
class PanoContainer extends HTMLElement {
    constructor() {
        super();

        // Create shadow DOM
        this.attachShadow({mode: "open"});

        // Add shadow style
        const style = document.createElement("style");
        style.textContent = PANO_CONTAINER_STYLE;
        this.shadowRoot.append(style);
    }
    connectedCallback() {
        // Don't continue if disconnecting
        if (!this.isConnected) return;

        // Don't continue if shadow already has elements other than style
        if (this.shadowRoot.childElementCount > 1) return;

        // Apply style rules
        this.classList.add("pano-container");

        // add panoviewer
        this.panoViewer = document.createElement("canvas", {is: "pano-viewer"});
        this.shadowRoot.append(this.panoViewer);
    }
    addPano(faces) {
        return this.panoViewer.updateFaces(faces);
    }
    getPano() {
        return this.panoViewer;
    }
    async getThumbnail() {
        // Create a container
        let thumbContainer = document.createElement("thumbContainer");
        thumbContainer.classList.add("thumb-container");

        // Create hover toolbar
        let divHover = document.createElement("thumbContainer");
        divHover.classList.add("hover-bar");
        thumbContainer.append(divHover);

        // Add edit button to toolbar
        let spanEdit = document.createElement("span");
        spanEdit.classList.add("hover-icon");
        spanEdit.classList.add("edit-icon");
        spanEdit.addEventListener("click", this.restoreFrom.bind(this));
        divHover.append(spanEdit);

        // Add delete button to toolbar
        let spanDelete = document.createElement("span");
        spanDelete.classList.add("hover-icon");
        spanDelete.classList.add("delete-icon");
        spanDelete.addEventListener("click", (e) => thumbContainer.remove());
        divHover.append(spanDelete);

        // Create a placeholder image for the thumbnail
        let img = document.createElement("img");
        img.src = "/icons/hourglass-split.svg";
        thumbContainer.append(img);

        // Start rendering the current view
        new Promise(async () => {
            img.src = await this.panoViewer.getImage();
        });

        // Set view data so we can edit the thumbnail
        let view = {
            pitch: Number(this.panoViewer.getAttribute("pitch")),
            yaw: Number(this.panoViewer.getAttribute("yaw")),
            zoom: Number(this.panoViewer.getAttribute("zoom")),
            fov: Number(this.panoViewer.getAttribute("fov")),
        };
        spanEdit.setAttribute("view", JSON.stringify(view));

        // Done!
        return thumbContainer;
    }
    restoreFrom(e) {
        // Get view attributes
        const {pitch, yaw, zoom, fov} = JSON.parse(
            e.target.getAttribute("view"),
        );

        // Set view attributes
        this.panoViewer.setAttribute("pitch", pitch);
        this.panoViewer.setAttribute("yaw", yaw);
        this.panoViewer.setAttribute("zoom", zoom);
        this.panoViewer.setAttribute("fov", fov);

        // Delete thumbnail
        e.target.closest(".thumb-container").remove();
    }
}
customElements.define("pano-container", PanoContainer);

/*-----------*\
  3D PANORAMA
\*-----------*/
class PanoViewer extends HTMLCanvasElement {
    constructor() {
        // Init from canvas element
        const canvas = super();

        // Get A WebGL context
        const gl = canvas.getContext("webgl");
        if (!gl) return;

        // Initialize variables
        this.cursorPrev = {x: 0, y: 0, scrollY: 0};
        this.locations = {
            position: null,
            skybox: null,
            viewDirectionProjectionInverse: null,
        };
    }
    connectedCallback() {
        // Only add event listeners, etc once
        if (this.initiated) return;

        // patch in dataset values for cloning purposes
        if (!this.hasAttribute("pitch")) {
            this.setAttribute("pitch", 0);
            this.setAttribute("yaw", 0);
            this.setAttribute("zoom", -20);
            this.setAttribute("fov", 60);
        }

        // if we get resized, we'll still generate the same pixels, and they'll
        // be mushed onto the canvas in the wrong resultion at best, and skewed
        // at worst. A ResizeObserver can trigger updates for us.
        let resizeObserver = new ResizeObserver((entries, observer) => {
            this.height = entries[0].contentBoxSize[0].blockSize;
            this.width = entries[0].contentBoxSize[0].inlineSize;
            this.render();
        });
        resizeObserver.observe(this);

        // Listen for pan/zoom events
        this.addEventListener("mousemove", this.onMouseMove.bind(this));
        this.addEventListener("wheel", this.onWheel.bind(this));
        document.addEventListener("keydown", this.onKeyDown.bind(this));
        document.addEventListener("keyup", this.onKeyUp.bind(this));

        // Do 3D stuff.
        this.initGl();
        this.initiated = true;
    }

    // COMPOSER INTERFACE
    static get observedAttributes() {
        return ["pitch", "yaw", "zoom", "fov"];
    }
    attributeChangedCallback(attrName, oldValue, newValue) {
        this.render();
    }
    updateFaces(faces) {
        const gl = this.getContext("webgl");

        // Asynchronously load textures
        let texPromises = [];
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                faces.pano_r || "images/pano_r.jpg",
            ),
        );
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                faces.pano_l || "images/pano_l.jpg",
            ),
        );
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                faces.pano_u || "images/pano_u.jpg",
            ),
        );
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                faces.pano_d || "images/pano_d.jpg",
            ),
        );
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
                faces.pano_b || "images/pano_b.jpg",
            ),
        );
        texPromises.push(
            this.loadTexture(
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                faces.pano_f || "images/pano_f.jpg",
            ),
        );
        this.render();

        // Hand back a promise so that composer can wait for us when needed
        return Promise.all(texPromises);
    }
    goToDriver() {
        this.setAttribute("pitch", 4);
        this.setAttribute("yaw", 80);
        this.setAttribute("zoom", -20);
        this.setAttribute("fov", 60);
        return new Promise((resolve) => this.render(resolve));
    }
    goToPassenger() {
        this.setAttribute("pitch", 4);
        this.setAttribute("yaw", -80);
        this.setAttribute("zoom", -20);
        this.setAttribute("fov", 60);
        return new Promise((resolve) => this.render(resolve));
    }
    goToIp() {
        this.setAttribute("pitch", 4);
        this.setAttribute("yaw", 0);
        this.setAttribute("zoom", -20);
        this.setAttribute("fov", 60);
        return new Promise((resolve) => this.render(resolve));
    }
    goToRear() {
        this.setAttribute("pitch", -10);
        this.setAttribute("yaw", 180);
        this.setAttribute("zoom", -20);
        this.setAttribute("fov", 60);
        return new Promise((resolve) => this.render(resolve));
    }

    // ZOOM/PAN EVENTS
    onMouseMove(e) {
        // Save cursor position to compare against later
        const {x: prevX, y: prevY} = this.cursorPrev;
        this.cursorPrev.x = e.x;
        this.cursorPrev.y = e.y;

        // What are we doing?
        const dragging = e.buttons;
        const zooming = e.ctrlKey;

        // Update cursor
        this.setZoomCursor(zooming);

        // If we're not dragging, we're done
        if (!dragging) return;

        if (zooming) {
            // Find how far the curor has moved up
            const moveAmount = e.y - prevY;

            // Get, change, and update zoom attribute
            let zoom = Number(this.getAttribute("zoom"));
            zoom += moveAmount * 0.1;
            this.setAttribute("zoom", zoom);
        } else {
            // Find out how far the cursor has moved
            const yDistance = e.y - prevY;
            const xDistance = e.x - prevX;

            // Get pitch and yaw attributes
            let pitch = Number(this.getAttribute("pitch"));
            let yaw = Number(this.getAttribute("yaw"));

            // Increment pitch and yaw
            pitch += yDistance * 0.1;
            yaw += xDistance * 0.1;
            pitch %= 360;
            yaw %= 360;

            // Update pitch and yaw attributes
            this.setAttribute("pitch", pitch);
            this.setAttribute("yaw", yaw);
        }

        // Done!
        this.render();
    }
    onWheel(e) {
        // Set movement multiplier
        const moveAmount = e.shiftKey ? 0.1 : 0.02;

        // Find out how far the wheel has moved
        let scrollDistance = this.cursorPrev.scrollY - e.wheelDeltaY;

        // Get, change, and update the zoom attribute
        let zoom = Number(this.getAttribute("zoom"));
        zoom -= scrollDistance * moveAmount;
        this.setAttribute("zoom", zoom);

        // Done!
        this.render();
    }
    onKeyDown(e) {
        // Check for ctrl, but don't unset the cursor (until keyup)
        const zooming = e.key === "Control";
        if (zooming) this.setZoomCursor(true);

        // Check for arrow keys (pan/tilt/zoom)
        if (!e.key.startsWith("Arrow")) return;
        const keyUp = e.key === "ArrowUp";
        const keyDown = e.key === "ArrowDown";
        const keyLeft = e.key === "ArrowLeft";
        const keyRight = e.key === "ArrowRight";

        // Set movement multiplier
        let moveAmount = e.shiftKey ? 1 : 5;

        // Decide whether we're zooming or panning
        if (e.ctrlKey) {
            // Which way are we zooming?
            let direction = 0;
            if (keyUp) direction = +1;
            if (keyDown) direction = -1;

            // Get, change, and update the zoom attribute
            let zoom = Number(this.getAttribute("zoom"));
            zoom += moveAmount * direction;
            this.setAttribute("zoom", zoom);
        } else if (keyUp || keyDown) {
            // Which way are we pitching?
            let direction = 0;
            if (keyUp) direction = +1;
            if (keyDown) direction = -1;

            // Get, change, and update the pitch attribute
            let pitch = Number(this.getAttribute("pitch"));
            pitch += moveAmount * direction;
            this.setAttribute("pitch", pitch);
        } else if (keyLeft || keyRight) {
            // Which way are we yawing?
            let direction = 0;
            if (keyLeft) direction = +1;
            if (keyRight) direction = -1;

            // Get, change, and update the yaw attribute
            let yaw = Number(this.getAttribute("yaw"));
            yaw += moveAmount * direction;
            this.setAttribute("yaw", yaw);
        }
        this.render();
    }
    onKeyUp(e) {
        // Check for end of zoom state
        if (e.key === "Control") this.setZoomCursor(false);
    }

    // CURSOR ZOOM ICON
    setZoomCursor(zooming) {
        // ctrl => show zoom cursor
        if (zooming) this.style = "cursor: ns-resize;";
        else this.style = "";
    }

    // WEB GRAPHICS LIBRARY
    async getImage(height = 1944, width = 2592) {
        const gl = this.getContext("webgl");

        // Scale canvas to full resolution
        let origHeight = gl.canvas.height;
        let origWidth = gl.canvas.width;
        gl.canvas.height = height;
        gl.canvas.width = width;
        this.render();

        // Get blob using callback
        const blobPromise = new Promise((resolve) => {
            gl.canvas.toBlob((blob) => resolve(blob));
        });
        const blob = await blobPromise;

        // Reset canvas size
        gl.canvas.height = origHeight;
        gl.canvas.width = origWidth;
        this.render();

        // Return image URL
        return URL.createObjectURL(blob);
    }

    initGl() {
        const gl = this.getContext("webgl");

        // Compile shaders
        const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
        const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vertex_shader, VERTEX_SHADER_SOURCE);
        gl.shaderSource(fragment_shader, FRAGMENT_SHADER_SOURCE);
        gl.compileShader(vertex_shader);
        gl.compileShader(fragment_shader);

        // Check for compile errors
        const vertexShaderStatus = gl.getShaderParameter(
            vertex_shader,
            gl.COMPILE_STATUS,
        );
        const fragmentShaderStatus = gl.getShaderParameter(
            fragment_shader,
            gl.COMPILE_STATUS,
        );
        if (!vertexShaderStatus)
            console.error("The vertex shader failed to compile.");
        if (!fragmentShaderStatus)
            console.error("The fragment shader failed to compile.");

        // Create a shader program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertex_shader);
        gl.attachShader(this.program, fragment_shader);

        // Link the program, check for errors
        gl.linkProgram(this.program);
        const programLinkStatus = gl.getProgramParameter(
            this.program,
            gl.LINK_STATUS,
        );
        if (!programLinkStatus)
            console.error("The shader program failed to link.");

        // Look up memory locations for later use
        this.locations.position = gl.getAttribLocation(
            this.program,
            "a_position",
        );
        this.locations.skybox = gl.getUniformLocation(this.program, "u_skybox");
        this.locations.viewDirectionProjectionInverse = gl.getUniformLocation(
            this.program,
            "u_viewDirectionProjectionInverse",
        );

        // Create, bind, and use a position buffer
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        PanoViewer.setGeometry(gl);

        // Create a texture cubemap
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);

        // Load placeholder images
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            this.pano_r || "images/pano_r.jpg",
        );
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            this.pano_l || "images/pano_l.jpg",
        );
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            this.pano_u || "images/pano_u.jpg",
        );
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            this.pano_d || "images/pano_d.jpg",
        );
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            this.pano_b || "images/pano_b.jpg",
        );
        this.loadTexture(
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            this.pano_f || "images/pano_f.jpg",
        );

        // Set cubemap parameters
        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_WRAP_S,
            gl.CLAMP_TO_EDGE,
        );
        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_WRAP_T,
            gl.CLAMP_TO_EDGE,
        );
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    loadTexture(target, url) {
        const gl = this.getContext("webgl");

        // Build an empty texture for immediate results
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1712;
        const height = 1712;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        gl.texImage2D(
            target,
            level,
            internalFormat,
            width,
            height,
            0,
            format,
            type,
            null,
        );

        // Asynchronously load the image
        const image = new Image();
        const imageLoadedPromise = new Promise((resolve) => {
            image.addEventListener("load", () => {
                // Now that the image has loaded make copy it to the texture.
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
                gl.texImage2D(
                    target,
                    level,
                    internalFormat,
                    format,
                    type,
                    image,
                );
                requestAnimationFrame(this.render.bind(this, resolve));
            });
        });
        image.src = url;

        // Return a promise so the calling function can wait on us
        return imageLoadedPromise;
    }
    render(callback) {
        const gl = this.getContext("webgl");

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
        const size = 2; // 2 components per iteration
        const type = gl.FLOAT; // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0; // start at the beginning of the buffer
        gl.vertexAttribPointer(
            this.locations.position,
            size,
            type,
            normalize,
            stride,
            offset,
        );

        // lookup view attributes
        const pitch = Number(this.getAttribute("pitch"));
        const yaw = Number(this.getAttribute("yaw"));
        const zoom = Number(this.getAttribute("zoom"));
        const fov = Number(this.getAttribute("fov"));

        // Compute the projection matrix
        const fieldOfViewRadians = degToRad(fov);
        const zoomRadians = degToRad(zoom);
        const aspect = -gl.canvas.clientWidth / gl.canvas.clientHeight;
        const projectionMatrix = perspective(
            fieldOfViewRadians - zoomRadians,
            aspect,
            1,
            2000,
        );
        // find camera angle
        const yawRadians = degToRad(-yaw);
        const pitchRadians = degToRad(pitch);
        // point the camera
        let cameraMatrix = new Float32Array([
            -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1,
        ]);
        yRotate(cameraMatrix, yawRadians, cameraMatrix);
        xRotate(cameraMatrix, pitchRadians, cameraMatrix);
        // Make a view matrix from the camera matrix.
        let viewMatrix = inverse(cameraMatrix);
        // We only care about direction so remove the translation
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;

        // Set the uniforms
        let viewDirectionProjectionMatrix = multiply(
            projectionMatrix,
            viewMatrix,
        );
        let viewDirectionProjectionInverseMatrix = inverse(
            viewDirectionProjectionMatrix,
        );
        gl.uniformMatrix4fv(
            this.locations.viewDirectionProjectionInverse,
            false,
            viewDirectionProjectionInverseMatrix,
        );
        // Tell the shader to use texture unit 0 for u_skybox
        gl.uniform1i(this.locations.skybox, 0);
        // let our quad pass the depth test at 1.0
        gl.depthFunc(gl.LEQUAL);
        // Draw the geometry.
        gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

        // hacky way to allow some level of asynchronicity without making the
        // entire thing an async function
        if (callback) {
            gl.finish();
            callback();
        }
    }
    static setGeometry(gl) {
        // Fill the buffer with the values that define a quad.
        var positions = new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }
}

window.customElements.define("pano-viewer", PanoViewer, {extends: "canvas"});

// use document.createElement("canvas", {is:"pano-viewer"}) to create new instances
