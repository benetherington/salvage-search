/*-----------*\
  RUN ON LOAD  
\*-----------*/
function getImageKeys() {
    dimensionsString = document.getElementById("fullViewImg").attributes['dimensionsallimagekeys'].nodeValue;
    keysIter = dimensionsString.matchAll(/K":"(.*?)",/g);
    imageKeys = Array.from(keysIter, (item) => item[1]);
    return imageKeys;
}
function collectImageData() {
    let imageData = {
        "type": "iaai",
        "values": getImageKeys()
    };
    browser.runtime.sendMessage(imageData)
};


/*---------*\
  DOWNLOADS  
\*---------*/
function clickDragDownload(storage) {
    console.log("click drag invoked")
    // Update loadingBar. Start at 50%. Max will be twice the number of images
    // we have to handle, so that we hit 100% after iterating once for each
    // image.
    loadingBar.progress = storage.length
    loadingBar.max = Object.keys(storage).length*2
    for ( [key, value] of Object.entries(storage) ) {
        console.log(key)
        if (parseInt(key)+1) { // add to avoid falsy zero
            // that's a large image
            downloadUri(value, key);
            try {browser.storage.local.remove(key.toString());}
            catch (err) {console.log(err)};
        };
        loadingBar.increment()
    };
    loadingBar.hide()
    console.log("click drag done!")
};
async function downloadUri(uri, name) {
    // Opens a single URI in a new tab for click-drop downloading
    var link = document.createElement("a");
    link.text = name+".png ";
    link.download = name;
    link.href = uri;
    link.target = "_blank";
    link.click()
};

/*--------*\
  MESSAGES  
\*--------*/
function messageHandler(data) {
    // listens to incoming messages and downloads copart uris
    if (data.type == 'iaai' && data.values == "storage-local") {
        // incoming request to download large images from storage
        console.log("iaai downloading from storage")
        browser.storage.local.get()
            .then(storage => {
                clickDragDownload(storage)
            })
        return Promise.resolve('done')
    } else if (data.type == 'iaai') {
        // incoming request to download included images
        console.log("iaai downloading from message")
        clickDragDownload(data.values);
        return Promise.resolve('done');
    } else if (data.type == 'loading_bar') {
        // incoming request to start or update a loading bar
        loadingBar.handleMessage(data)
        return Promise.resolve('done')
    };
    console.log("message wasn't for iaai")
    return false;
};


/*---------*\
  UTILITIES  
\*---------*/
var loadingBar = new class {
    constructor() {
        this.indicator = document.createElement("progress")
        this.indicator.id = 'download-iaai-indicator'
        this.indicator.max = 1
    }
    set progress(value=0) {
        if (value) {
            document.body.prepend(this.indicator);
            this.indicator.value=value
        } else { this.indicator.removeAttribute('value') };
    }
    get progress() {
        return this.indicator.value
    }
    set max(value) {
        window.scrollTo(0,0)
        this.indicator.max = Math.ceil(value)
    }
    handleMessage(data) {
        if      (data.action == 'progress')  { this.progress = data.progress }
        else if (data.action == 'stop')      { this.hide() }
        else if (data.action == 'increment') { this.increment() }
        else if (data.action == 'configure') { this.max = data.max };
    }
    increment() {
        ++this.progress
    }
    hide() {
        this.indicator.remove()
    }
}

/*-----*\
  SETUP  
\*-----*/
browser.runtime.onMessage.addListener( messageHandler );
collectImageData()
console.log("download-iaai loaded!")
