/*------------------*\
  SETTINGS ACCESSORS
\*------------------*/
const searchPrimaries = async (vin, notify)=>{
    /*
    Performs salvage yard searches.
    
    Requries a VIN and a notify callback.
    
    Returns a Promise.all(), which resolves as an object: {
        salvage: str,
        listingUrl: str,
        extras: [str]
    }
    */
   
    // Set up
    const settings = await defaultedSettings();
    const searchPromises = [];
    
    // Start searches
    if (settings.searchCopart) {
        searchPromises.push(COPART_S.search(vin, notify))
    }
    if (settings.searchIaai) {
        searchPromises.push(IAAI_S.search(vin, notify))
    }
    if (settings.searchRow52) {
        searchPromises.push(ROW52_S.search(vin, notify))
    }
    
    // Return search results, with a guaranteed rejection in case none were
    // enabled in settings.
    return Promise.any([
        ...searchPromises,
        Promise.reject()
    ])
}
const searchArchives = async (vin, notify)=>{
    /*
    Performs archive searches.
    
    Requries a VIN and a notify callback.
    
    Returns a Promise.all(), which resolves as an object: {
        salvage: str,
        listingUrl: str,
        extras: [str]
    }
    */
    
    // Set up
    const settings = await defaultedSettings();
    const archivePromises = [];
    
    // Start searches
    if (settings.searchPoctra) {
        archivePromises.push(POCTRA_S.search(vin, notify))
    }
    if (settings.searchBidfax) {
        archivePromises.push(BIDFAX_S.search(vin, notify))
    }
    
    // Return search results, with a guaranteed rejection in case none were
    // enabled in settings.
    return Promise.any([
        ...archivePromises,
        Promise.reject()
    ]);
}
const openTabAndSendMessage = (searchResults)=>{
    // Open new tab to the listing page
    browser.tabs.create({url: message.listingUrl})
    
    // Send success message, updating button states
    port.postMessage({
        complete: true,
        found: true,
        ...searchResults
    })
};


/*---------------*\
  MESSAGE HANDLER
\*---------------*/
const search = async (message)=>{
    /*
    Performs salvage yard and archive searches.
    
    Message must have a property "vin".
    
    Returns an object: {
        salvage: str,
        listingUrl: str,
        extras: [str]
    }
    */
    
    // Create a notifier tunnel
    const notify = notifyUntilSuccess(port);
    
    // Search primaries
    try {
        const searchResults = await searchPrimaries(message.vin, notify);
        openTabAndSendMessage(searchResults)
        return;
    } catch (AggrigateError) {
        console.log("primary searches empty, trying archives")
    }
    
    // Search archives
    try {
        const searchResults = await searchArchives(message.vin, notify);
        openTabAndSendMessage(searchResults)
        return;
    } catch (AggrigateError) {
        
        // Primaries and archives both failed.
        console.log("archive searches empty")
        port.postMessage({
            feedback: {
                action: "feedback-message",
                message: "Search complete. No results found.",
                displayAs: "error"
            },
            complete: true
        })
        return;
    }
};



/*----*\
  PORT
\*----*/
let port;
browser.runtime.onConnect.addListener( async connectingPort=>{
    if (connectingPort.name!=="search") return;
    port = connectingPort;
    port.onMessage.addListener(search)
})

console.log("search loaded!")
