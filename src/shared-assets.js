const VINREGEX   = /^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$/i;
const LOTREGEX = /\d{8}/i;
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    searchPoctra: true,
    searchBidfax: true
}
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
    let value = Object.assign(options, {action: "feedback-message", message:message});
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>{
            if (err.message==="Could not establish connection. Receiving end does not exist.")
                    {console.log("\n\nConnection error. Is the popup closed?")}
            else {console.log(err)}
        })
}
const sendProgress = (recipient, behavior, options={}) => {
    let action = `${recipient}-${behavior}`
    let value = Object.assign(options, {action:action})
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>console.log(err+"\n is the popup closed?"))
}
