// CONTENT SCRIPT
// loaded on https://*copart.com/lot/*

async function downloadUri(uri, name) {
    // Opens a single URI in a new tab for click-drop downloading
    var link = document.createElement("a");
    link.text = name;
    link.download = name;
    link.href = uri;
    link.target = "_blank";
    link.click();
};

function clickDragDownload(uriArray) {
    // Downloads a single image at a time
    uriArray.forEach((uri) => {
        let name = uri.match( /[^\/]*$/ )[0]
        downloadUri(uri, name);
    });
};

function messageHandler(data) {
    // incoming messages from background.js will contain image URLs to download
    if (data.type == 'copart') {
        clickDragDownload(data.values);
        return Promise.resolve('done');
    };
    return false
};

browser.runtime.onMessage.addListener(messageHandler);
console.log("download-copart loaded!");

