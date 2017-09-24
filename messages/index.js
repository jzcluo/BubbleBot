"use strict";
const builder = require("botbuilder");
const botbuilder_azure = require("botbuilder-azure");
const path = require('path');
const request = require('request');
const location = require('botbuilder-location');
require('dotenv').config();



var useEmulator = true;//(process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MICROSOFT_APP_ID'],
    appPassword: process.env['MICROSOFT_APP_PASSWORD'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});




const bot = new builder.UniversalBot(connector, [
    (session, args) => {
        session.send('Hello I am Bubble Bot');
    }
]);
bot.library(location.createLibrary(process.env.BING_MAPS_API_KEY));

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
                        "size" : "medium"
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
        if (!session.conversationData.address) {
            builder.Prompts.text(session, 'What is the street address?');
        } else {
            next();
        }
    },
    (session, results, next) => {
        console.log("entering second waterfall");
        console.log(results.response);
        if (results.response) {
            session.conversationData.address = results.response.split(" ").join("+");
            builder.Prompts.text(session, 'What city are you in?');
        } else {
            next();
        }
        //session.endConversation(`SO your loaction is ${results.response}`);
    },
    (session, results, next) => {
        console.log(session.conversationData);
        if (results.response) {
            console.log(results.response);
            session.conversationData.address += '+' + results.response.split(" ").join("+");
            let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${session.conversationData.address}&key=${process.env.GOOGLE_GEOCODING_API_KEY}`;
            let options = {
                url : url,
                method : 'GET'
            };
            request(options, (err, res, body) => {
                //console.log(res);
                //console.log(body);
                if (err) {
                    console.log(err);
                } else {
                    let body = JSON.parse(body);
                    if (body.results) {
                        console.log('in body results');
                        let latitude = body.results[0].geometry.location.lat;
                        let longitude = body.results[0].geometry.location.lng;
                        let restaurantInfo = retrieveRestaurantInfo(latitude, longitude);
                        console.log(latitude + " " + longitude);
                        let restaurantCard = createRestaurantAdaptiveCard(restaurantInfo);
                        console.log(restaurantInfo);

                        let message = new builder.Message(session).addAttachment(restaurantCard);
                        session.send('Here is a good bubble tea shop around you');
                        session.endDialog(message);
                    } else {
                        next();
                    }

                }
            });
        }

    }
]).triggerAction({
    matches : 'search'
});


const createRestaurantAdaptiveCard = function(restaurantInfo) {
    let restaurantCard = {
        contentType : "application/vnd.microsoft.card.adaptive",
        content : {
            type : "AdaptiveCard",
            body : [
                {
                    "type" : "TextBlock",
                    "text" : restaurantInfo
                }
            ]
        }
    }

};

const retrieveRestaurantInfo = function(latitude, longitude) {
    console.log('in retrieverestaurantinfi');
    //const url = `https://maps.googleapis.com/maps/api/geocode/json?address=&key=${process.env.GOOGLE_GEOCODING_API_KEY}``
    const url = `https://api.yelp.com/v3/businesses/search?term=bubble+tea&latitude=${latitude}&longitude=${longitude}&open_now=true`;
    const options = {
        url : url,
        method : 'GET',
        headers : {
            'Authorization' : process.env.YELP_API_ACCESS_TOKEN
        }
    }
    request(options, (err, res, body) => {
        if (err) {

        } else {
            body = JSON.parse(body);
        }
    })

}



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
