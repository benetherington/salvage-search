class ProgressButton extends HTMLDivElement {
    constructor () {
        const pButton = super();
        pButton.status = "enabled";
        pButton.total = 1;
        pButton.progress = 1;
        pButton.classList.add("loaded")
    }
    start(total=0) {
        this.className = this.dataset.styleOrig;
        this.classList.add("feedback-busy");
        this.total = total;
        // If we got a total, set progress at zero. If not, set it at 1 so that
        // we start full color, ie 100%
        this.progress = total?0:1;
        this.update()
    }
    increment() {
        this.className = this.dataset.styleOrig
        this.classList.add("feedback-progress")
        ++this.progress
        this.update()
    }
    update() {
        this.style.setProperty(
            "--progress-percentage",
            `${this.progress/this.total*100}%`
        )
    }
    enable() {
        this.className = this.dataset.styleOrig;
    }
    disable() {
        this.className = this.dataset.styleOrig;
        this.classList.add("disabled");
        this.total = this.progress = 1;
    }
    attention() {
        this.className = this.dataset.styleOrig;
        this.classList.add("success-attention");
        this.total = this.progress = 1;
    }
}

customElements.define('progress-button', ProgressButton, { extends: 'div' });

