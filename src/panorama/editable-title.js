class EditableTitle extends HTMLElement {
    static get observedAttributes() { return [] }
    constructor() {
        super();
        let shadow = this.attachShadow({mode: 'open'});
        
    }
    connectedCallback() {
        this.addEventListener('click', this.onClick.bind(this))
    }
    onClick(e) {
        
    }
}

window.customElements.define("editable-title", EditableTitle)
