/*------------------*\
  SETTINGS ACCESSORS
\*------------------*/
const searchPrimaries = async (vin, notify, settings=null)=>{
    /*
    Performs salvage yard searches.
    
    Requries a VIN and a notify callback. Takes an optional settings override.
    
    Returns a Promise.all(), which resolves as an object: {
        salvage: str,
        listingUrl: str,
        extras: [str]
    }
    */
   
    // Set up
    if (!settings) {
        settings = await defaultedSettings();
    }
    const searchPromises = [];
    
    // Start searches
    if (settings.searchCopart) {
        searchPromises.push(COPART_API.search(vin, notify))
    }
    if (settings.searchIaai) {
        searchPromises.push(IAAI_API.search(vin, notify))
    }
    if (settings.searchRow52) {
        searchPromises.push(ROW52_API.search(vin, notify))
    }
    
    // Return search results, with a guaranteed rejection in case none were
    // enabled in settings.
    return Promise.any([
        ...searchPromises,
        Promise.reject()
    ])
}
const searchArchives = async (query, notify)=>{
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
        archivePromises.push(POCTRA_API.search(query, notify))
    }
    if (settings.searchBidfax) {
        archivePromises.push(BIDFAX_API.search(query, notify))
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
    browser.tabs.create({url: searchResults.listingUrl})
    
    // Send success message, updating button states
    sPort.postMessage({
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
    const notify = notifyUntilSuccess(sPort);
    
    // Search primaries
    try {
        let searchResults;
        
        // Do specific search if forced
        if (message.salvageName==="iaai") {
            console.log("Starting forced search at IAAI")
            searchResults = await searchPrimaries(message.query, notify, {searchIaai: true});
        } else if (message.salvageName==="copart") {
            console.log("Starting forced search at Copart")
            searchResults = await searchPrimaries(message.query, notify, {searchCopart: true});
        }
        
        // Do general primaries search
        else {searchResults = await searchPrimaries(message.query, notify);}
        openTabAndSendMessage(searchResults)
        
        // if no error was thrown, our search was successful.
        return;
    } catch (AggrigateError) {
        if (message.salvageName) {
            console.log("Forced search came up empty")
            return;
        } else {
            console.log("primary searches empty, trying archives")
        }
    }
    
    // Search archives
    try {
        const searchResults = await searchArchives(message.query, notify);
        openTabAndSendMessage(searchResults)
        return;
    } catch (AggrigateError) {
        // Primaries and archives both failed.
        console.log("archive searches empty")
        sPort.postMessage({
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
let sPort;
browser.runtime.onConnect.addListener( async connectingPort=>{
    if (connectingPort.name!=="search") return;
    sPort = connectingPort;
    sPort.onMessage.addListener(search)
})

console.log("search loaded!")
