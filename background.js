/*---------------------------------------------------------------------------*\
MESSAGES

All messages have a similar syntax, whether being sent from background scripts
to content scripts or vice versa:
    {
        type: String,
        values: Array
    }

Type is like an event name, it flags the message as being intended for a certain
recipient.

-- "popup-action": Sent by the toolbar popup when the user has interacted with
it. Values will be Objects that contain an "action" String, and possibly other
values.

-- "copart", "iaai": Sent by background scripts as well as content scripts.
Values are ususally Strings, containing URLs, blobs, or the stand-in
"storage-local", when blobs are so long that they've been tucked away in storage
for retrieval.

-- "feedback": Sent by background scripts when something has gone wrong and the
user should be notified. Values are Objects with messages or element identifiers
to pass along.

\*---------------------------------------------------------------------------*/



/*---------------*\
  EVENT LISTENERS
\*---------------*/

// intercept image URL requests from Copart
browser.webRequest.onBeforeRequest.addListener(
    copartHdImgRequestListener,
    {urls: ["https://www.copart.com/public/data/lotdetails/solr/lotImages/*/USA"]},
    ["requestBody"] // for Firefox, we had ["blocking"] and used a filter.
);
// button actions
// browser.browserAction.onClicked.addListener(openSalvagePages);

browser.runtime.onMessage.addListener( (message)=>{
    console.log(message)
    if (message.type === "popup-action") {
        for (value of message.values) {
            if (value.action === "download") {
                console.log("that's an image download request!")
                downloadImages()
            } else if (value.action === "search"){
                console.log("that's a search request!")
                openSalvagePages(value.vin)
            };
        };
    };
})

console.log("background loaded!")
