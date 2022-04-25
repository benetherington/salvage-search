/*------*\
  SEARCH  
\*------*/
const ROW52_API = {
    NAME: "row52",
    // Image downloads are not supported. URL_PATTERN can be not included, but
    // URL_REGEXP needs to be defined but never match.
    URL_REGEXP: /<(?!x)x/,
    
    search: (vin, notify = sendNotification) => {
        return new Promise(async (resolve, reject) => {
            try {
                const searchResults = await ROW52_API.searcher(vin);
                notify("Row52: Found a match!", "success");
                resolve(searchResults);
            } catch (error) {
                console.log(`R52 rejecting: ${error}`);
                notify(`Row52: ${error}.`);
                reject();
            }
        });
    },
    searcher: async (vin) => {
        // Configure VIN search
        const searchAddress = new URL("https://row52.com/Search/");
        const params = new URLSearchParams();
        params.set("YMMorVin", "VIN");
        params.set("Year", "");
        params.set("ModelId", "");
        params.set("MakeId", "");
        params.set("ZipCode", "");
        params.set("LocationId", "");
        params.set("Distance", 50);
        params.set("Page", 1);
        params.set("IsVin", true);
        params.set("V1", vin[0]);
        params.set("V2", vin[1]);
        params.set("V3", vin[2]);
        params.set("V4", vin[3]);
        params.set("V5", vin[4]);
        params.set("V6", vin[5]);
        params.set("V7", vin[6]);
        params.set("V8", vin[7]);
        params.set("V9", vin[8]);
        params.set("V10", vin[9]);
        params.set("V11", vin[10]);
        params.set("V12", vin[11]);
        params.set("V13", vin[12]);
        params.set("V14", vin[13]);
        params.set("V15", vin[14]);
        params.set("V16", vin[15]);
        params.set("V17", vin[16]);
        searchAddress.search = params;

        // Fetch search results
        const response = await fetch(searchAddress);

        // Check status
        if (!response.ok) throw "something went wrong on their end...";

        // Parse response content
        const parser = new DOMParser();
        let doc;
        try {
            doc = parser.parseFromString(await response.text(), "text/html");
        } catch (error) {
            console.error("R52 encountered a parsing error:");
            console.error(error);
            throw "something looks wrong with this page, try searching by hand.";
        }

        // Check result count
        const resultCountElement = doc.querySelector("#results-header span");
        const resultsCountStr = /\d+/.exec(resultCountElement.innerText)[0];
        const resultsCount = Number(resultsCountStr);
        if (!resultsCount) throw "query returned no results";
        if (resultsCount > 3) throw "query returned no results";

        // Check results content
        const listingLinkElements = doc.querySelectorAll("a.block-link");
        if (listingLinkElements.length > 3) throw "query returned no results";

        // Get listing URLs
        const listingPaths = [];
        listingLinkElements.forEach((el) =>
            listingPaths.push(el.attributes.href.value),
        );
        if (!listingPaths.length) throw "query returned no results.";
        const listingUrls = listingPaths.map((p) => "https://row52.com" + p);

        // Split results
        const listingUrl = listingUrls.pop();
        const extras = listingUrls;

        // Send back results
        return {salvageName: "row52", listingUrl, extras};

        // Possible additional values
        // let yardNameElement = doc.querySelector("span[itemprop] strong");
        // let yardName = yardNameElement.innerText.trim()
    },
};

SALVAGE_APIS.row52 = ROW52_API;
