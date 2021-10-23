const VINREGEX = RegExp("^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$", "i");
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    searchPoctra: true
}
const sendNotification = (message, options={}) => {
    // quick feedback notification creation with error catching
    let value = Object.assign(options, {action: "feedback-message", message:message});
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>console.log(err+"\n is the popup closed?"))
}
const sendProgress = (recipient, behavior, options={}) => {
    let action = `${recipient}-${behavior}`
    let value = Object.assign(options, {action:action})
    let values = [value]
    browser.runtime.sendMessage({type: "feedback", values})
        .catch(err=>console.log(err+"\n is the popup closed?"))
}
