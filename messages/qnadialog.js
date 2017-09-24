const request = require('request');


module.exports = (session, args, next) => {
    console.log('qnamaker called');
    session.sendTyping();
    const questionAsked = session.message.text;
    const bodyText = JSON.stringify({question : questionAsked});
    const host = `https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/`;
    const url = `${host}knowledgebases/${process.env.KnowledgeBaseID}/generateAnswer`;
    console.log(url);

    const options = {
        url : url,
        method : 'POST',
        body : bodyText,
        headers : {
            'Ocp-Apim-Subscription-Key' : process.env.QnASubscriptionKey
        }
    };
    request(options , (err, res, body) => {
        if (err) {
            console.log(err);
            session.endConversation('Sorry something went wrong');
        } else {
            const response = JSON.parse(body)['answers'][0];
            console.log(response);
            if (response.score > 60) {
                session.endConversation(response.answer);
            } else if (response.score > 30) {
                session.send('I am not sure if this is right');
                session.endConversation(response.answer);
            } else {
                session.endConversation('sorry I do not have the answer you need');
            }
        }
    })
}
