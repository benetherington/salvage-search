const VINREGEX =
    /^[A-HJ-NPR-Z0-9]{3}[A-HJ-NPR-Z0-9]{5}[0-9X][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9]{6}$/i;
const LOTREGEX = /^\d{8}$/i;
const DEFAULT_SETTINGS = {
    searchCopart: true,
    searchIaai: true,
    searchRow52: true,
    searchPoctra: true,
    searchBidfax: true,
    searchStatvin: true,
};
// {"name": this} assigned in each API document
const SALVAGE_APIS = {};

/*---------------------*\
  IMAGE DATA CONVERTERS
\*---------------------*/
// TODO: IAAI does canvas.toDataUrl and runs it through urlFromDataUrl. Could it
// do canvas.getImageData and use urlFromImageData like Copart does? Is that faster?
const urlFromDataUrl = (uri, name) => {
    // Takes a dataURL and turns it into a temporary object URL. This makes it
    // easier to pass around. See: https://stackoverflow.com/a/12300351
    const byteString = atob(uri.split(",")[1]);
    const mimeString = uri.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], {type: mimeString});
    blob.name = name + ".jpg";
    return URL.createObjectURL(blob);
};

const imageDataToDataUrl = (imageData) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpg", 0.92);
};
const urlFromImageData = (imageData) => {
    const dataUrl = imageDataToDataUrl(imageData, "jpg");
    const objectUrl = urlFromDataUrl(dataUrl);
    return objectUrl;
};
const fetchImageData = async (url) => {
    // Fetch image, convert it to a bitmap
    const response = await fetch(url);
    const blob = await response.blob();
    const bmp = await createImageBitmap(blob);

    // Create and configure a canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = bmp.width;
    canvas.height = bmp.height;

    // Convert bmp to imageData using the canvas
    ctx.drawImage(bmp, 0, 0);
    const imageData = ctx.getImageData(0, 0, bmp.width, bmp.height);

    return imageData;
};
const fetchObjectUrl = (imageUrl) => {
    return fetch(imageUrl)
        .then((response) => response.blob())
        .then((blob) => URL.createObjectURL(blob));
};

/*----------------*\
  INPUT VALIDATION
\*----------------*/
// Validate and sanitize user input. These should be used liberally.
const validateVin = (vin) => {
    if (!vin) return;
    const safe = encodeURIComponent(vin.replace(/\s/g, ""));
    if (VINREGEX.test(safe)) return safe;
};
const validateLot = (lot) => {
    if (!lot) return;
    const safe = encodeURIComponent(lot.replace(/\s/g, ""));
    if (LOTREGEX.test(safe)) return safe;
};

/*--------*\
  SETTINGS
\*--------*/
const defaultedSettings = async () => {
    // Fetch stored settings
    const storage = await browser.storage.local.get("settings");

    // Make sure we have something to work with
    let settings = storage.settings || new Object();

    const noKeysMissing = Object.keys(DEFAULT_SETTINGS).every((k) =>
        settings.hasOwnProperty(k),
    );
    if (!noKeysMissing) {
        // Add missing keys by "overwriting" default settings
        settings = Object.assign(DEFAULT_SETTINGS, settings);

        // Store the now-complete settings
        browser.storage.local.set({settings});
    }
    return settings;
};

/*------------------------------*\
  POPUP-BACKGROUND COMMUNICATION
\*------------------------------*/
const connectionFailure = (err) => {
    return (
        err.message ===
        "Could not establish connection. Receiving end does not exist."
    );
};
const sendNotification = (payload, displayAs = "status") => {
    // quick feedback notification creation with error catching
    browser.runtime.sendMessage({message: payload, displayAs}).catch((err) => {
        if (!connectionFailure(err)) console.log(err);
        console.log("Connection error. Is the popup closed?");
    });
};
const notifyUntilSuccess = () => {
    /*
    Sends notifications until one is successful, then blocks the rest.
    */

    // Set success state
    let successful = false;

    // Notification function
    return (payload, displayAs) => {
        if (!successful) {
            // Update success state
            successful = displayAs === "success";

            // Send complete message
            sendNotification(payload, displayAs);

            // Let the caller know a message was sent
            return true;
        }
    };
};
