WALKAROUND_VIEWER_STYLE = `<style>
:host {
    /* allow corner snipping */
    overflow: hidden;
    /* style container */
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    cursor: ew-resize;
    /* lay-out container */
    display: flex;
}

img {
    width: 100%;
    object-fit: cover;
}
</style>`


class WalkaroundViewer extends HTMLElement {
    constructor() {
        super()
        
        this.DRAG_DISTANCE = 10;
        
        this.angles = [];
        this.currentIdx = 0;
        this.saved = [];
        this.cursorPrev = null;
    }
    connectedCallback() {
        if (!this.isConnected) {return}
        
        // attach shadow, add style
        this.attachShadow({mode:"open"})
        this.shadowRoot.innerHTML = WALKAROUND_VIEWER_STYLE;
        // add image element
        this.imageEl = document.createElement("img");
        this.imageEl.draggable = false;
        this.shadowRoot.append(this.imageEl)
        // add pointer events
        this.addEventListener("mousemove", this.onMouseMove.bind(this))
        this.addEventListener("wheel", this.onWheel.bind(this))
        // add keyboard events
        document.addEventListener("keydown", this.onKeyDown.bind(this))
    }
    setAngles(urls) {
        this.angles = urls;
        this.render()
    }
    getThumbnail() {
        // create a container
        let div = document.createElement("div");
        div.classList.add("img-container")
        div.setAttribute("idx", this.currentIdx)
        // create a delete hover-icon
        let span = document.createElement("span");
        span.classList.add("delete-icon")
        span.addEventListener("click", (e)=>{div.remove()})
        div.append(span)
        // add the current image
        let img = this.imageEl.cloneNode();
        div.append(img)
        return div;
    }
    render() {
        // Check currentIdx and wrap around edges. This will break if
        // idx is +/- length*2, but whatever.
        if (this.currentIdx>=this.angles.length) {
            // wrap around to the beginning
            this.currentIdx = this.currentIdx-this.angles.length;
        }
        if (this.currentIdx<0) {
            // wrap around to the end
            this.currentIdx = this.angles.length+this.currentIdx;
        }
        this.imageEl.src = this.angles[this.currentIdx];
    }
    onMouseMove(e) {
        if (!e.buttons) {
            // drag has not started yet, capture position
            this.cursorPrev = e.x;
            return;
        }
        let dragDelta     =  Math.abs( e.x - this.cursorPrev);
        let dragDirection = -Math.sign(e.x - this.cursorPrev);
        if (Math.abs(dragDelta) < this.DRAG_DISTANCE) {
            // drag is not long enough to pop in the next image
            return;
        }
        // time to pop to next image!
        let shiftMultiplier = 1;
        if (e.shiftKey) {
            shiftMultiplier = 5;
        }
        this.currentIdx += dragDirection*shiftMultiplier;
        this.cursorPrev = e.x;
        this.render()
    }
    onWheel(e) {
        let shiftMultiplier = 1;
        if (e.shiftKey) {
            shiftMultiplier = 5;
        }
        this.currentIdx += Math.sign(e.wheelDeltaY)*shiftMultiplier;
        this.render()
    }
    onKeyDown(e) {
        let shiftMultiplier = 1;
        if (e.shiftKey) {
            shiftMultiplier = 5;
        }
        switch (e.key) {
            case "ArrowLeft":
                this.currentIdx += -1*shiftMultiplier;
                this.render()
                break;
            case "ArrowRight":
                this.currentIdx += +1*shiftMultiplier;
                this.render()
                break;
        }
    }
}

window.customElements.define("walkaround-viewer", WalkaroundViewer)