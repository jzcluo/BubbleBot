"use strict";
const builder = require("botbuilder");
const botbuilder_azure = require("botbuilder-azure");
const path = require('path');
const request = require('superagent');
const req = require('request');
require('dotenv').config();


var connector =  new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var useEmulator = true;

if (useEmulator) {
    const restify = require('restify');
    const server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}



const bot = new builder.UniversalBot(connector, [
    (session, args) => {
        session.send('Hello I am Bubble Bot');
    }
]);
//whether to persist conversationdata
//bot.set(`persistConversationData`, false);


bot.dialog('qnadialog', require('./qnadialog.js')).triggerAction({
    matches : 'QnAIntent'
});

const recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
/*
recognizer.onEnabled((context, callback) => {
    if (context.dialogStack().length > 0) {
        callback(null, false);
    } else {
        callback(null, true);
    }
});
*/
bot.recognizer(recognizer);
bot.localePath(path.join(__dirname, './locale'));

bot.dialog('hi', [
    (session, args, next) => {
        session.send('Hi there, I am Bubble Bot, I can tell you things about bubble tea or the bubble tea shops around you');
        let message = new builder.Message(session).addAttachment({
            contentType : "application/vnd.microsoft.card.adaptive",
            content : {
                type : "AdaptiveCard",
                body : [
                    {
                        "type" : "TextBlock",
                        "text" : "Hi Bubble Lover",
                        "size" : "large"
                    },
                    {
                        "type" : "TextBlock",
                        "text" : "You can choose one of the below options or ask me anything to get started!",
                        "size" : "medium",
                        "wrap" : true
                    }
                ]
            }
        })
        session.send(message);
    }
]).triggerAction({
    matches : 'hi'
});


bot.dialog('searchBubbleTea', [
    (session, args, next) => {
        console.log("Starting conversationdata");
        console.log(session.conversationData);
        if (!session.conversationData.address) {
            builder.Prompts.text(session, 'What is the street address?');
        } else {
            getLocationCoordinates(session.conversationData.address, session, retrieveRestaurantInfo);
        }
    },
    (session, results, next) => {
        console.log("entering second waterfall");
        console.log(results.response);
        if (results.response) {
            session.conversationData.address = results.response.split(" ").join("+");
            builder.Prompts.text(session, 'What city are you in?');
        } else {
            session.endDialog('Ok Bye');
        }
    },
    (session, results, next) => {
        console.log(session.conversationData);
        if (results.response) {
            console.log(results.response);
            session.conversationData.address += '+' + results.response.split(" ").join("+");
            builder.Prompts.text(session, 'What state are you in?');
        } else {
            session.endDialog('OK Bye');
        }

    },
    (session, results, next) => {
        if (results.response) {
            session.conversationData.address += '+' + results.response.split(" ").join("+");
            let getLocationCoordinates = require('./getLocationCoordinates.js');
            getLocationCoordinates(session.conversationData.address, session, require('./retrieveRestaurantInfo.js'));
        } else {
            session.endDialog('OK Bye');
        }
    }

]).triggerAction({
    matches : 'search'
});

/*
const sendRestaurantAdaptiveCard = (restaurantInfo, session) => {
    session.sendTyping();
    console.log(restaurantInfo.url);
    let restaurantCard = {
        contentType : "application/vnd.microsoft.card.adaptive",
        content : {
            type : "AdaptiveCard",
            body : [
                {
                    "type" : "ColumnSet",
                    "columns" : [
                        {
                            "type" : "Column",
                            "items" : [
                                {
                                    "type" : "TextBlock",
                                    "text" : restaurantInfo.name,
                                    "size" : "extraLarge"
                                },
                                {
                                    "type" : "TextBlock",
                                    "text" : restaurantInfo.price + " · rating:" + restaurantInfo.rating
                                },
                                {
                                    "type" : "TextBlock",
                                    "text" : "Location: " + restaurantInfo.location.address1
                                }
                            ]
                        }
                        ,
                        {
                            "type" : "Column",
                            "items" : [
                                {
                                    "type" : "Image",
                                    "url" : restaurantInfo.image_url
                                }
                            ]

                        }
                    ]
                }
            ],
            actions : [
                {
                    "type" : "Action.OpenUrl",
                    "title" : "More Info",
                    "url" : restaurantInfo.url
                }
            ]
        }
    }

    console.log(restaurantCard);
    let message = new builder.Message(session).addAttachment(restaurantCard);
    session.send('Here is a good bubble tea shop around you');
    session.endDialog(message);

};
*/
/*
const getLocationCoordinates = function (address, session, callback) {
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
}
*/
/*
const retrieveRestaurantInfo = function (latitude, longitude, session, callback) {
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
}
*/
