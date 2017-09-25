const builder = require('botbuilder');

module.exports = (restaurantInfo, session) => {
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
