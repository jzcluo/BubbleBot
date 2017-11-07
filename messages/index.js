"use strict";
const builder = require("botbuilder");
const botbuilder_azure = require("botbuilder-azure");
const request = require('superagent');
require('dotenv').config();
const nodemailer = require('nodemailer');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}



const bot = new builder.UniversalBot(connector, [
    (session, args) => {
        session.send('Hi there, I am Bubble Bot, I can tell you things about bubble tea or the bubble tea shops around you');
        session.beginDialog('hi');
    }
]);
//whether to persist conversationdata
//bot.set(`persistConversationData`, false);

let conversationLog = '';

//set up middleware to intercept messages
bot.use({
    receive : (event, next) => {
        //console.log(event);
        conversationLog += 'User : ' + event.text + '<br/>';
        next();
    },
    send : (event, next) => {
        //console.log(event);
        if (event.text) {
            conversationLog += 'Bot : ' + event.text + '<br/>';
        } else {
            //if it is undefined. card message will be added in the card dialog
            //conversationLog += 'Bot : <i>sends card</i><br/>';
        }
        next();
    }
});


bot.dialog('qnadialog',[
    (session, args, next) => {
        console.log('qnamaker called');
        session.sendTyping();
        const questionAsked = session.message.text;
        const bodyText = JSON.stringify({question : questionAsked, top : 7});
        const host = `https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/`;
        const url = `${host}knowledgebases/${process.env.KnowledgeBaseID}/generateAnswer`;
        console.log(url);

        request.post(url)
                .send(bodyText)
                .set("Content-Type", "application/json")
                .set("Ocp-Apim-Subscription-Key", process.env.QnASubscriptionKey)
                .end((err, res) => {
                    if (err) {
                        console.log(err);
                        session.endDialog('Sorry something went wrong');
                    } else {
                        const answers = res.body['answers'];
                        //console.log(response);
                        if (answers[0].score > 60) {
                            session.endDialog(answers[0].answer);
                        } /*else if (answers.score > 30) {
                            session.send('I am not sure if this is right');
                            session.endDialog(answers.answer);
                        }*/ else {
                            searchWebResults(questionAsked, session);
                            //session.endDialog('sorry I do not have the answer you need');
                        }
                    }
                });
    },
    (session, results) => {
        if (results.response) {
            if (results.response.entity == 'YES') {
                updateKnowledgeBase(session.dialogData.question, session.dialogData.answer);
            } else if (results.response.entity == 'NO') {
                //send a email report
                session.send('Sorry about that, I will get back to you when I have the answer ready');
                sendIssueLog(session);
            }
        }
    }
]).triggerAction({
    matches : 'QnAIntent'
});

const recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.dialog('hi', [
    (session, args, next) => {
        let thumbnailCard = new builder.ThumbnailCard(session)
                            .title('Hi Bubble Lover')
                            .subtitle('Pick any of the below options or ask a question to get started. Sample question : does bubble tea have caffeine, where can I get bubble tea')
                            .buttons([
                                builder.CardAction.postBack(session,'Buy', 'Get bubble tea shop'),
                                builder.CardAction.postBack(session, 'Ask', 'Learn about bubble tea'),
                                builder.CardAction.postBack(session, 'Cook', 'Learn how to make it'),
                                builder.CardAction.postBack(session, 'Clear', 'Clear my user data')
                            ]);


        let message = new builder.Message(session).addAttachment(thumbnailCard);

        let choices = ['Buy', 'Ask', 'Cook', 'Clear'];
        builder.Prompts.choice(session, message, choices);

    },
    (session, results, next) => {
        if (results.response) {
            switch (results.response.entity) {
                case 'Buy' :
                    session.beginDialog('searchBubbleTea');
                    break;
                case 'Ask' :
                    let sampleQuestions = [
                        'How many calories are there in bubble tea?',
                        'Does bubble tea have caffeine?',
                        'Who invented bubble tea?',
                        'What is it made of?'
                    ];
                    let thumbnailCard = new builder.ThumbnailCard(session)
                                            .title('Sample Questions')
                                            .subtitle('Pick any of the following or ask your own')
                                            .buttons(sampleQuestions.map(question => builder.CardAction.imBack(session, question, question)));

                    let message = new builder.Message(session).addAttachment(thumbnailCard);

                    session.endDialog(message);
                    //session.endDialog('Please type any question you have about bubble tea');
                    break;
                case 'Cook' :
                    session.endDialog('coming soon...');
                    break;
                case 'Clear' :
                    //set empty and call save
                    //https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-state
                    session.userData = {};
                    //session.conversationData = {};
                    //session.dialogData = {};
                    session.save();
                    session.endDialog('Your data in this bot has been cleared');
                    session.beginDialog('hi');
            }
        }
    }
]).triggerAction({
    matches : 'hi'
});


bot.dialog('getFeedback', [
    //instead of asking the user step by step if it was helpful. Use sentiment analysis
    (session, args, next) => {
        let url = "https://eastus.api.cognitive.microsoft.com/text/analytics/v2.0/sentiment";
        let bodyJSON = {
            "documents" : [
                {
                    "language" : "en",
                    "id" : session.message.user.name + session.message.text + session.message.user.id,
                    "text" : session.message.text
                }
            ]
        };

        request
            .post(url)
            .set('Ocp-Apim-Subscription-Key', process.env.SENTIMENT_ANALYSIS_KEY)
            .send(bodyJSON)
            .end((err, res) => {
                if (err) {
                    console.log(err);
                    session.endDialog('Sorry something went wrong');
                } else {
                    console.log(res.body);
                    let score = res.body.documents[0].score;
                    if (score >= 0.5) {
                        session.endConversation("Glad I helped! Goodbye~");
                    } else {
                        sendIssueLog(session);
                        session.endConversation("Sorry about that, I will get better next time.");
                    }
                }
            });
    }
    /*
    (session, args, next) => {
        builder.Prompts.choice(session, "Did that help you?", ["YES", "NO"], {listStyle : builder.ListStyle.button});
    },
    (session, results, next) => {
        if (results.response) {
            if (results.response.entity == 'YES') {
                builder.Prompts.choice(session, "Is there anything else I could help you with today", ["YES", "NO"], {listStyle : builder.ListStyle.button});
            } else if (results.response.entity == 'NO') {
                sendIssueLog(session);
                session.endConversation("Sorry about that, I will get better next time.");
            }
        }
    },
    (session, results) => {
        if (results.response) {
            if (results.response.entity == 'YES') {
                session.beginDialog('hi');
            } else if (results.response.entity == 'NO') {
                session.beginDialog('bye');
            }
        }
    }
    */
]).triggerAction({
    matches : 'bye'
});


bot.dialog('searchBubbleTea', [
    (session, args, next) => {
        console.log("args");
        console.log(args);
        if (args && args.intent.entities[0]) {
            getLocationCoordinates(args.intent.entities[0].entity, session, retrieveRestaurantInfo);
        } else if (session.userData.address) {
            session.beginDialog('searchWithUserInfo');
        } else {
            next();
        }
    },
    (session, results, next) => {
        console.log(results);
        if (!results.response) {
            builder.Prompts.text(session, 'What is your address? (in the format{street, city, state} or a place name)');
        } else {
            session.endDialog();
        }
    },
    (session, results, next) => {
        if (results.response) {
            getLocationCoordinates(results.response.split(" ").join("+").replace(",", ""), session, retrieveRestaurantInfo);
        } else {
            session.endDialogWithResult('OK Bye');
        }
    }

]).triggerAction({
    matches : 'search'
});

bot.dialog('searchWithUserInfo', [
    (session, args, next) => {
        console.log(args);
        builder.Prompts.choice(session, `Your address is ${session.userData.address}. Use this address?`, ["YES", "NO"], {listStyle : builder.ListStyle.button});
    },
    (session, results, next) => {
        if (results.response) {
            if (results.response.entity == 'YES') {
                //this function will call enddialog
                getLocationCoordinates(session.userData.address, session, retrieveRestaurantInfo);
            } else if (results.response.entity == 'NO') {
                //If i use session.endDialog. the results of the next water fall will contain a response : true
                //this hack overrides that and make the response undefined. Therefore waterfall could continue normally
                session.endDialogWithResult({});
            }
        }
    }
]);


const sendRestaurantAdaptiveCard = (restaurantsInfo, session) => {
    session.sendTyping();
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
                                    "text" : restaurantsInfo[0].name,
                                    "size" : "extraLarge"
                                },
                                {
                                    "type" : "TextBlock",
                                    "text" : restaurantsInfo[0].price + " · rating:" + restaurantsInfo[0].rating
                                },
                                {
                                    "type" : "TextBlock",
                                    "text" : "Location: " + restaurantsInfo[0].location.address1
                                }
                            ]
                        }
                        ,
                        {
                            "type" : "Column",
                            "items" : [
                                {
                                    "type" : "Image",
                                    "url" : restaurantsInfo[0].image_url
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
                    "url" : restaurantsInfo[0].url
                }
            ]
        }
    }



    let recommendedRestaurant = new builder.Message(session).addAttachment(restaurantCard);

    //cut down arraysize to 10 if necessary
    let arrayLength = restaurantsInfo.length;
    restaurantsInfo = restaurantsInfo.slice(0, arrayLength > 8 ? 8 : arrayLength);

    let restaurantsCard = restaurantsInfo.map(restaurant => {
        return new builder.ThumbnailCard(session)
            .title(restaurant.name)
            .subtitle(restaurantsInfo[0].price + " · rating:" + restaurantsInfo[0].rating + "\n" + "Location: " + restaurantsInfo[0].location.address1)
            .images([
                builder.CardImage.create(session, restaurant.image_url)
            ])
            .buttons([
                builder.CardAction.openUrl(session, restaurant.url, "Learn More")
            ])
    });


    let carouselOfRestaurants = new builder.Message(session)
                                    .attachmentLayout(builder.AttachmentLayout.carousel)
                                    .attachments(restaurantsCard);


    session.send('Here is a good bubble tea shop around you');
    //add card info to conversation log
    conversationLog += `Bot : Card with message about tea shop "${restaurantsInfo[0].name}"<br/>`;
    session.send(recommendedRestaurant);
    session.send("Or you could browse the other ones here");
    //add card info to conversation log
    conversationLog += `Bot : Carousel with cards about other tea shops<br/>`;

    session.endDialog(carouselOfRestaurants);
};

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

    request.get(url).end((err, res) => {
        let body = res.body;
        if (body.results.length == 1) {
            //save this address to user data
            session.userData.address = body.results[0].formatted_address;

            latitude = body.results[0].geometry.location.lat;
            longitude = body.results[0].geometry.location.lng;

            callback(latitude, longitude, session, sendRestaurantAdaptiveCard);
        } else {
            session.endDialog('Sorry I could not determine your location');
        }
    });
};


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
                callback(resultsArray, session);
            } else {
                session.endDialog('Sorry I could not find a open shop around you');
            }
        }
    });
};

const searchWebResults = function (question, session) {
    session.sendTyping();
    let url = 'https://api.cognitive.microsoft.com/bing/v7.0/search?q=' + question.replace(/\s/g, '+');
    request
        .get(url)
        .query({q : question.replace(/\s/g, "+")})
        .set('Ocp-Apim-Subscription-Key', process.env.BING_SEARCH_API_KEY)
        .end((err, res) => {
            let webPages = res.body.webPages.value;
            console.log(webPages[0].snippet);

            let answerCard = {
                contentType : "application/vnd.microsoft.card.adaptive",
                content : {
                    type : "AdaptiveCard",
                    body : [
                        {
                            "type" : "TextBlock",
                            "text" : webPages[0].snippet,
                            "wrap" : true
                        }
                    ],
                    actions : [
                        {
                            "type" : "Action.OpenUrl",
                            "title" : "More Info",
                            "url" : webPages[0].url
                        }
                    ]
                }
            }
            let message = new builder.Message(session).addAttachment(answerCard);
            //updateKnowledgeBase(question, webPages[0].snippet.split("\.")[0]);
            session.dialogData.question = question;
            session.dialogData.answer = webPages[0].snippet.split("\.")[0];
            session.save();
            session.send(message);
            //add message to conversatino log
            conversationLog += `Bot : Card with answer : ${webPages[0].snippet}<br/>`;
            builder.Prompts.choice(session, "The above answer was pulled from the internet. Did that answer your question?", ["YES", "NO"], {listStyle : builder.ListStyle.button});
        });
};

const updateKnowledgeBase = function (question, answer) {
    let url = `https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/${process.env.KnowledgeBaseID}`;
    console.log("in update knowledge base");
    let bodyJSON = {
        "add" : {
            "qnaPairs" : [
                {
                    "answer" : answer,
                    "question" : question
                }
            ]
        }
    };
    request
        .patch(url)
        .set('Ocp-Apim-Subscription-Key', process.env.QnASubscriptionKey)
        .send(bodyJSON)
        .end((err, res) => {
            console.log('Update success');
            publishKnowledgeBase();
        })
};

const publishKnowledgeBase = function () {
    let url = `https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/${process.env.KnowledgeBaseID}`;

    request
        .put(url)
        .set('Ocp-Apim-Subscription-Key', process.env.QnASubscriptionKey)
        .end((err, res) => {
            console.log('Publish success');
        })
};

const sendIssueLog = function(session) {
    let transporter = nodemailer.createTransport({
        host : "smtp-mail.outlook.com",
        secureConnection : false,
        port : 587,
        tls: {
           ciphers:'SSLv3'
        },
        auth: {
            user: 'bubble.bot@outlook.com',
            pass: '1LoveBuBBleTea!'
        }
    });

    //send question and answer
    //<p>Question : ${session.dialogData.question}<br/>
    //BotAnswer : ${session.dialogData.answer}</p><br/>
    let mailOptions = {
        from: '"Your personal bubble expert" <bubble.bot@outlook.com>', // sender address (who sends)
        to: 'zluo@gatech.edu', // list of receivers (who receives) separated by commas
        subject: 'Issue Log with user', // Subject line
        html: `<body>
                    <h2>Full Conversation Transcript</h2><br/>
                    <p>${conversationLog.substring(24)}</p><br/>
                    <br/>
                    <span>
                        <form method="post">
                            Respond to the question : ${session.dialogData.question}<br/>
                            <input id="response" type="text" style="width: 500px"/><br/>
                            <input type="button" value="Reply" onsubmit="respondToUser();"/>
                        </form>
                        <script>
                            function respondToUser() {
                                let response = document.getElementById("response").value;
                                let xhr = new XMLHttpRequest();
                                xhr.onreadystatechange = function () {
                                    if (this.readyState == 4 && this.status == 200) {
                                        let response = JSON.parse(xhr.response);
                                        console.log(response);
                                    }
                                };
                                let url = ${session.message.address.serviceUrl}/v3/conversations;
                                xhr.setRequestHeader('Content-Type', 'application/json');
                                xhr.setRequestHeader('Authorization', ${process.env.BEARER_ACCESS_TOKEN});
                                xhr.open("POST", url, true);
                                let body = {
                                    "bot": {
                                        "id": ${session.message.address.bot.id},
                                        "name": "Bubble Bot"
                                    },
                                    "isGroup": false,
                                    "members": [
                                        {
                                            "id": ${session.message.address.user.id},
                                            "name": ${session.message.address.user.name}
                                        }
                                    ],
                                    "topicName": "New Answer"
                                };
                                console.log(body);
                                xhr.send(JSON.stringify(body));
                            }
                        </script>
                    </span>
                </body>`
    };
    conversationLog = '';

    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            console.log(error);
        }

        console.log('Message sent: ' + info.response);
    });
};
