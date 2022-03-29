/*------*\
  SEARCH  
\*------*/
const POCTRA_S = {
    __proto__: Archive,
    NAME: "poctra",
    INFO_REGEX: /^(?<salvage>.*?) (Stock|Lot) No: (?<lotNumber>\d*)<br>.*<br>Location: (?<location>.*)$/,
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await POCTRA_S.searcher(vin);
                notify(
                    `Poctra: found a match!`,
                    {displayAs: "success"}
                )
                resolve(searchResults)
            } catch (error) {
                console.log(`Poctra rejecting: ${error}`)
                notify(`Poctra: ${error}.`, {displayAs: "status"})
                reject()
            }
        })
    },
    searcher: async (vin)=>{
        // Configure VIN search
        const searchUrl = new URL("https://poctra.com/search/ajax");
        const method = "POST";
        const headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
        
        // Build request body. For some reason, these aren't passed as params.
        const params = new URLSearchParams();
        params.set("q", vin)
        params.set("by", "")
        params.set("asc", "")
        params.set("page", 1)
        const body = params.toString();
        
        // Fetch search results
        const response = await fetch(searchUrl, {method, headers, body});
        
        // Check response
        if (!response.ok) {throw "something went wrong on their end..."}
        
        // Parse response content
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), "text/html");
        // set base URI so that relative links work
        const base = doc.createElement("base");
        base.href = searchUrl;
        doc.head.append(base)
        
        // Check result count
        const searchResults = doc.querySelectorAll(".clickable-row");
        if (searchResults.length===0 || searchResults.length>3) {throw "search returned no results."}
        
        // Get listing URLs
        const listingUrls = [];
        searchResults.forEach(el=>listingUrls.push(el.querySelector("a").href));
        const lotNumbers = searchResults.map(el=>/\d{8}/.exec(el.innerHTML));
        
        // Check listing URLs
        if (!listingUrls.some(el=>el)) {
            console.log("POCTRA found results, but not listing URLs.");
            throw "search returned a result, but it's invalid.";
        }
        
        // Split results
        const listingUrl = listingUrls.pop();
        const lotNumber = lotNumbers.pop();
        const extras = {listingUrls, lotNumbers};
        
        // Send back results
        return {salvage: "poctra", listingUrl, lotNumber, extras};
    }
};


/*--------*\
  DOWNLOAD
\*--------*/
const POCTRA_D = {
    URL_PATTERN: "*://*.poctra.com/*/id-*/*",
    lotNumbersFromTab: async (poctraTab)=>{
        try {
            let code = `(${POCTRA_D.getLotNumber.toString()})()`
            let framesResults = await browser.tabs.executeScript(poctraTab.id,{code});
            let frameResults = framesResults[0]
            let vehicle = {lotNumber: frameResults.lotNumber};
            if (frameResults.copart) {vehicle.salvage = "copart"};
            if (frameResults.iaai  ) {vehicle.salvage = "iaai"  };
            return vehicle
        } catch (error) {throw `Poctra: ${error}`}
    },
    getLotNumber: ()=>{
        let idElement = document.querySelector("h2");
        if (!idElement) {return null}
        let idString = idElement.innerText;
        let idMatches = /((?<copart>Lot)|(?<iaai>Stock)) no: (?<lotNumber>\d*)/.exec(idString);
        if (!idMatches) {return null}
        return idMatches.groups;
    }
}
