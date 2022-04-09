// Helper functions are in viewer-helpers.js

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
