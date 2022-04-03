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
        
        // Check listing URLs
        if (!listingUrls.some(el=>el)) {
            console.log("POCTRA found results, but not listing URLs.");
            throw "search returned a result, but it's invalid.";
        }
        
        // Extract lot numbers
        const lotNumbers = [];
        searchResults.forEach( el=>lotNumbers.push(/\d{8}/.exec(el.innerHTML)[0]) );
        
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
    lotNumberFromTab: async (poctraTab)=>{
        try {
            const code = `(${POCTRA_D.getLotNumber.toString()})()`
            const framesResults = await browser.tabs.executeScript(poctraTab.id, {code});
            const frameResults = framesResults[0]
            return frameResults
        } catch (error) {throw `Poctra: ${error}`}
    },
    getLotNumber: ()=>{
        // Primary method, look at the grid of information
        let infoGrid = "";
        try {
            infoGrid = document.getElementById("aside").innerText;
        } catch {}
        
        // Find lotNumber from info grid
        let lotNumber = "";
        try {
            // first try, very specific
            lotNumber = /(stock|lot) (no|number)\W+(?<lotNumber>\d*)/i.exec(infoGrid)[3];
        } catch {
            // backup, less specific
            try {lotNumber = /\d{8}/i.exec(infoGrid)[0];} catch {}
        };
        
        // Find salvageName from info grid
        let salvageName = "";
        try {
            // first try, very specific
            salvageName = /auction\W+(\w*)/i.exec(infoGrid)[1];
        } catch {
            // backup, less specific
            try {salvageName = /(iaai|copart)/i.exec(infoGrid)[0];} catch {}
        }
        
        // Backup method, look at the page headline
        if (!lotNumber) {
            try {
                const headline = document.querySelector("h2").innerText;
                lotNumber = /\d{8}/i.exec(headline)[0];
            } catch {}
        }
        // Find salvageName from headline
        if (!salvageName) {
            try {
                const headline = document.querySelector("h2").innerText;
                salvageName = /(iaai|copart)/i.exec(headline)[0];
            } catch {}
        }
        
        // Clean up results
        lotNumber = lotNumber.trim();
        salvageName = salvageName.trim().toLowerCase();
        
        return {lotNumber, salvageName};
    }
}
