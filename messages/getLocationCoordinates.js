const request = require('superagent');


module.exports = function (address, session, callback) {
    session.sendTyping();
    //https://stackoverflow.com/questions/30389764/wait-for-request-to-finish-node-js
    //https://stackoverflow.com/questions/45291233/node-js-post-request-not-working-if-called-inside-get-request-callback
    //stackover that solved the issue of request call back not being called
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`;
    let options = {
        url : url,
        method : 'GET'
    };
    let latitude;
    let longitude;
    console.log("in getlocationcoordinates");
    request.get(url).end((err, res) => {
        let body = res.body;
        console.log(body.results.length);
        if (body.results.length == 1) {
            console.log('in body results');
            console.log(body.results[0]);
            latitude = body.results[0].geometry.location.lat;
            longitude = body.results[0].geometry.location.lng;

            callback(latitude, longitude, session, require('./sendAdaptiveCard.js'));
        } else {
            session.endDialog('Sorry I could not determine your location');
        }
    });
};
