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
it. Values are Objects with an action key and optional additional key/options as
determined by the action:
    -- "search": required vin key. Begins a search for this vin, and opens any
        matching sale listing pages.
    -- "download": optional lotNumber key. Begins a download from the listing
        of the provided lotNumber, or else looks for an active salvage website
        tab if none is provided.

-- "feedback": Sent by background scripts when something has gone wrong and the
    user should be notified. Values are Objects with an action key and optional
    additional key/options as determined by the action:
    -- "feedback-message": Requres message key, which should be paired with a string
        to display to the user in a pop-up. Duration defaults to 5000ms,
        closeable defaults to true, displayAs defaults to "status." Two other
        options for displayAs are "success" and "error." This decides the color
        of the popup.
    -- "download-start": Starts the progress bar animation on the download
        button. Optional total key, which should be a number indicating how
        many units 100% progress is. This message can be re-sent if the total
        is not known at the moment, but with no total, subsquent increments
        will have no effect.
    -- "download-increment": Increments the progress bar one unit.
    -- "download-end": Stops the progress bar animation and switches the
        button to enabled/standby display.
    -- "download-abort": Stops the progress bar animation and disables the
        button.
    -- "search-start": Starts the progress bar animation on the search button.
        Optional total key, which should be a number indicating how many units
        100% progress is. This message can be re-sent if the total is not known
        at the moment, but with no total, subsquent increments will have no
        effect.
    -- "search-increment": Increments the progress bar one unit.
    -- "search-end": Stops the progress bar animation and switches the
        button to enabled/standby display.

\*---------------------------------------------------------------------------*/

browser.runtime.onMessage.addListener( (message)=>{
    if (message.type === "popup-action") {
        for (value of message.values) {
            if (value.action === "download") {
                downloadImages(value)
            } else if (value.action === "search"){
                searchSalvageSites(value.vin)
            };
        };
    };
})

console.log("background loaded!")
