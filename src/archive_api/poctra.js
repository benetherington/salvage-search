/*------*\
  SEARCH  
\*------*/
const POCTRA_S = {
    __proto__: Archive,
    NAME: "poctra",
    INFO_REGEX: /^(?<salvage>.*?) (Stock|Lot) No: (?<lotNumber>\d*)<br>.*<br>Location: (?<location>.*)$/,
    search: (vinOrVehicle, notify=sendNotification)=>{
        let vin = vinOrVehicle.vin || vinOrVehicle;
        // TODO: handle this too
        let vehicle = vinOrVehicle;
        return new Promise(async (resolve, reject)=>{
            try {
                // SEARCH
                let searchUrl = `https://poctra.com/search/ajax`;
                let body = `q=${vin}&by=&asc=&page=1`;
                let headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"};
                let response = await fetch( searchUrl, {method: "POST", headers, body} );
                if (!response.ok) { throw "something went wrong on their end..." }
                // CHECK FOR RESULTS
                let parser = new DOMParser();
                let doc = parser.parseFromString(await response.text(), "text/html");
                // set base URI so that relative links work
                let base = doc.createElement("base");
                base.href = searchUrl;
                doc.head.append(base)
                let searchResults = doc.querySelectorAll(".clickable-row");
                if (searchResults.length===0 || searchResults.length>3) {throw "search returned no results."}

                // TODO: handle multiple listings
                let searchResult = searchResults[0]
                // FIND PAGE LINK
                let lotLink = searchResult.querySelector("a");
                if (!lotLink) {console.log("POCTRA found results, but no lotLink");throw "search returned no results.";}
                vehicle.listingUrl = lotLink.href;
                // NOTIFY
                try {
                    let infoElement = searchResult.querySelector("p");
                    let infoParsed = POCTRA_S.INFO_REGEX.exec(infoElement.innerHTML.trim()).groups;
                    vehicle.lotNumber = infoParsed.lotNumber;
                    vehicle.location = infoParsed.location;
                    if (infoParsed.salvage.toLowerCase()==="iaai"  ) {vehicle.salvage=IAAI_S}
                    if (infoParsed.salvage.toLowerCase()==="copart") {vehicle.salvage=COPART_S}
                    notify( `Poctra: found a match at ${vehicle.salvage.PRETTY_NAME}! `+
                            `Lot ${vehicle.lotNumber}.`, {displayAs: "success"} )
                } catch {
                    notify( "Poctra: found a match!", {displayAs: "success"})
                }
                // SUCCESS!
                resolve(()=>{vehicle})
            } catch (error) {
                console.log(`Poctra rejecting: ${error}`)
                notify(`Poctra: ${error}`, {displayAs: "error"})
                reject()
            }
        })
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
