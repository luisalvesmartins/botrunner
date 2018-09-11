//#region REQUIRE
var lambotenginecore=require('./lambotenginecore');
const { BotFrameworkAdapter, BotStateSet, ConsoleAdapter, ConversationState, MemoryStorage, UserState } = require('botbuilder');
//const { TableStorage } = require('botbuilder-azure');
const botbuilder_dialogs = require('botbuilder-dialogs');
const restify = require('restify');
const alexa= require('./alexaBridge/alexaBridge.js')
var storage = require('azure-storage');
require('dotenv').config();
//#endregion

//#region initializations
alexa.start();
var adapter;
// Create adapter
if (process.env.CONSOLE=='YES')
    adapter = new ConsoleAdapter();
else
    adapter = new BotFrameworkAdapter({ 
        appId: process.env.MICROSOFT_APP_ID, 
        appPassword: process.env.MICROSOFT_APP_PASSWORD
    });

//FILE: const azureStorage = new FileStorage("c:/temp");
//MEMORY: (this is a demo)
const azureStorage = new MemoryStorage();

// Add state middleware
const convoState = new ConversationState(azureStorage);
const userState  = new UserState(azureStorage);
adapter.use(new BotStateSet(convoState, userState));
const dialogs = new botbuilder_dialogs.DialogSet();
  
dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());

//#region Start Console or Server
if (process.env.CONSOLE=='YES')
{
    adapter.listen(async (context) => {
		console.log("CONSOLE");
        main(context);
    });
}
else
{
    // Create server
    let server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3979, function () {
        console.log(`${server.name} listening to ${server.url}`);
	});
	//ALEXABRIDGE
	server.use(restify.plugins.bodyParser());
	server.post('/messages', (req, res, err) => alexa.says(req, res, err));
	//BOT
    server.post('/api/messages', (req, res) => {
        adapter.processActivity(req, res, async (context) => {
            await main(context);
        })
	});
}
//#endregion


async function main(context){
    const state = convoState.get(context);
	var botPointer = state.pointer === undefined ? state.pointer=-1 : state.pointer;
    var session = state.session === undefined ? state.session=lambotenginecore.guid() : state.session;
	const dc = dialogs.createContext(context, state);

	var myBot = await lambotenginecore.AsyncPromiseReadBotFromAzure(storage,"fsi.bot");
	if (botPointer==-1)
	{
		botPointer=lambotenginecore.getBotPointerOfStart(myBot);
		state.pointer=botPointer;
		state.pointerKey=myBot[botPointer].key;
	}

	if (context.activity.type === 'conversationUpdate' && context.activity.membersAdded[0].name !== 'Bot') {
		 await context.sendActivity("## Welcome to the Bot!","Welcome to the bot");
		 //lambotenginecore.RenderConversationThread(storage, state, session, context, dc, myBot);
	} else
    if (context.activity.type === 'message') {
		//PROCESS SPECIAL RESPONSE
		if (context.activity.text.toUpperCase().startsWith("DEBUG"))
		{
			await context.sendActivity("Data collected: " + JSON.stringify(state.UserActivityResults));
			return;
		}

		await lambotenginecore.PreProcessing(state,myBot,botPointer,context.activity.text)

		if(!context.responded){
			// Continue executing the "current" dialog, if any.
			await dc.continue();
		}
		
		if(!context.responded){
			await lambotenginecore.RenderConversationThread(storage, state, session, context, dc, myBot)
		}
			

    }

}