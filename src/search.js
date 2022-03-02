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
    const notify = notifyUntilSuccess();
    
    // Search primaries
    try {
        // PICKUP: sort out messaging, make sure the popup does what we want.
        return await searchPrimaries(message.vin, notify);
    } catch (AggrigateError) {
        console.log("primary searches empty, trying archives")
    }
    
    // Search archives
    try {
        return await searchArchives(message.vin, notify);
    } catch (AggrigateError) {
        console.log("archive searches empty")
        return {
            feedback: {
                action: "feedback-message",
                message: "Search complete. No results found.",
                displayAs: "error"
            },
            complete: true
        }
    }
};



/*----*\
  PORT
\*----*/
browser.runtime.onConnect.addListener( async port=>{
    if (port.name!=="search") return;
    port.onMessage.addListener(search)
})

console.log("search loaded!")
