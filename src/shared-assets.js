const VINREGEX   = /^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$/i;
const LOTREGEX = /\d{8}/i;
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    searchPoctra: true,
    searchBidfax: true
}
const VehicleABC = class {
    TO_SERIALIZE = ["tabId",
                    "vin",
                    "salvage",
                    "lotNumber",
                    "listingUrl",
                    "imageInfo",
                    "imageUrls"]
    constructor(values=null) {
        this.TO_SERIALIZE.forEach(k=> this[k]=null)
        if (values) {Object.assign(this, values)}
    }
    
    //INPUT
    onMessage(message) {
        message.values.vin       = this.validateVin(message.values.vin)
        message.values.lotNumber = this.validateLot(message.values.lotNumber)
        Object.assign(this, message.values)
    }
    validateVin(vin) {
        if (!vin) {return}
        let safe = encodeURIComponent(vin.replace(/^\s+|\s+$/g, ""));
        if (VINREGEX.test(safe)) {return safe}
    }
    validateLot(lot) {
        if (!lot) {return}
        let safe = encodeURIComponent(lot.replace(/\D/g, ""));
        if (LOTREGEX.test(safe)) {return safe}
    }
    
    // OUTPUT
    serialize(overrides) {
        let serialized = Object.fromEntries(this.TO_SERIALIZE.map(k=>[k, this[k]]))
        if (Unserializable.isPrototypeOf(this.salvage)) {
            serialized.salvage = this.salvage.NAME;
        }
        Object.assign(serialized, overrides)
        Object.setPrototypeOf(serialized, VehicleABC)
        return serialized;
    }
    async getTab() {
        if (this.tabId) {return await browser.tabs.get(this.tabId)}
    }
    imageUrlsCount() {
        if (!this.imageUrls) {return 0}
        return this.imageUrls.length
    }
}

class BackgroundVehicle extends VehicleABC {
    reply(options={}) {
        this.port.postMessage({values: this.serialize(), ...options})
    }
    setPort(port) {
        this.port = port;
        port.onMessage.addListener(this.onMessage.bind(this))
    }
    
}

let Unserializable = {}
let Salvage = {__proto__:Unserializable};
let Archive = {__proto__:Unserializable};

const defaultedSettings = async () => {
    let storage = await browser.storage.local.get("settings");
    let settings = storage.settings || new Object;
    if (
        !Object.keys(DEFAULT_SETTINGS).every(k=>settings.hasOwnProperty(k))
    ) {
        settings = Object.assign(DEFAULT_SETTINGS, settings);
        browser.storage.local.set({settings})
    }
    return settings
}
const sendNotification = (message, options={}) => {
    // quick feedback notification creation with error catching
    let value = Object.assign(options, {action: "feedback-message",
                                        message:message});
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>{
            if (err.message==="Could not establish connection. Receiving end does not exist.")
                    {console.log("\n\nConnection error. Is the popup closed?")}
            else {console.log(err)}
        })
}
const notifyUntilSuccess = () => {
    let successful = false;
    return (message, options={})=>{ if (!successful) {
        successful = options.displayAs==="success";
        sendNotification(message, options)
    }}
}

const sendProgress = (recipient, behavior, options={}) => {
    let action = `${recipient}-${behavior}`
    let value = Object.assign(options, {action:action})
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>console.log(err+"\n is the popup closed?"))
}
