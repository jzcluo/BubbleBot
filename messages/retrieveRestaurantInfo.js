const request = require('superagent');


module.exports = function (latitude, longitude, session, callback) {
    session.sendTyping();
    let url = `https://api.yelp.com/v3/businesses/search?term=bubble+tea&latitude=${latitude}&longitude=${longitude}&open_now=true`;
    let options = {
        url : url,
        method : 'GET',
        headers : {
            'Authorization' : process.env.YELP_API_ACCESS_TOKEN
        }
    };
    console.log(options);
    request.get(url).set('Authorization', process.env.YELP_API_ACCESS_TOKEN).end((err, res) => {
        if (err) {
            console.log(error);
        } else {
            let body = res.body;
            if (body.businesses.length > 0) {
                let resultsArray = new Array();
                let length = body.businesses.length > 3 ? 3 : body.businesses.length;
                for (let i = 0; i < length; i++) {
                    resultsArray[i] = body.businesses[i];
                }
                callback(resultsArray[0], session);
            } else {
                session.endDialog('Sorry I could not find a open shop around you');
            }
        }
    });
};
