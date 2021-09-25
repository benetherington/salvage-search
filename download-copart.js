// CONTENT SCRIPT
// loaded on https://*copart.com/lot/*

async function downloadUri(url, name) {
    // Opens a single URI in a new tab for click-drop downloading
    var link = document.createElement("a");
    link.text = name;
    link.download = name;
    link.href = url;
    link.target = "_blank";
    link.click();
};

function clickDragDownload(hdUrls) {
    // Downloads a single image at a time
    hdUrls.forEach((url) => {
        let name = url.match( /[^\/]*$/ )[0]
        downloadUri(url, name);
    });
};

browser.runtime.onMessage.addListener( (message) => {
    // incoming messages from background.js will contain image URLs to download
    if (message.type == 'copart') {
        console.log("That's a copart message!")
        let hdUrls = message.values.map(value=>{return value.hdUrls}).flat()
        clickDragDownload(hdUrls);
        return Promise.resolve('done');
    };
    return false
});

console.log("download-copart loaded!");

// -url:https://www.copart.com/ -url:chrome-extension://gfhcppdamigjkficnjnhmnljljhagaha/content.js -url:https://www.copart.com/wro/startup_bundle-b3e237deb012d74ef7eb4b383ecda89e.js
