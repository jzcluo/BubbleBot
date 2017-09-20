"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var request = require('request');
require('dotenv').config();


var useEmulator = true;//(process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

//console.log(process.env);

var bot = new builder.UniversalBot(connector, require('./qnadialog.js'));
bot.localePath(path.join(__dirname, './locale'));

bot.dialog('help',
    function (session) {
        session.endDialog('I could help you');
    }).triggerAction({
        matched : /^help$/i,
        onSelectAction : function(session, args, next) {
            beginDialog(args.action, args);
        }
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
