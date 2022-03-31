const VINREGEX   = /^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$/i;
const LOTREGEX = /^\d{8}$/i;
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    searchPoctra: true,
    searchBidfax: true
}

const validateVin = (vin)=>{
    if (!vin) {return}
    let safe = encodeURIComponent(vin.replace(/\s/g, ""));
    if (VINREGEX.test(safe)) {return safe}
}
const validateLot = (lot)=>{
    if (!lot) {return}
    let safe = encodeURIComponent(lot.replace(/\s/g, ""));
    if (LOTREGEX.test(safe)) {return safe}
}

const VehicleABC = class {
    TO_SERIALIZE = ["tabId",
                    "vin",
                    "salvage",
                    "lotNumber",
                    "listingUrl",
                    "imageInfo",
                    "imageUrls",
                    "walkaroundUrls",
                    "panoUrls"]
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

let Unserializable = new Object;
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
const connectionFailure = (err)=>{
    return err.message==="Could not establish connection. Receiving end does not exist.";
};
const sendNotification = (payload) => {
    // quick feedback notification creation with error catching
    browser.runtime.sendMessage({message: payload}).catch(
        err=>{
            if (!connectionFailure(err)) console.log(err);
            console.log("Connection error. Is the popup closed?")
        }
    )
}
const notifyUntilSuccess = (port)=>{
    /*
    Sends notifications until one is successful, then blocks the rest.
    */
    
    // Set success state
    let successful = false;
    
    // Notification function
    return (message, options={})=>{
        if (!successful) {
            // Update success state
            successful = options.displayAs==="success";
            
            // Merge options into payload
            const feedback = {action:"feedback-message", message};
            Object.assign(feedback, options)
            
            // Send complete message
            port.postMessage({feedback})
            
            // Let the caller know a message was sent
            return true;
        }
    }
}

const sendProgress = (recipient, behavior, options={}) => {
    let action = `${recipient}-${behavior}`
    let value = Object.assign(options, {action:action})
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>console.log(err+"\n is the popup closed?"))
}



